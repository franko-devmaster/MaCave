import { inject, Injectable } from '@angular/core';
import { Photo, PhotoInput, StockMovement, StockReason, Wine, WineAdvice, WineInput } from '../models/wine';
import { MACAVE_DB } from './schema';

export interface Purchase {
  quantity: number;
  pricePaid: number | null;
}

@Injectable({ providedIn: 'root' })
export class WineRepository {
  private readonly db = inject(MACAVE_DB);

  listWines(): Promise<Wine[]> {
    return this.db.wines.toArray();
  }

  listMovements(): Promise<StockMovement[]> {
    return this.db.stockMovements.toArray();
  }

  /** Crée le vin, sa photo éventuelle et son mouvement d'achat initial dans une seule transaction. */
  async create(
    input: WineInput,
    purchase: Purchase,
    photo: PhotoInput | null = null,
    now: Date = new Date(),
  ): Promise<{ wine: Wine; movement: StockMovement }> {
    const timestamp = now.toISOString();
    const photoRecord = photo ? buildPhoto(photo, now) : null;
    const wine: Wine = { ...input, id: crypto.randomUUID(), labelPhotoId: photoRecord?.id ?? null, createdAt: timestamp, updatedAt: timestamp };
    const movement = buildMovement(wine.id, purchase.quantity, 'achat', purchase.pricePaid, now);
    await this.db.transaction('rw', this.db.wines, this.db.stockMovements, this.db.photos, async () => {
      if (photoRecord) {
        await this.db.photos.add(photoRecord);
      }
      await this.db.wines.add(wine);
      await this.db.stockMovements.add(movement);
    });
    return { wine, movement };
  }

  /** Remplace la photo d'étiquette du vin ; l'ancienne est supprimée. */
  async attachPhoto(wineId: string, photo: PhotoInput, now: Date = new Date()): Promise<Wine> {
    return this.db.transaction('rw', this.db.wines, this.db.photos, async () => {
      const existing = await this.db.wines.get(wineId);
      if (!existing) {
        throw new Error(`Vin introuvable : ${wineId}`);
      }
      const record = buildPhoto(photo, now);
      await this.db.photos.add(record);
      if (existing.labelPhotoId) {
        await this.db.photos.delete(existing.labelPhotoId);
      }
      const wine: Wine = { ...existing, labelPhotoId: record.id, updatedAt: now.toISOString() };
      await this.db.wines.put(wine);
      return wine;
    });
  }

  async update(id: string, input: WineInput, now: Date = new Date()): Promise<Wine> {
    const existing = await this.db.wines.get(id);
    if (!existing) {
      throw new Error(`Vin introuvable : ${id}`);
    }
    const wine: Wine = { ...existing, ...input, updatedAt: now.toISOString() };
    await this.db.wines.put(wine);
    return wine;
  }

  /** Mémorise le conseil sans toucher à la date de modification du vin. */
  async setAdvice(id: string, advice: WineAdvice): Promise<void> {
    await this.db.wines.update(id, { advice });
  }

  /** Supprime le vin et tout ce qui s'y rattache. */
  async remove(id: string): Promise<void> {
    await this.db.transaction('rw', [this.db.wines, this.db.stockMovements, this.db.tastings, this.db.photos], async () => {
      const wine = await this.db.wines.get(id);
      await this.db.stockMovements.where('wineId').equals(id).delete();
      await this.db.tastings.where('wineId').equals(id).delete();
      if (wine?.labelPhotoId) {
        await this.db.photos.delete(wine.labelPhotoId);
      }
      await this.db.wines.delete(id);
    });
  }

  async addMovement(wineId: string, delta: number, reason: StockReason, pricePaid: number | null = null, now: Date = new Date()): Promise<StockMovement> {
    const movement = buildMovement(wineId, delta, reason, pricePaid, now);
    await this.db.stockMovements.add(movement);
    return movement;
  }

  deleteMovement(id: string): Promise<void> {
    return this.db.stockMovements.delete(id);
  }
}

function buildPhoto(photo: PhotoInput, now: Date): Photo {
  return {
    id: crypto.randomUUID(),
    bytes: photo.bytes,
    mediaType: photo.mediaType,
    width: photo.width,
    height: photo.height,
    createdAt: now.toISOString(),
  };
}

function buildMovement(wineId: string, delta: number, reason: StockReason, pricePaid: number | null, now: Date): StockMovement {
  return { id: crypto.randomUUID(), wineId, delta, reason, pricePaid, date: now.toISOString() };
}
