import { TestBed } from '@angular/core/testing';
import { MaCaveDb } from '../db/schema';
import { CLAUDE_SDK_LOADER } from '../services/claude.service';
import { PhotoService } from '../services/photo.service';
import { apiError, fakeSdk, textResponse } from '../testing/fake-claude';
import { tastingInput, wineInput } from '../testing/fixtures';
import { createTestDb, provideTestDb } from '../testing/test-db';
import { PAIRING_HISTORY_SIZE, PairingDatastore } from './pairing.datastore';
import { SettingsDatastore } from './settings.datastore';
import { TastingDatastore } from './tasting.datastore';
import { WineDatastore } from './wine.datastore';

describe('PairingDatastore', () => {
  let db: MaCaveDb;
  let respond: () => unknown;
  let calls: ReturnType<typeof fakeSdk>['calls'];
  let prepare: ReturnType<typeof vi.fn>;
  let wineId: string;
  let sut: PairingDatastore;

  function answer(overrides: Record<string, unknown> = {}): unknown {
    return textResponse(
      JSON.stringify({
        notADish: false,
        dish: 'Risotto aux bolets',
        topPick: { wineId, reason: 'Le fruit répond aux bolets.', service: '16 °C' },
        alternatives: [],
        rejected: [],
        buyAdvice: null,
        ...overrides,
      }),
    );
  }

  beforeEach(async () => {
    respond = () => answer();
    const fake = fakeSdk({ respond: () => respond() });
    calls = fake.calls;
    prepare = vi.fn().mockResolvedValue({ bytes: new Uint8Array([1]).buffer, mediaType: 'image/jpeg', width: 1, height: 1, base64: 'AQ==' });
    db = createTestDb();
    TestBed.configureTestingModule({
      providers: [provideTestDb(db), { provide: CLAUDE_SDK_LOADER, useValue: fake.loader }, { provide: PhotoService, useValue: { prepare } }],
    });
    URL.createObjectURL = vi.fn().mockReturnValue('blob:plat');
    URL.revokeObjectURL = vi.fn();
    await TestBed.inject(SettingsDatastore).setApiKey('sk-ant-test-0123456789');
    wineId = (await TestBed.inject(WineDatastore).create(wineInput(), { quantity: 2, pricePaid: null })).id;
    await TestBed.inject(TastingDatastore).add(tastingInput(wineId, { context: 'raclette' }));
    sut = TestBed.inject(PairingDatastore);
  });

  afterEach(async () => {
    await db.delete();
  });

  it('ask should send cellar, past dishes and the dish, then store the result', async () => {
    await sut.ask('Risotto aux bolets', null);

    expect(sut.status()).toBe('done');
    expect(sut.current()).toMatchObject({ dish: 'Risotto aux bolets', query: 'Risotto aux bolets', topPick: { wineId } });
    const content = JSON.stringify(calls[0].params['messages']);
    expect(content).toContain(`id=${wineId}`);
    expect(content).toContain('déjà bu avec : raclette');
    expect(content).toContain('Plat : « Risotto aux bolets »');
    expect(await db.pairingRequests.count()).toBe(1);
  });

  it('ask with a photo should send the resized image and show a preview', async () => {
    await sut.ask('', new File(['x'], 'plat.jpg'));

    const content = (calls[0].params['messages'] as { content: { type: string }[] }[])[0].content;
    expect(content.map((b) => b.type)).toEqual(['text', 'image', 'text']);
    expect(sut.preview()).toBe('blob:plat');
    expect(sut.current()?.query).toBe('');
  });

  it('ask when the photo is not a dish should report it without storing anything', async () => {
    respond = () => answer({ notADish: true, dish: '', topPick: null });

    await sut.ask('', new File(['x'], 'chat.jpg'));

    expect(sut.error()?.kind).toBe('not-a-dish');
    expect(await db.pairingRequests.count()).toBe(0);
  });

  it('ask when Claude fails should expose the error', async () => {
    respond = () => {
      throw apiError(401);
    };

    await sut.ask('Fondue', null);

    expect(sut.status()).toBe('error');
    expect(sut.error()?.kind).toBe('invalid-key');
  });

  it('ask with nothing to describe should not call Claude', async () => {
    await sut.ask('   ', null);

    expect(calls).toHaveLength(0);
    expect(sut.status()).toBe('idle');
  });

  it('history should keep the most recent requests and show one again without a call', async () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date('2026-11-01T19:00:00Z'));
    await sut.ask('Fondue', null);
    vi.setSystemTime(new Date('2026-11-02T19:00:00Z'));
    await sut.ask('Risotto', null);
    vi.useRealTimers();
    const first = sut.history()[1];

    sut.show(first.id);

    expect(sut.current()?.query).toBe('Fondue');
    expect(calls).toHaveLength(2);
    const fresh = TestBed.runInInjectionContext(() => new PairingDatastore());
    await fresh.load();
    expect(fresh.history().map((r) => r.query)).toEqual(['Risotto', 'Fondue']);
  });

  it('history should be capped', async () => {
    for (let i = 0; i < PAIRING_HISTORY_SIZE + 2; i++) {
      await sut.ask(`Plat ${i}`, null);
    }

    expect(sut.history()).toHaveLength(PAIRING_HISTORY_SIZE);
    expect(sut.history()[0].query).toBe(`Plat ${PAIRING_HISTORY_SIZE + 1}`);
  });
});
