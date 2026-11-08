import { Provider } from '@angular/core';
import { MACAVE_DB, MaCaveDb } from '../db/schema';

/** Base IndexedDB isolée par test (fake-indexeddb, chargé dans test-setup.ts). */
export function createTestDb(): MaCaveDb {
  return new MaCaveDb(`macave-test-${crypto.randomUUID()}`);
}

export function provideTestDb(db: MaCaveDb): Provider {
  return { provide: MACAVE_DB, useValue: db };
}
