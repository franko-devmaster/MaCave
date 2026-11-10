import { inject, Injectable, signal } from '@angular/core';
import { ClaudeFailure } from '../ai/claude-errors';
import { InfoFile, isAdviceFresh, wineAdviceRequest } from '../ai/wine-advice';
import { ClaudeService } from '../services/claude.service';
import { PhotoService } from '../services/photo.service';
import { arrayBufferToBase64 } from '../utils/base64';
import { ProfileDatastore } from './profile.datastore';
import { SettingsDatastore } from './settings.datastore';
import { TastingDatastore } from './tasting.datastore';
import { WineDatastore } from './wine.datastore';

/** Conseil de Claude sur la fiche : demandé une fois par vin, mémorisé, renouvelé si le vin change. */
@Injectable({ providedIn: 'root' })
export class AdviceDatastore {
  private readonly claude = inject(ClaudeService);
  private readonly wines = inject(WineDatastore);
  private readonly tastings = inject(TastingDatastore);
  private readonly profile = inject(ProfileDatastore);
  private readonly settings = inject(SettingsDatastore);
  private readonly photos = inject(PhotoService);

  private readonly loadingSignal = signal<ReadonlySet<string>>(new Set());
  private readonly errorsSignal = signal<ReadonlyMap<string, ClaudeFailure>>(new Map());

  readonly loading = this.loadingSignal.asReadonly();
  readonly errors = this.errorsSignal.asReadonly();

  /** Demande un conseil si celui du vin manque ou est périmé, et si Claude est joignable. */
  async ensure(wineId: string, today: Date = new Date()): Promise<void> {
    const wine = this.wines.detail(wineId)?.wine;
    if (!wine || isAdviceFresh(wine, today) || !this.settings.hasApiKey() || this.loadingSignal().has(wineId)) {
      return;
    }
    await this.refresh(wineId, today);
  }

  async refresh(wineId: string, today: Date = new Date()): Promise<void> {
    const detail = this.wines.detail(wineId);
    if (!detail) {
      return;
    }
    this.loadingSignal.update((set) => new Set(set).add(wineId));
    this.errorsSignal.update((map) => withoutKey(map, wineId));
    const infoAttachmentId = detail.wine.infoAttachmentId ?? null;
    const info = await this.loadInfo(infoAttachmentId);
    const result = await this.claude.structured(
      wineAdviceRequest(detail.wine, detail.bottles, this.tastings.tastings(), this.profile.profile(), today, info),
    );
    if (result.ok) {
      await this.wines.setAdvice(wineId, { ...result.value, infoAttachmentId: info ? infoAttachmentId : null, generatedAt: new Date().toISOString() });
    } else {
      this.errorsSignal.update((map) => new Map(map).set(wineId, result));
    }
    this.loadingSignal.update((set) => {
      const next = new Set(set);
      next.delete(wineId);
      return next;
    });
  }

  /** La fiche info du vin, prête à joindre à la demande ; null si elle n'existe pas. */
  private async loadInfo(id: string | null): Promise<InfoFile | null> {
    const file = id ? await this.photos.load(id) : undefined;
    return file ? { mediaType: file.mediaType, base64: arrayBufferToBase64(file.bytes) } : null;
  }
}

function withoutKey<K, V>(map: ReadonlyMap<K, V>, key: K): ReadonlyMap<K, V> {
  const next = new Map(map);
  next.delete(key);
  return next;
}
