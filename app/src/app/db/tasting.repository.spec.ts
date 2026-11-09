import { TestBed } from '@angular/core/testing';
import { FIXED_NOW, tastingInput } from '../testing/fixtures';
import { createTestDb, provideTestDb } from '../testing/test-db';
import { MaCaveDb } from './schema';
import { TastingRepository } from './tasting.repository';

describe('TastingRepository', () => {
  let db: MaCaveDb;
  let sut: TastingRepository;

  beforeEach(() => {
    db = createTestDb();
    TestBed.configureTestingModule({ providers: [provideTestDb(db)] });
    sut = TestBed.inject(TastingRepository);
  });

  afterEach(async () => {
    await db.delete();
  });

  it('add should store the tasting with an id and the date', async () => {
    const tasting = await sut.add(tastingInput('w1'), FIXED_NOW);

    expect(await db.tastings.get(tasting.id)).toEqual({ ...tastingInput('w1'), id: tasting.id, date: FIXED_NOW.toISOString() });
  });

  it('update should change the content and keep the original date', async () => {
    const tasting = await sut.add(tastingInput('w1'), FIXED_NOW);

    const updated = await sut.update(tasting.id, tastingInput('w1', { score: 2, rebuy: false }));

    expect(updated).toMatchObject({ score: 2, rebuy: false, date: FIXED_NOW.toISOString() });
  });

  it('update when the tasting does not exist should throw', async () => {
    await expect(sut.update('absente', tastingInput('w1'))).rejects.toThrow('Dégustation introuvable');
  });

  it('remove should delete the tasting', async () => {
    const tasting = await sut.add(tastingInput('w1'));

    await sut.remove(tasting.id);

    expect(await db.tastings.count()).toBe(0);
  });
});
