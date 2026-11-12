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

  /** Enregistre la saisie. `updatedAt` ne change que si un champ change : le conseil n'est alors pas redemandé. */
  async update(id: string, input: WineInput, now: Date = new Date()): Promise<Wine> {
    const existing = await this.getOrThrow(id);
    const keys = Object.keys(input) as (keyof WineInput)[];
    if (keys.every((key) => JSON.stringify(existing[key]) === JSON.stringify(input[key]))) {
      return existing;
    }
    const wine: Wine = { ...existing, ...input, updatedAt: now.toISOString() };
    await this.db.wines.put(wine);
    return wine;
  }

  private async getOrThrow(id: string): Promise<Wine> {
    const wine = await this.db.wines.get(id);
    if (!wine) {
      throw new Error(`Vin introuvable : ${id}`);
    }
    return wine;
  }

  /**
   * Remplace la photo Bouteille. L'ancienne est supprimée, ou conservée comme fiche info si demandé
   * et si le vin n'en a pas. Ne modifie pas `updatedAt` : une photo ne change pas la fiche descriptive
   * et ne doit pas faire recalculer le conseil.
   */
  async attachPhoto(wineId: string, photo: PhotoInput, keepPreviousAsInfo = false, now: Date = new Date()): Promise<Wine> {
    return this.db.transaction('rw', this.db.wines, this.db.photos, async () => {
      const existing = await this.getOrThrow(wineId);
      const record = buildPhoto(photo, now);
      await this.db.photos.add(record);
      let infoAttachmentId = existing.infoAttachmentId ?? null;
      if (existing.labelPhotoId) {
        if (keepPreviousAsInfo && !infoAttachmentId) {
          infoAttachmentId = existing.labelPhotoId;
        } else {
          await this.db.photos.delete(existing.labelPhotoId);
        }
      }
      const wine: Wine = { ...existing, labelPhotoId: record.id, infoAttachmentId };
      await this.db.wines.put(wine);
      return wine;
    });
  }

  /** Ajoute ou remplace la fiche info (photo ou PDF). Ne modifie pas `updatedAt`. */
  async attachInfo(wineId: string, file: PhotoInput, now: Date = new Date()): Promise<Wine> {
    return this.db.transaction('rw', this.db.wines, this.db.photos, async () => {
      const existing = await this.getOrThrow(wineId);
      const record = buildPhoto(file, now);
      await this.db.photos.add(record);
      if (existing.infoAttachmentId) {
        await this.db.photos.delete(existing.infoAttachmentId);
      }
      const wine: Wine = { ...existing, infoAttachmentId: record.id };
      await this.db.wines.put(wine);
      return wine;
    });
  }

  async removeInfo(wineId: string): Promise<Wine> {
    return this.db.transaction('rw', this.db.wines, this.db.photos, async () => {
      const existing = await this.getOrThrow(wineId);
      if (existing.infoAttachmentId) {
        await this.db.photos.delete(existing.infoAttachmentId);
      }
      const wine: Wine = { ...existing, infoAttachmentId: null };
      await this.db.wines.put(wine);
      return wine;
    });
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
      if (wine?.infoAttachmentId) {
        await this.db.photos.delete(wine.infoAttachmentId);
      }
      await this.db.wines.delete(id);
    });
  }

  async addMovement(wineId: string, delta: number, reason: StockReason, pricePaid: number | null = null, now: Date = new Date()): Promise<StockMovement> {
    const movement = buildMovement(wineId, delta, reason, pricePaid, now);
    await this.db.stockMovements.add(movement);
    return movement;
  }

  /**
   * Corrige le prix payé affiché sur la fiche : celui du dernier achat. Sans achat enregistré,
   * le prix est porté par un mouvement de correction sans bouteille.
   */
  async setLastPrice(wineId: string, pricePaid: number | null, now: Date = new Date()): Promise<StockMovement> {
    return this.db.transaction('rw', this.db.stockMovements, async () => {
      const purchases = await this.db.stockMovements.where('wineId').equals(wineId).filter((m) => m.reason === 'achat').toArray();
      const last = purchases.sort((a, b) => b.date.localeCompare(a.date))[0];
      if (!last) {
        const movement = buildMovement(wineId, 0, 'correction', pricePaid, now);
        await this.db.stockMovements.add(movement);
        return movement;
      }
      const movement: StockMovement = { ...last, pricePaid };
      await this.db.stockMovements.put(movement);
      return movement;
    });
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
