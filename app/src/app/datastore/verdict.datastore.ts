import { inject, Injectable, signal } from '@angular/core';
import { ClaudeFailure, failure } from '../ai/claude-errors';
import { LabelSource } from '../ai/label-reading';
import { storeVerdictRequest } from '../ai/store-verdict';
import { VerdictRepository } from '../db/verdict.repository';
import { Verdict } from '../models/advice';
import { ClaudeService } from '../services/claude.service';
import { PhotoError, PhotoService, PreparedPhoto } from '../services/photo.service';
import { AddWineDatastore } from './add-wine.datastore';
import { ProfileDatastore } from './profile.datastore';
import { TastingDatastore } from './tasting.datastore';
import { WineDatastore } from './wine.datastore';

export type VerdictStatus = 'idle' | 'reading' | 'done' | 'error';

/** En magasin : verdict d'affinité sur un vin inconnu, journalisé pour calibrer les suivants. */
@Injectable({ providedIn: 'root' })
export class VerdictDatastore {
  private readonly repository = inject(VerdictRepository);
  private readonly claude = inject(ClaudeService);
  private readonly photos = inject(PhotoService);
  private readonly wines = inject(WineDatastore);
  private readonly tastings = inject(TastingDatastore);
  private readonly profile = inject(ProfileDatastore);
  private readonly addWine = inject(AddWineDatastore);

  private readonly verdictsSignal = signal<Verdict[]>([]);
  private readonly statusSignal = signal<VerdictStatus>('idle');
  private readonly errorSignal = signal<ClaudeFailure | null>(null);
  private readonly currentSignal = signal<Verdict | null>(null);
  private readonly previewSignal = signal<string | null>(null);
  private photo: PreparedPhoto | null = null;

  readonly verdicts = this.verdictsSignal.asReadonly();
  readonly status = this.statusSignal.asReadonly();
  readonly error = this.errorSignal.asReadonly();
  readonly current = this.currentSignal.asReadonly();
  readonly preview = this.previewSignal.asReadonly();

  async load(): Promise<void> {
    this.verdictsSignal.set(await this.repository.list());
  }

  async checkPhoto(file: File): Promise<void> {
    this.clear();
    this.statusSignal.set('reading');
    try {
      this.photo = await this.photos.prepare(file);
    } catch (error) {
      this.fail(failure('not-readable', error instanceof PhotoError ? error.message : undefined));
      return;
    }
    this.previewSignal.set(URL.createObjectURL(new Blob([this.photo.bytes], { type: this.photo.mediaType })));
    await this.check({ kind: 'photo', base64: this.photo.base64 });
  }

  async checkDescription(description: string): Promise<void> {
    if (!description.trim()) {
      return;
    }
    this.clear();
    this.statusSignal.set('reading');
    await this.check({ kind: 'text', description });
  }

  /** « Je passe » : l'issue est notée, l'écran revient à la saisie. */
  async pass(): Promise<void> {
    const verdict = this.currentSignal();
    if (verdict) {
      await this.setOutcome(verdict.id, { outcome: 'passe' });
    }
    this.clear();
  }

  /** « J'achète » : transmet la lecture, la photo et le prix au flux Ajouter. */
  buy(): void {
    const verdict = this.currentSignal();
    if (verdict) {
      this.addWine.prefill(verdict.wineIdentified, this.photo, verdict.id);
    }
  }

  /** Appelé une fois le vin enregistré en cave : relie le verdict au vin pour la calibration. */
  async markBought(verdictId: string, wineId: string): Promise<void> {
    await this.setOutcome(verdictId, { outcome: 'achete', boughtWineId: wineId });
  }

  clear(): void {
    const preview = this.previewSignal();
    if (preview) {
      URL.revokeObjectURL(preview);
    }
    this.photo = null;
    this.previewSignal.set(null);
    this.currentSignal.set(null);
    this.errorSignal.set(null);
    this.statusSignal.set('idle');
  }

  private async check(source: LabelSource): Promise<void> {
    const result = await this.claude.structured(
      storeVerdictRequest(
        source,
        this.profile.profile(),
        this.wines.entries(),
        this.wines.wines(),
        this.tastings.tastings(),
        this.verdictsSignal(),
        new Date().getFullYear(),
      ),
    );
    if (!result.ok) {
      this.fail(result);
      return;
    }
    if (result.value.wine.notReadable) {
      this.fail(failure('not-readable'));
      return;
    }
    const verdict: Verdict = {
      id: crypto.randomUUID(),
      wineIdentified: result.value.wine,
      affinity: result.value.affinity,
      level: result.value.level,
      reasons: result.value.reasons,
      outcome: null,
      boughtWineId: null,
      date: new Date().toISOString(),
    };
    await this.repository.add(verdict);
    this.verdictsSignal.update((verdicts) => [...verdicts, verdict]);
    this.currentSignal.set(verdict);
    this.statusSignal.set('done');
  }

  private async setOutcome(id: string, changes: Pick<Verdict, 'outcome'> & Partial<Pick<Verdict, 'boughtWineId'>>): Promise<void> {
    await this.repository.update(id, changes);
    this.verdictsSignal.update((verdicts) => verdicts.map((v) => (v.id === id ? { ...v, ...changes } : v)));
  }

  private fail(error: ClaudeFailure): void {
    this.errorSignal.set(error);
    this.statusSignal.set('error');
  }
}
