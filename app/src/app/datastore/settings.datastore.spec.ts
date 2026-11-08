import { TestBed } from '@angular/core/testing';
import { MaCaveDb } from '../db/schema';
import { FIXED_NOW } from '../testing/fixtures';
import { createTestDb, provideTestDb } from '../testing/test-db';
import { SettingsDatastore } from './settings.datastore';

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
