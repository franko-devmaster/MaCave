import { TestBed } from '@angular/core/testing';
import { MaCaveDb } from '../db/schema';
import { FIXED_NOW } from '../testing/fixtures';
import { createTestDb, provideTestDb } from '../testing/test-db';
import { maskApiKey, SettingsDatastore } from './settings.datastore';

describe('SettingsDatastore', () => {
  let db: MaCaveDb;
  let sut: SettingsDatastore;

  beforeEach(() => {
    db = createTestDb();
    TestBed.configureTestingModule({ providers: [provideTestDb(db)] });
    sut = TestBed.inject(SettingsDatastore);
  });

  afterEach(async () => {
    await db.delete();
  });

  it('load when nothing was exported should expose null', async () => {
    await sut.load();

    expect(sut.lastExportAt()).toBeNull();
  });

  it('markExported should persist the date', async () => {
    await sut.markExported(FIXED_NOW);
    const fresh = TestBed.runInInjectionContext(() => new SettingsDatastore());

    await fresh.load();

    expect(fresh.lastExportAt()).toBe(FIXED_NOW.toISOString());
  });
});

describe('SettingsDatastore API key', () => {
  let db: MaCaveDb;
  let sut: SettingsDatastore;

  beforeEach(() => {
    db = createTestDb();
    TestBed.configureTestingModule({ providers: [provideTestDb(db)] });
    sut = TestBed.inject(SettingsDatastore);
  });

  afterEach(async () => {
    await db.delete();
  });

  it('setApiKey should trim, persist and mask the key', async () => {
    await sut.setApiKey('  sk-ant-api03-abcdefghijklmnop-wxyz  ');

    expect(sut.hasApiKey()).toBe(true);
    expect(sut.maskedApiKey()).toBe('sk-ant-…wxyz');
    const fresh = TestBed.runInInjectionContext(() => new SettingsDatastore());
    await fresh.load();
    expect(fresh.apiKey()).toBe('sk-ant-api03-abcdefghijklmnop-wxyz');
  });

  it('clearApiKey should remove the key from storage', async () => {
    await sut.setApiKey('sk-ant-api03-abcdefghijklmnop');

    await sut.clearApiKey();

    expect(sut.hasApiKey()).toBe(false);
    expect(await db.settings.get('anthropicApiKey')).toBeUndefined();
  });

  it('maskApiKey should hide short values entirely', () => {
    expect(maskApiKey('court')).toBe('••••');
    expect(maskApiKey(null)).toBeNull();
  });
});
