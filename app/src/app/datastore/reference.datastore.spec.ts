import { TestBed } from '@angular/core/testing';
import { SEED_COUNTRIES, SEED_GRAPES } from '../constants/reference-seed';
import { ReferenceRepository } from '../db/reference.repository';
import { MaCaveDb } from '../db/schema';
import { createTestDb, provideTestDb } from '../testing/test-db';
import { ReferenceDatastore } from './reference.datastore';

describe('ReferenceDatastore', () => {
  let db: MaCaveDb;
  let sut: ReferenceDatastore;

  beforeEach(() => {
    db = createTestDb();
    TestBed.configureTestingModule({ providers: [provideTestDb(db)] });
    sut = TestBed.inject(ReferenceDatastore);
  });

  afterEach(async () => {
    await db.delete();
  });

  it('load on a new database should seed countries, regions and grapes', async () => {
    await sut.load();

    expect(sut.countries()).toHaveLength(SEED_COUNTRIES.length);
    expect(sut.grapes()).toHaveLength(SEED_GRAPES.length);
    expect(sut.regionsFor('Suisse')).toContain('Valais');
  });

  it('load should not overwrite a reference that was already enriched', async () => {
    const repository = TestBed.inject(ReferenceRepository);
    await repository.seedIfEmpty();
    await repository.remember('Suisse', 'Lavaux', ['Plant Robert']);

    await sut.load();

    expect(sut.regionsFor('Suisse')).toContain('Lavaux');
    expect(sut.grapes()).toContain('Plant Robert');
  });

  it('countries should be sorted the French way', async () => {
    await sut.load();

    const countries = sut.countries();
    expect(countries.indexOf('Espagne')).toBeLessThan(countries.indexOf('États-Unis'));
    expect(countries.indexOf('États-Unis')).toBeLessThan(countries.indexOf('France'));
  });

  it('regionsFor an unknown country should offer every region', async () => {
    await sut.load();

    expect(sut.regionsFor('').length).toBeGreaterThan(sut.regionsFor('Suisse').length);
  });

  it('regionsFor should ignore case and accents in the country name', async () => {
    await sut.load();

    expect(sut.regionsFor('etats-unis')).toContain('Californie');
  });
});
