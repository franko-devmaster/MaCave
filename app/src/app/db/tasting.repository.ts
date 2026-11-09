import { inject, Injectable } from '@angular/core';
import { Tasting, TastingInput } from '../models/tasting';
import { MACAVE_DB } from './schema';

@Injectable({ providedIn: 'root' })
export class TastingRepository {
  private readonly db = inject(MACAVE_DB);

  list(): Promise<Tasting[]> {
    return this.db.tastings.toArray();
  }

  async add(input: TastingInput, now: Date = new Date()): Promise<Tasting> {
    const tasting: Tasting = { ...input, id: crypto.randomUUID(), date: now.toISOString() };
    await this.db.tastings.add(tasting);
    return tasting;
  }

  /** Met à jour le contenu ; la date d'origine est conservée. */
  async update(id: string, input: TastingInput): Promise<Tasting> {
    const existing = await this.db.tastings.get(id);
    if (!existing) {
      throw new Error(`Dégustation introuvable : ${id}`);
    }
    const tasting: Tasting = { ...existing, ...input, id, date: existing.date };
    await this.db.tastings.put(tasting);
    return tasting;
  }

  remove(id: string): Promise<void> {
    return this.db.tastings.delete(id);
  }
}
