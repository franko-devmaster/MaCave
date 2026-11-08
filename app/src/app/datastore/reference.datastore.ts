import { computed, inject, Injectable, signal } from '@angular/core';
import { ReferenceData, ReferenceRepository } from '../db/reference.repository';

const collator = new Intl.Collator('fr', { sensitivity: 'base' });

/** Pays, régions et cépages proposés à la saisie. */
@Injectable({ providedIn: 'root' })
export class ReferenceDatastore {
  private readonly repository = inject(ReferenceRepository);
  private readonly data = signal<ReferenceData>({ countries: [], regions: [], grapes: [] });

  readonly countries = computed(() => [...this.data().countries].sort(collator.compare));
  readonly grapes = computed(() => [...this.data().grapes].sort(collator.compare));

  async load(): Promise<void> {
    await this.repository.seedIfEmpty();
    this.data.set(await this.repository.load());
  }

  /** Régions du pays donné ; toutes les régions si le pays est vide ou inconnu. */
  regionsFor(country: string): string[] {
    const regions = this.data().regions;
    const matching = regions.filter((r) => collator.compare(r.country, country) === 0);
    return (matching.length ? matching : regions).map((r) => r.name).sort(collator.compare);
  }
}
