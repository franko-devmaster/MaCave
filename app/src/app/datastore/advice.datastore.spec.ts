import { TestBed } from '@angular/core/testing';
import { MaCaveDb } from '../db/schema';
import { CLAUDE_SDK_LOADER } from '../services/claude.service';
import { apiError, fakeSdk, textResponse } from '../testing/fake-claude';
import { wineInput } from '../testing/fixtures';
import { createTestDb, provideTestDb } from '../testing/test-db';
import { AdviceDatastore } from './advice.datastore';
import { SettingsDatastore } from './settings.datastore';
import { WineDatastore } from './wine.datastore';

describe('AdviceDatastore', () => {
  let db: MaCaveDb;
  let respond: () => unknown;
  let calls: ReturnType<typeof fakeSdk>['calls'];
  let wines: WineDatastore;
  let wineId: string;
  let sut: AdviceDatastore;

  beforeEach(async () => {
    respond = () => textResponse(JSON.stringify({ status: 'apogee', text: 'À son apogée. Servez-le à 16 °C.', infoSummary: null }));
    const fake = fakeSdk({ respond: () => respond() });
    calls = fake.calls;
    db = createTestDb();
    TestBed.configureTestingModule({ providers: [provideTestDb(db), { provide: CLAUDE_SDK_LOADER, useValue: fake.loader }] });
    await TestBed.inject(SettingsDatastore).setApiKey('sk-ant-test-0123456789');
    wines = TestBed.inject(WineDatastore);
    wineId = (await wines.create(wineInput(), { quantity: 2, pricePaid: null })).id;
    sut = TestBed.inject(AdviceDatastore);
  });

  afterEach(async () => {
    await db.delete();
  });

  it('ensure should ask once, store the advice and not ask again', async () => {
    await sut.ensure(wineId);
    await sut.ensure(wineId);

    expect(calls).toHaveLength(1);
    expect(wines.detail(wineId)?.wine.advice).toMatchObject({ status: 'apogee', text: 'À son apogée. Servez-le à 16 °C.' });
    expect((await db.wines.get(wineId))?.advice?.status).toBe('apogee');
  });

  it('ensure after an edit of the wine should ask again', async () => {
    await sut.ensure(wineId);
    await new Promise((resolve) => setTimeout(resolve, 5));

    await wines.update(wineId, wineInput({ vintage: 2020 }));
    await sut.ensure(wineId);

    expect(calls).toHaveLength(2);
  });

  it('setting the advice should not count as an edit of the wine', async () => {
    const before = wines.detail(wineId)?.wine.updatedAt;

    await sut.ensure(wineId);

    expect(wines.detail(wineId)?.wine.updatedAt).toBe(before);
  });

  it('ensure without an API key should stay silent', async () => {
    await TestBed.inject(SettingsDatastore).clearApiKey();

    await sut.ensure(wineId);

    expect(calls).toHaveLength(0);
    expect(sut.errors().size).toBe(0);
  });

  it('refresh when Claude fails should keep the error for this wine', async () => {
    respond = () => {
      throw apiError(529);
    };

    await sut.refresh(wineId);

    expect(sut.errors().get(wineId)?.kind).toBe('unavailable');
    expect(sut.loading().has(wineId)).toBe(false);
  });

  it('ensure with an info file should send it, keep its summary and ask again when it changes', async () => {
    respond = () => textResponse(JSON.stringify({ status: 'pret', text: 'Carafez-le.', infoSummary: 'Élevé 12 mois en fût.' }));
    await wines.setInfo(wineId, { bytes: new TextEncoder().encode('%PDF').buffer as ArrayBuffer, mediaType: 'application/pdf', width: 0, height: 0 });

    await sut.ensure(wineId);
    await sut.ensure(wineId);

    expect(calls).toHaveLength(1);
    const content = (calls[0].params['messages'] as { content: { type: string; source?: { data: string } }[] }[])[0].content;
    expect(content.map((b) => b.type)).toEqual(['text', 'document', 'text']);
    expect(content[1].source?.data).toBe('JVBERg==');
    const advice = wines.detail(wineId)?.wine.advice;
    expect(advice).toMatchObject({ infoSummary: 'Élevé 12 mois en fût.', infoAttachmentId: wines.detail(wineId)?.wine.infoAttachmentId });

    await wines.setInfo(wineId, { bytes: new Uint8Array([1]).buffer, mediaType: 'image/jpeg', width: 1, height: 1 });
    await sut.ensure(wineId);

    expect(calls).toHaveLength(2);
  });

  it('reevaluateAll should ask again for every wine in stock, even with a fresh advice', async () => {
    const other = await wines.create(wineInput({ name: 'Petite Arvine' }), { quantity: 1, pricePaid: null });
    const emptied = await wines.create(wineInput({ name: 'Épuisé' }), { quantity: 1, pricePaid: null });
    await wines.open(emptied.id);
    await sut.ensure(wineId);
    respond = () => textResponse(JSON.stringify({ status: 'pret', text: 'Réévalué.', infoSummary: null, affinity: 9, grandCru: true }));

    await sut.reevaluateAll();

    expect(calls).toHaveLength(3);
    expect(sut.reevaluation()).toEqual({ done: 2, total: 2, running: false, error: null });
    expect(wines.detail(wineId)?.wine.advice).toMatchObject({ affinity: 9, grandCru: true });
    expect(wines.detail(other.id)?.wine.advice?.text).toBe('Réévalué.');
    expect(wines.detail(emptied.id)?.wine.advice).toBeFalsy();
  });

  it('reevaluateAll should stop at the first error and report it', async () => {
    await wines.create(wineInput({ name: 'Petite Arvine' }), { quantity: 1, pricePaid: null });
    respond = () => {
      throw apiError(429);
    };

    await sut.reevaluateAll();

    expect(calls).toHaveLength(1);
    expect(sut.reevaluation()).toMatchObject({ done: 0, total: 2, running: false, error: { kind: 'rate-limit' } });
  });

  it('reevaluateAll without an API key should do nothing', async () => {
    await TestBed.inject(SettingsDatastore).clearApiKey();

    await sut.reevaluateAll();

    expect(calls).toHaveLength(0);
    expect(sut.reevaluation()).toBeNull();
  });
});
