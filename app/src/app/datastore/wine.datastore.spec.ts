import { TestBed } from '@angular/core/testing';
import { MaCaveDb } from '../db/schema';
import { photoInput, tastingInput, wineInput } from '../testing/fixtures';
import { TastingDatastore } from './tasting.datastore';
import { createTestDb, provideTestDb } from '../testing/test-db';
import { WineDatastore } from './wine.datastore';

describe('WineDatastore', () => {
  let db: MaCaveDb;
  let sut: WineDatastore;

  beforeEach(() => {
    db = createTestDb();
    TestBed.configureTestingModule({ providers: [provideTestDb(db)] });
    sut = TestBed.inject(WineDatastore);
  });

  afterEach(async () => {
    await db.delete();
  });

  it('create should add the wine, its stock and remember references', async () => {
    const wine = await sut.create(wineInput({ country: 'Suisse', region: 'Lavaux', grapes: ['Chasselas'] }), { quantity: 3, pricePaid: 28 });

    expect(sut.detail(wine.id)).toMatchObject({ bottles: 3, lastPrice: 28 });
    expect(sut.summary()).toEqual({ bottles: 3, wines: 1, drinkNow: 0 });
    expect(await db.refRegions.get(['Suisse', 'Lavaux'])).toEqual({ country: 'Suisse', name: 'Lavaux' });
    expect(await db.refGrapes.get('Chasselas')).toEqual({ name: 'Chasselas' });
  });

  it('open should decrement stock and refuse when empty', async () => {
    const wine = await sut.create(wineInput(), { quantity: 1, pricePaid: null });

    expect(await sut.open(wine.id)).not.toBeNull();
    expect(sut.detail(wine.id)?.bottles).toBe(0);
    expect(await sut.open(wine.id)).toBeNull();
    expect(await db.stockMovements.count()).toBe(2);
  });

  it('undoMovement should restore the previous stock', async () => {
    const wine = await sut.create(wineInput(), { quantity: 2, pricePaid: null });
    const bought = await sut.buy(wine.id);

    await sut.undoMovement(bought.id);

    expect(sut.detail(wine.id)?.bottles).toBe(2);
  });

  it('update should replace the wine in state', async () => {
    const wine = await sut.create(wineInput(), { quantity: 1, pricePaid: null });

    await sut.update(wine.id, wineInput({ vintage: 2020 }));

    expect(sut.detail(wine.id)?.wine.vintage).toBe(2020);
  });

  it('update with a stock correction should adjust bottles and the price paid', async () => {
    const wine = await sut.create(wineInput(), { quantity: 6, pricePaid: 34 });

    await sut.update(wine.id, wineInput(), { bottles: 4, pricePaid: 31.5 });

    expect(sut.detail(wine.id)).toMatchObject({ bottles: 4, lastPrice: 31.5 });
    const stored = await db.stockMovements.toArray();
    expect(stored).toHaveLength(2);
    expect(stored.find((m) => m.reason === 'correction')).toMatchObject({ delta: -2, pricePaid: null });
  });

  it('update with an unchanged stock should not add a movement', async () => {
    const wine = await sut.create(wineInput(), { quantity: 3, pricePaid: 20 });

    await sut.update(wine.id, wineInput(), { bottles: 3, pricePaid: 20 });

    expect(await db.stockMovements.count()).toBe(1);
  });

  it('update should allow an empty cellar', async () => {
    const wine = await sut.create(wineInput(), { quantity: 2, pricePaid: null });

    await sut.update(wine.id, wineInput(), { bottles: 0, pricePaid: null });

    expect(sut.detail(wine.id)?.bottles).toBe(0);
  });

  it('starWineIds should follow tastings and the affinity stored with the advice', async () => {
    const loved = await sut.create(wineInput({ name: 'Aimé' }), { quantity: 1, pricePaid: null });
    const close = await sut.create(wineInput({ name: 'Proche' }), { quantity: 1, pricePaid: null });
    await TestBed.inject(TastingDatastore).add(tastingInput(loved.id, { score: 5 }));
    await sut.setAdvice(close.id, { status: 'pret', text: 'x', generatedAt: '2026-11-01T00:00:00Z', affinity: 9, grandCru: false });

    expect(sut.starWineIds()).toEqual(new Set([loved.id, close.id]));
  });

  it('remove should drop the wine and its movements from state', async () => {
    const wine = await sut.create(wineInput(), { quantity: 4, pricePaid: null });

    await sut.remove(wine.id);

    expect(sut.wines()).toEqual([]);
    expect(sut.movements()).toEqual([]);
  });

  it('load should read what is stored', async () => {
    const wine = await sut.create(wineInput(), { quantity: 5, pricePaid: null });
    const fresh = TestBed.runInInjectionContext(() => new WineDatastore());

    await fresh.load();

    expect(fresh.detail(wine.id)?.bottles).toBe(5);
  });

  it('buy with a quantity should add several bottles at once', async () => {
    const wine = await sut.create(wineInput(), { quantity: 1, pricePaid: null });

    await sut.buy(wine.id, 30, 6);

    expect(sut.detail(wine.id)).toMatchObject({ bottles: 7, lastPrice: 30 });
  });

  it('setPhoto should link the new photo in state', async () => {
    const wine = await sut.create(wineInput(), { quantity: 1, pricePaid: null });

    await sut.setPhoto(wine.id, photoInput());

    expect(sut.detail(wine.id)?.wine.labelPhotoId).not.toBeNull();
  });

  it('findDuplicate should find a wine already in the cellar', async () => {
    const wine = await sut.create(wineInput(), { quantity: 1, pricePaid: null });

    expect(sut.findDuplicate({ name: 'cornalin', producer: 'germanier', vintage: 2019 })?.id).toBe(wine.id);
  });
});
