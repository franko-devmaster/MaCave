import { inject, Injectable } from '@angular/core';
import { PairingRequest } from '../models/advice';
import { MACAVE_DB } from './schema';

@Injectable({ providedIn: 'root' })
export class PairingRepository {
  private readonly db = inject(MACAVE_DB);

  async add(request: PairingRequest): Promise<void> {
    await this.db.pairingRequests.add(request);
  }

  /** Accords les plus récents d'abord. */
  listRecent(limit: number): Promise<PairingRequest[]> {
    return this.db.pairingRequests.orderBy('date').reverse().limit(limit).toArray();
  }
}
