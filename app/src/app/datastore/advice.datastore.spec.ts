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
    respond = () => textResponse(JSON.stringify({ status: 'apogee', text: 'À son apogée. Servez-le à 16 °C.' }));
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
});
