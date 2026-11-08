import { DOCUMENT } from '@angular/common';
import { inject, Injectable, signal } from '@angular/core';

export type PersistenceStatus = 'unknown' | 'persisted' | 'not-persisted' | 'unsupported';

/** Demande au navigateur de ne pas purger IndexedDB (stockage persistant). */
@Injectable({ providedIn: 'root' })
export class StoragePersistenceService {
  private readonly document = inject(DOCUMENT);
  private readonly statusSignal = signal<PersistenceStatus>('unknown');
  readonly status = this.statusSignal.asReadonly();

  async ensurePersisted(): Promise<PersistenceStatus> {
    const storage = this.document.defaultView?.navigator?.storage;
    if (!storage?.persist || !storage.persisted) {
      this.statusSignal.set('unsupported');
      return 'unsupported';
    }
    try {
      const granted = (await storage.persisted()) || (await storage.persist());
      const status: PersistenceStatus = granted ? 'persisted' : 'not-persisted';
      this.statusSignal.set(status);
      return status;
    } catch {
      this.statusSignal.set('not-persisted');
      return 'not-persisted';
    }
  }
}
