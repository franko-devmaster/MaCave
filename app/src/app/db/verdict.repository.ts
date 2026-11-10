import { inject, Injectable } from '@angular/core';
import { Verdict } from '../models/advice';
import { MACAVE_DB } from './schema';

@Injectable({ providedIn: 'root' })
export class VerdictRepository {
  private readonly db = inject(MACAVE_DB);

  list(): Promise<Verdict[]> {
    return this.db.verdicts.toArray();
  }

  async add(verdict: Verdict): Promise<void> {
    await this.db.verdicts.add(verdict);
  }

  async update(id: string, changes: Partial<Pick<Verdict, 'outcome' | 'boughtWineId'>>): Promise<void> {
    await this.db.verdicts.update(id, changes);
  }
}
