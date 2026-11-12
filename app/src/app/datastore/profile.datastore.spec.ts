import { TestBed } from '@angular/core/testing';
import { MaCaveDb } from '../db/schema';
import { CLAUDE_SDK_LOADER } from '../services/claude.service';
import { apiError, fakeSdk, textResponse } from '../testing/fake-claude';
import { tastingInput, wineInput } from '../testing/fixtures';
import { createTestDb, provideTestDb } from '../testing/test-db';
import { ProfileDatastore } from './profile.datastore';
import { SettingsDatastore } from './settings.datastore';
import { TastingDatastore } from './tasting.datastore';
import { WineDatastore } from './wine.datastore';

const SYNTHESIS = {
  summary: 'Des rouges de montagne au fruit mûr.',
  axes: { fruit: 9, freshness: 7, spice: 7, power: 5, oak: 2 },
  favoriteGrapes: ['Cornalin', 'Merlot'],
  avoidPatterns: ['Chardonnay boisé'],
};

describe('ProfileDatastore', () => {
  let db: MaCaveDb;
  let respond: () => unknown;
  let calls: ReturnType<typeof fakeSdk>['calls'];
  let sut: ProfileDatastore;
  let tastings: TastingDatastore;

  beforeEach(async () => {
    respond = () => textResponse(JSON.stringify(SYNTHESIS));
    const fake = fakeSdk({ respond: () => respond() });
    calls = fake.calls;
    db = createTestDb();
    TestBed.configureTestingModule({ providers: [provideTestDb(db), { provide: CLAUDE_SDK_LOADER, useValue: fake.loader }] });
    await TestBed.inject(SettingsDatastore).setApiKey('sk-ant-test-0123456789');
    tastings = TestBed.inject(TastingDatastore);
    sut = TestBed.inject(ProfileDatastore);
  });

  afterEach(async () => {
    await db.delete();
  });

  async function taste(count: number): Promise<void> {
    const wine = await TestBed.inject(WineDatastore).create(wineInput(), { quantity: 6, pricePaid: null });
    for (let i = 0; i < count; i++) {
      await tastings.add(tastingInput(wine.id));
    }
  }

  it('without tastings should be neither stale nor visible, and never call Claude', async () => {
    await sut.refreshIfStale();

    expect(sut.stale()).toBe(false);
    expect(sut.profile()).toBeNull();
    expect(calls).toHaveLength(0);
  });

  it('refreshIfStale should compute the profile once, then stay quiet until something changes', async () => {
    await taste(2);

    await sut.refreshIfStale();
    await sut.refreshIfStale();

    expect(calls).toHaveLength(1);
    expect(sut.profile()).toMatchObject({ summary: SYNTHESIS.summary, basedOnTastings: 2 });
    expect(sut.provisional()).toBe(true);
    expect(sut.stale()).toBe(false);
    const content = (calls[0].params['messages'] as { content: { text: string }[] }[])[0].content;
    expect(content[0].text).toContain('Dégustations (2)');
    expect(calls[0].params['output_config']).toMatchObject({ effort: 'medium' });
  });

  it('starWineIds should combine good scores and favorite grapes from the profile', async () => {
    const wines = TestBed.inject(WineDatastore);
    const loved = await wines.create(wineInput({ name: 'Aimé', grapes: ['Syrah'] }), { quantity: 1, pricePaid: null });
    const favorite = await wines.create(wineInput({ name: 'Favori', grapes: ['Merlot'] }), { quantity: 1, pricePaid: null });
    const other = await wines.create(wineInput({ name: 'Autre', grapes: ['Gamay'] }), { quantity: 1, pricePaid: null });
    await tastings.add(tastingInput(loved.id, { score: 5 }));

    await sut.refreshIfStale();

    expect(sut.starWineIds()).toEqual(new Set([loved.id, favorite.id]));
    expect(sut.starWineIds().has(other.id)).toBe(false);
  });

  it('a new tasting should make the profile stale again', async () => {
    await taste(1);
    await sut.refreshIfStale();

    await tastings.add(tastingInput('autre'));

    expect(sut.stale()).toBe(true);
  });

  it('a correction should apply at once and be sent on the next refresh', async () => {
    await taste(5);
    await sut.refreshIfStale();

    await sut.addOverride({ field: 'axis:freshness', userValue: '10' });
    await sut.addOverride({ field: 'remove-grape', userValue: 'Merlot' });

    expect(sut.profile()?.axes.freshness).toBe(10);
    expect(sut.profile()?.favoriteGrapes).toEqual(['Cornalin']);
    expect(sut.provisional()).toBe(false);
    expect(sut.stale()).toBe(true);
    await sut.refreshIfStale();
    const content = (calls[1].params['messages'] as { content: { text: string }[] }[])[0].content;
    expect(content[1].text).toContain('- Axe fraîcheur : 10/10');
    expect(content[1].text).toContain('- Ne pas citer comme cépage favori : Merlot');
  });

  it('removeOverride should restore the value computed by Claude', async () => {
    await taste(1);
    await sut.refreshIfStale();
    await sut.addOverride({ field: 'axis:oak', userValue: '9' });

    await sut.removeOverride(sut.overrides()[0].id);

    expect(sut.profile()?.axes.oak).toBe(2);
  });

  it('refresh when Claude fails should keep the previous profile and expose the error', async () => {
    await taste(1);
    await sut.refreshIfStale();
    await tastings.add(tastingInput('autre'));
    respond = () => {
      throw apiError(529);
    };

    await sut.refreshIfStale();

    expect(sut.status()).toBe('error');
    expect(sut.error()?.kind).toBe('unavailable');
    expect(sut.profile()?.summary).toBe(SYNTHESIS.summary);
    expect(sut.stale()).toBe(true);
  });

  it('refreshIfStale without an API key should not call Claude', async () => {
    await TestBed.inject(SettingsDatastore).clearApiKey();
    await taste(1);

    await sut.refreshIfStale();

    expect(calls).toHaveLength(0);
    expect(sut.stale()).toBe(true);
  });

  it('load should restore the saved profile and corrections', async () => {
    await taste(1);
    await sut.refreshIfStale();
    await sut.addOverride({ field: 'note', userValue: 'Pas de rosé' });
    const fresh = TestBed.runInInjectionContext(() => new ProfileDatastore());

    await fresh.load();

    expect(fresh.profile()?.summary).toBe(SYNTHESIS.summary);
    expect(fresh.overrides()).toHaveLength(1);
  });
});
