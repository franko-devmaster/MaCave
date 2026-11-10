import { TestBed } from '@angular/core/testing';
import { MaCaveDb } from '../db/schema';
import { CLAUDE_SDK_LOADER } from '../services/claude.service';
import { PhotoService } from '../services/photo.service';
import { apiError, fakeSdk, textResponse } from '../testing/fake-claude';
import { tastingInput, wineInput } from '../testing/fixtures';
import { createTestDb, provideTestDb } from '../testing/test-db';
import { AddWineDatastore } from './add-wine.datastore';
import { SettingsDatastore } from './settings.datastore';
import { TastingDatastore } from './tasting.datastore';
import { VerdictDatastore } from './verdict.datastore';
import { WineDatastore } from './wine.datastore';

const WINE = {
  notReadable: false, name: 'Syrah Cayas', producer: 'Germanier', vintage: 2020, color: 'rouge', country: 'Suisse',
  region: 'Valais', appellation: null, grapes: ['Syrah'], alcohol: null, sweetness: null, drinkFrom: 2026, drinkUntil: 2034,
  quantity: null, pricePaid: 39, uncertainFields: [], possibleDuplicateId: null,
};

function verdictResponse(overrides: Record<string, unknown> = {}): unknown {
  return textResponse(JSON.stringify({ wine: WINE, level: 'plaira', affinity: 8, reasons: [{ sign: '+', text: 'Même domaine.' }], ...overrides }));
}

describe('VerdictDatastore', () => {
  let db: MaCaveDb;
  let respond: () => unknown;
  let calls: ReturnType<typeof fakeSdk>['calls'];
  let sut: VerdictDatastore;

  beforeEach(async () => {
    respond = () => verdictResponse();
    const fake = fakeSdk({ respond: () => respond() });
    calls = fake.calls;
    db = createTestDb();
    const prepare = vi.fn().mockResolvedValue({ bytes: new Uint8Array([1]).buffer, mediaType: 'image/jpeg', width: 1, height: 1, base64: 'AQ==' });
    TestBed.configureTestingModule({
      providers: [provideTestDb(db), { provide: CLAUDE_SDK_LOADER, useValue: fake.loader }, { provide: PhotoService, useValue: { prepare } }],
    });
    URL.createObjectURL = vi.fn().mockReturnValue('blob:etiquette');
    URL.revokeObjectURL = vi.fn();
    await TestBed.inject(SettingsDatastore).setApiKey('sk-ant-test-0123456789');
    sut = TestBed.inject(VerdictDatastore);
  });

  afterEach(async () => {
    await db.delete();
  });

  it('checkPhoto should send the label and journal the verdict', async () => {
    await sut.checkPhoto(new File(['x'], 'etiquette.jpg'));

    expect(sut.status()).toBe('done');
    expect(sut.current()).toMatchObject({ level: 'plaira', affinity: 8, outcome: null, boughtWineId: null });
    expect(sut.preview()).toBe('blob:etiquette');
    expect(await db.verdicts.count()).toBe(1);
    const content = (calls[0].params['messages'] as { content: { type: string }[] }[])[0].content;
    expect(content.map((b) => b.type)).toEqual(['text', 'image', 'text']);
  });

  it('pass should record the outcome and clear the screen', async () => {
    await sut.checkDescription('Syrah Cayas 2020');
    const id = sut.current()?.id ?? '';

    await sut.pass();

    expect(sut.status()).toBe('idle');
    expect((await db.verdicts.get(id))?.outcome).toBe('passe');
  });

  it('buy should hand the reading, photo and price over to the add flow', async () => {
    await sut.checkPhoto(new File(['x'], 'etiquette.jpg'));

    sut.buy();

    const addWine = TestBed.inject(AddWineDatastore);
    expect(addWine.status()).toBe('done');
    expect(addWine.reading()).toMatchObject({ name: 'Syrah Cayas', pricePaid: 39, quantity: 1 });
    expect(addWine.photoToSave()).not.toBeNull();
    expect(addWine.verdictId()).toBe(sut.current()?.id);
  });

  it('markBought then a tasting should feed the calibration of the next verdict', async () => {
    await sut.checkDescription('Syrah Cayas 2020');
    const verdictId = sut.current()?.id ?? '';
    const wine = await TestBed.inject(WineDatastore).create(wineInput({ name: 'Syrah Cayas', vintage: 2020 }), { quantity: 1, pricePaid: 39 });
    await sut.markBought(verdictId, wine.id);
    await TestBed.inject(TastingDatastore).add(tastingInput(wine.id, { score: 2 }));

    await sut.checkDescription('Autre syrah');

    expect((await db.verdicts.get(verdictId))).toMatchObject({ outcome: 'achete', boughtWineId: wine.id });
    expect(JSON.stringify(calls[1].params['messages'])).toContain('Syrah Cayas 2020 (Germanier) : prédit 8/10 (plaira), noté 2/5 après achat');
  });

  it('check when the label is unreadable should report it without journaling', async () => {
    respond = () => verdictResponse({ wine: { ...WINE, notReadable: true, name: '' }, level: 'mitige', affinity: 5, reasons: [] });

    await sut.checkPhoto(new File(['x'], 'flou.jpg'));

    expect(sut.error()?.kind).toBe('not-readable');
    expect(await db.verdicts.count()).toBe(0);
  });

  it('check when Claude fails should expose the error', async () => {
    respond = () => {
      throw apiError(429);
    };

    await sut.checkDescription('Syrah');

    expect(sut.error()?.kind).toBe('rate-limit');
  });

  it('load should restore the journal', async () => {
    await sut.checkDescription('Syrah');
    const fresh = TestBed.runInInjectionContext(() => new VerdictDatastore());

    await fresh.load();

    expect(fresh.verdicts()).toHaveLength(1);
  });
});
