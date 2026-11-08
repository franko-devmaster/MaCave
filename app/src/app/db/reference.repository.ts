import { inject, Injectable } from '@angular/core';
import { SEED_GRAPES, SEED_REGIONS } from '../constants/reference-seed';
import { RefRegion } from '../models/reference';
import { MACAVE_DB } from './schema';

export interface ReferenceData {
  countries: string[];
  regions: RefRegion[];
  grapes: string[];
}

@Injectable({ providedIn: 'root' })
export class ReferenceRepository {
  private readonly db = inject(MACAVE_DB);

  /** Charge le référentiel initial si les tables sont vides. Idempotent. */
  async seedIfEmpty(): Promise<boolean> {
    return this.db.transaction('rw', this.db.refCountries, this.db.refRegions, this.db.refGrapes, async () => {
      if ((await this.db.refCountries.count()) > 0) {
        return false;
      }
      await this.db.refCountries.bulkPut(Object.keys(SEED_REGIONS).map((name) => ({ name })));
      await this.db.refRegions.bulkPut(
        Object.entries(SEED_REGIONS).flatMap(([country, regions]) => regions.map((name) => ({ country, name }))),
      );
      await this.db.refGrapes.bulkPut(SEED_GRAPES.map((name) => ({ name })));
      return true;
    });
  }

  async load(): Promise<ReferenceData> {
    const [countries, regions, grapes] = await Promise.all([
      this.db.refCountries.toArray(),
      this.db.refRegions.toArray(),
      this.db.refGrapes.toArray(),
    ]);
    return { countries: countries.map((c) => c.name), regions, grapes: grapes.map((g) => g.name) };
  }

  /** Ajoute au référentiel les valeurs saisies qui n'y figurent pas encore. */
  async remember(country: string, region: string, grapes: readonly string[]): Promise<void> {
    await this.db.transaction('rw', this.db.refCountries, this.db.refRegions, this.db.refGrapes, async () => {
      if (country) {
        await this.db.refCountries.put({ name: country });
        if (region) {
          await this.db.refRegions.put({ country, name: region });
        }
      }
      if (grapes.length) {
        await this.db.refGrapes.bulkPut(grapes.map((name) => ({ name })));
      }
    });
  }
}
