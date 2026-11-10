import { computed, inject, Injectable, signal } from '@angular/core';
import { ReferenceRepository } from '../db/reference.repository';
import { Purchase, WineRepository } from '../db/wine.repository';
import { PhotoInput, StockMovement, Wine, WineAdvice, WineInput } from '../models/wine';
import { TastingDatastore } from './tasting.datastore';
import { buildEntries, CellarEntry, findDuplicate, lastPricePaid, summarize } from '../utils/cellar';

export interface WineDetail extends CellarEntry {
  lastPrice: number | null;
}

/** État de la cave : vins et mouvements de stock, dérivations en signaux. */
@Injectable({ providedIn: 'root' })
export class WineDatastore {
  private readonly repository = inject(WineRepository);
  private readonly references = inject(ReferenceRepository);
  private readonly tastings = inject(TastingDatastore);

  private readonly winesSignal = signal<Wine[]>([]);
  private readonly movementsSignal = signal<StockMovement[]>([]);

  readonly wines = this.winesSignal.asReadonly();
  readonly movements = this.movementsSignal.asReadonly();
  readonly entries = computed(() => buildEntries(this.winesSignal(), this.movementsSignal(), new Date().getFullYear()));
  readonly summary = computed(() => summarize(this.entries()));

  async load(): Promise<void> {
    const [wines, movements] = await Promise.all([this.repository.listWines(), this.repository.listMovements()]);
    this.winesSignal.set(wines);
    this.movementsSignal.set(movements);
  }

  detail(id: string): WineDetail | null {
    const entry = this.entries().find((e) => e.wine.id === id);
    return entry ? { ...entry, lastPrice: lastPricePaid(this.movementsSignal(), id) } : null;
  }

  /** Vin déjà en cave correspondant à la saisie (même nom, producteur et millésime), ou null. */
  findDuplicate(input: Pick<WineInput, 'name' | 'producer' | 'vintage'>): Wine | null {
    return findDuplicate(input, this.winesSignal());
  }

  async create(input: WineInput, purchase: Purchase, photo: PhotoInput | null = null): Promise<Wine> {
    const { wine, movement } = await this.repository.create(input, purchase, photo);
    await this.references.remember(input.country, input.region, input.grapes);
    this.winesSignal.update((wines) => [...wines, wine]);
    this.movementsSignal.update((movements) => [...movements, movement]);
    return wine;
  }

  async update(id: string, input: WineInput): Promise<Wine> {
    const wine = await this.repository.update(id, input);
    await this.references.remember(input.country, input.region, input.grapes);
    this.winesSignal.update((wines) => wines.map((w) => (w.id === id ? wine : w)));
    return wine;
  }

  async remove(id: string): Promise<void> {
    await this.repository.remove(id);
    this.tastings.forgetWine(id);
    this.winesSignal.update((wines) => wines.filter((w) => w.id !== id));
    this.movementsSignal.update((movements) => movements.filter((m) => m.wineId !== id));
  }

  /** −1 bouteille. Refusé si le stock est déjà à zéro. */
  async open(id: string): Promise<StockMovement | null> {
    if ((this.detail(id)?.bottles ?? 0) <= 0) {
      return null;
    }
    return this.addMovement(id, -1, 'ouverture');
  }

  async buy(id: string, pricePaid: number | null = null, quantity = 1): Promise<StockMovement> {
    return this.addMovement(id, quantity, 'achat', pricePaid);
  }

  async setAdvice(id: string, advice: WineAdvice): Promise<void> {
    await this.repository.setAdvice(id, advice);
    this.winesSignal.update((wines) => wines.map((w) => (w.id === id ? { ...w, advice } : w)));
  }

  async setPhoto(id: string, photo: PhotoInput): Promise<void> {
    const wine = await this.repository.attachPhoto(id, photo);
    this.winesSignal.update((wines) => wines.map((w) => (w.id === id ? wine : w)));
  }

  async undoMovement(movementId: string): Promise<void> {
    await this.repository.deleteMovement(movementId);
    this.movementsSignal.update((movements) => movements.filter((m) => m.id !== movementId));
  }

  private async addMovement(id: string, delta: number, reason: StockMovement['reason'], pricePaid: number | null = null): Promise<StockMovement> {
    const movement = await this.repository.addMovement(id, delta, reason, pricePaid);
    this.movementsSignal.update((movements) => [...movements, movement]);
    return movement;
  }
}
