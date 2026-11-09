import { TestBed } from '@angular/core/testing';
import { MaCaveDb } from '../db/schema';
import { tastingInput, wineInput } from '../testing/fixtures';
import { createTestDb, provideTestDb } from '../testing/test-db';
import { TastingDatastore } from './tasting.datastore';
import { WineDatastore } from './wine.datastore';

describe('TastingDatastore', () => {
  let db: MaCaveDb;
  let sut: TastingDatastore;

  beforeEach(() => {
    db = createTestDb();
    TestBed.configureTestingModule({ providers: [provideTestDb(db)] });
    sut = TestBed.inject(TastingDatastore);
  });

  afterEach(async () => {
    vi.useRealTimers();
    await db.delete();
  });

  async function addAt(iso: string, ...args: Parameters<typeof tastingInput>) {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date(iso));
    const tasting = await sut.add(tastingInput(...args));
    vi.useRealTimers();
    return tasting;
  }

  it('forWine should list tastings of a wine, newest first', async () => {
    const old = await addAt('2026-03-03T20:00:00Z', 'w1', { score: 5 });
    const recent = await addAt('2026-10-12T20:00:00Z', 'w1', { score: 4 });
    await addAt('2026-10-13T20:00:00Z', 'w2');

    expect(sut.forWine('w1').map((t) => t.id)).toEqual([recent.id, old.id]);
  });

  it('rebuyWineIds should follow the latest tasting of each wine', async () => {
    await addAt('2026-01-01T20:00:00Z', 'w1', { rebuy: true });
    await addAt('2026-02-01T20:00:00Z', 'w1', { rebuy: false });
    await addAt('2026-01-01T20:00:00Z', 'w2', { rebuy: false });
    await addAt('2026-02-01T20:00:00Z', 'w2', { rebuy: true });

    expect([...sut.rebuyWineIds()]).toEqual(['w2']);
  });

  it('update and remove should be reflected in state', async () => {
    const tasting = await sut.add(tastingInput('w1'));

    await sut.update(tasting.id, tastingInput('w1', { comment: 'Corrigé' }));
    expect(sut.get(tasting.id)?.comment).toBe('Corrigé');

    await sut.remove(tasting.id);
    expect(sut.get(tasting.id)).toBeNull();
  });

  it('removing a wine should drop its tastings from state and storage', async () => {
    const wines = TestBed.inject(WineDatastore);
    const wine = await wines.create(wineInput(), { quantity: 1, pricePaid: null });
    await sut.add(tastingInput(wine.id));

    await wines.remove(wine.id);

    expect(sut.tastings()).toEqual([]);
    expect(await db.tastings.count()).toBe(0);
  });

  it('load should read what is stored', async () => {
    await sut.add(tastingInput('w1'));
    const fresh = TestBed.runInInjectionContext(() => new TastingDatastore());

    await fresh.load();

    expect(fresh.forWine('w1')).toHaveLength(1);
  });
});
