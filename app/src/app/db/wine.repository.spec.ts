import { TestBed } from '@angular/core/testing';
import { FIXED_NOW, photoInput, wineInput } from '../testing/fixtures';
import { createTestDb, provideTestDb } from '../testing/test-db';
import { MaCaveDb } from './schema';
import { WineRepository } from './wine.repository';

describe('WineRepository', () => {
  let db: MaCaveDb;
  let sut: WineRepository;

  beforeEach(() => {
    db = createTestDb();
    TestBed.configureTestingModule({ providers: [provideTestDb(db)] });
    sut = TestBed.inject(WineRepository);
  });

  afterEach(async () => {
    await db.delete();
  });

  it('create should store the wine with its initial purchase', async () => {
    const { wine, movement } = await sut.create(wineInput(), { quantity: 6, pricePaid: 34 }, null, FIXED_NOW);

    expect(await db.wines.get(wine.id)).toEqual({ ...wineInput(), id: wine.id, labelPhotoId: null, createdAt: FIXED_NOW.toISOString(), updatedAt: FIXED_NOW.toISOString() });
    expect(movement).toMatchObject({ wineId: wine.id, delta: 6, reason: 'achat', pricePaid: 34 });
    expect(await db.stockMovements.count()).toBe(1);
  });

  it('update should change fields and bump updatedAt only', async () => {
    const { wine } = await sut.create(wineInput(), { quantity: 1, pricePaid: null }, null, FIXED_NOW);
    const later = new Date('2026-12-01T10:00:00Z');

    const updated = await sut.update(wine.id, wineInput({ name: 'Cornalin Réserve' }), later);

    expect(updated.name).toBe('Cornalin Réserve');
    expect(updated.createdAt).toBe(FIXED_NOW.toISOString());
    expect(updated.updatedAt).toBe(later.toISOString());
  });

  it('update when nothing changed should keep updatedAt', async () => {
    const { wine } = await sut.create(wineInput(), { quantity: 1, pricePaid: null }, null, FIXED_NOW);

    const updated = await sut.update(wine.id, wineInput(), new Date('2026-12-01T10:00:00Z'));

    expect(updated.updatedAt).toBe(FIXED_NOW.toISOString());
  });

  it('setLastPrice should change the price of the last purchase only', async () => {
    const { wine, movement: first } = await sut.create(wineInput(), { quantity: 2, pricePaid: 30 }, null, FIXED_NOW);
    const second = await sut.addMovement(wine.id, 1, 'achat', 32, new Date('2026-12-01T10:00:00Z'));

    const updated = await sut.setLastPrice(wine.id, 35);

    expect(updated.id).toBe(second.id);
    expect((await db.stockMovements.get(second.id))?.pricePaid).toBe(35);
    expect((await db.stockMovements.get(first.id))?.pricePaid).toBe(30);
  });

  it('setLastPrice when no purchase exists should add a correction without bottles', async () => {
    const movement = await sut.setLastPrice('sans-achat', 20, FIXED_NOW);

    expect(movement).toMatchObject({ wineId: 'sans-achat', delta: 0, reason: 'correction', pricePaid: 20 });
    expect(await db.stockMovements.count()).toBe(1);
  });

  it('update when the wine does not exist should throw', async () => {
    await expect(sut.update('absent', wineInput())).rejects.toThrow('Vin introuvable');
  });

  it('remove should delete the wine and its movements and tastings', async () => {
    const { wine } = await sut.create(wineInput(), { quantity: 2, pricePaid: null });
    const other = await sut.create(wineInput({ name: 'Autre' }), { quantity: 1, pricePaid: null });
    await sut.addMovement(wine.id, -1, 'ouverture');
    await db.tastings.add({ id: 't1', wineId: wine.id, score: 4, likedDescriptors: [], dislikedDescriptors: [], comment: '', context: '', rebuy: false, date: '' });

    await sut.remove(wine.id);

    expect(await db.wines.toArray()).toHaveLength(1);
    expect((await db.stockMovements.toArray()).every((m) => m.wineId === other.wine.id)).toBe(true);
    expect(await db.tastings.count()).toBe(0);
  });

  it('create with a photo should store it and link it to the wine', async () => {
    const { wine } = await sut.create(wineInput(), { quantity: 1, pricePaid: null }, photoInput(), FIXED_NOW);

    expect(wine.labelPhotoId).not.toBeNull();
    const photo = await db.photos.get(wine.labelPhotoId ?? '');
    expect(photo).toMatchObject({ mediaType: 'image/jpeg', width: 640, height: 480 });
    expect(new Uint8Array(photo?.bytes ?? new ArrayBuffer(0))).toEqual(new Uint8Array([1, 2, 3]));
  });

  it('attachPhoto should replace the previous photo without touching updatedAt', async () => {
    const { wine } = await sut.create(wineInput(), { quantity: 1, pricePaid: null }, photoInput(), FIXED_NOW);

    const updated = await sut.attachPhoto(wine.id, photoInput(), false, new Date('2026-12-01T00:00:00Z'));

    expect(updated.labelPhotoId).not.toBe(wine.labelPhotoId);
    expect(updated.updatedAt).toBe(FIXED_NOW.toISOString());
    expect(await db.photos.count()).toBe(1);
  });

  it('attachPhoto asked to keep the previous photo should move it to the info slot', async () => {
    const { wine } = await sut.create(wineInput(), { quantity: 1, pricePaid: null }, photoInput());

    const updated = await sut.attachPhoto(wine.id, photoInput(), true);

    expect(updated.infoAttachmentId).toBe(wine.labelPhotoId);
    expect(await db.photos.count()).toBe(2);
  });

  it('attachPhoto should not overwrite an existing info file', async () => {
    const { wine } = await sut.create(wineInput(), { quantity: 1, pricePaid: null }, photoInput());
    const withInfo = await sut.attachInfo(wine.id, { ...photoInput(), mediaType: 'application/pdf', width: 0, height: 0 });

    const updated = await sut.attachPhoto(wine.id, photoInput(), true);

    expect(updated.infoAttachmentId).toBe(withInfo.infoAttachmentId);
    expect(await db.photos.count()).toBe(2);
  });

  it('attachInfo should replace the previous info file and removeInfo should delete it', async () => {
    const { wine } = await sut.create(wineInput(), { quantity: 1, pricePaid: null }, null, FIXED_NOW);
    const first = await sut.attachInfo(wine.id, { ...photoInput(), mediaType: 'application/pdf', width: 0, height: 0 });
    const second = await sut.attachInfo(wine.id, photoInput());

    expect(second.infoAttachmentId).not.toBe(first.infoAttachmentId);
    expect(second.updatedAt).toBe(FIXED_NOW.toISOString());
    expect(await db.photos.count()).toBe(1);

    const cleared = await sut.removeInfo(wine.id);
    expect(cleared.infoAttachmentId).toBeNull();
    expect(await db.photos.count()).toBe(0);
  });

  it('remove should also delete the photo and the info file', async () => {
    const { wine } = await sut.create(wineInput(), { quantity: 1, pricePaid: null }, photoInput());
    await sut.attachInfo(wine.id, photoInput());

    await sut.remove(wine.id);

    expect(await db.photos.count()).toBe(0);
  });

  it('deleteMovement should remove only that movement', async () => {
    const { wine } = await sut.create(wineInput(), { quantity: 2, pricePaid: null });
    const opened = await sut.addMovement(wine.id, -1, 'ouverture');

    await sut.deleteMovement(opened.id);

    expect(await db.stockMovements.count()).toBe(1);
  });
});
