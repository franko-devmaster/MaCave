import { computed, inject, Injectable, signal } from '@angular/core';
import { ClaudeFailure } from '../ai/claude-errors';
import { InfoFile, isAdviceFresh, wineAdviceRequest } from '../ai/wine-advice';
import { ClaudeService } from '../services/claude.service';
import { PhotoService } from '../services/photo.service';
import { arrayBufferToBase64 } from '../utils/base64';
import { ProfileDatastore } from './profile.datastore';
import { SettingsDatastore } from './settings.datastore';
import { TastingDatastore } from './tasting.datastore';
import { WineDatastore } from './wine.datastore';

/** Avancement d'une réévaluation de la cave ; `running` à false une fois terminée ou interrompue. */
export interface Reevaluation {
  done: number;
  total: number;
  running: boolean;
  error: ClaudeFailure | null;
}

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

  private readonly reevaluationSignal = signal<Reevaluation | null>(null);

  readonly loading = this.loadingSignal.asReadonly();
  readonly errors = this.errorsSignal.asReadonly();
  readonly reevaluation = this.reevaluationSignal.asReadonly();

  /** Vins en cave à réévaluer : ceux dont il reste au moins une bouteille. */
  readonly reevaluableCount = computed(() => this.wines.entries().filter((e) => e.bottles > 0).length);

  /**
   * Redemande le conseil de chaque vin en cave, un à la fois, pour recalculer l'affinité et le
   * grand cru d'après le profil actuel. S'arrête à la première erreur (clé, limite, réseau).
   */
  async reevaluateAll(today: Date = new Date()): Promise<void> {
    if (this.reevaluationSignal()?.running || !this.settings.hasApiKey()) {
      return;
    }
    const ids = this.wines
      .entries()
      .filter((e) => e.bottles > 0)
      .map((e) => e.wine.id);
    let done = 0;
    this.reevaluationSignal.set({ done, total: ids.length, running: true, error: null });
    for (const id of ids) {
      await this.refresh(id, today);
      const error = this.errorsSignal().get(id);
      if (error) {
        this.reevaluationSignal.set({ done, total: ids.length, running: false, error });
        return;
      }
      done++;
      this.reevaluationSignal.set({ done, total: ids.length, running: true, error: null });
    }
    this.reevaluationSignal.set({ done, total: ids.length, running: false, error: null });
  }

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
