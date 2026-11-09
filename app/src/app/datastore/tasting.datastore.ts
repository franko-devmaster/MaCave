import { computed, inject, Injectable, signal } from '@angular/core';
import { TastingRepository } from '../db/tasting.repository';
import { Tasting, TastingInput } from '../models/tasting';

/** Dégustations notées, de la plus récente à la plus ancienne. */
@Injectable({ providedIn: 'root' })
export class TastingDatastore {
  private readonly repository = inject(TastingRepository);
  private readonly tastingsSignal = signal<Tasting[]>([]);

  readonly tastings = computed(() => [...this.tastingsSignal()].sort((a, b) => b.date.localeCompare(a.date)));

  /** Vins dont la dernière dégustation est marquée « à racheter ». */
  readonly rebuyWineIds = computed(() => {
    const latest = new Map<string, Tasting>();
    for (const tasting of this.tastings()) {
      if (!latest.has(tasting.wineId)) {
        latest.set(tasting.wineId, tasting);
      }
    }
    return new Set([...latest.values()].filter((t) => t.rebuy).map((t) => t.wineId));
  });

  async load(): Promise<void> {
    this.tastingsSignal.set(await this.repository.list());
  }

  forWine(wineId: string): Tasting[] {
    return this.tastings().filter((t) => t.wineId === wineId);
  }

  get(id: string): Tasting | null {
    return this.tastingsSignal().find((t) => t.id === id) ?? null;
  }

  async add(input: TastingInput): Promise<Tasting> {
    const tasting = await this.repository.add(input);
    this.tastingsSignal.update((tastings) => [...tastings, tasting]);
    return tasting;
  }

  async update(id: string, input: TastingInput): Promise<Tasting> {
    const tasting = await this.repository.update(id, input);
    this.tastingsSignal.update((tastings) => tastings.map((t) => (t.id === id ? tasting : t)));
    return tasting;
  }

  async remove(id: string): Promise<void> {
    await this.repository.remove(id);
    this.tastingsSignal.update((tastings) => tastings.filter((t) => t.id !== id));
  }

  /** Retire de l'état les dégustations d'un vin supprimé (la base les a déjà effacées). */
  forgetWine(wineId: string): void {
    this.tastingsSignal.update((tastings) => tastings.filter((t) => t.wineId !== wineId));
  }
}
