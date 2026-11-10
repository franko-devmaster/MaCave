import { inject, Injectable, signal } from '@angular/core';
import { ClaudeFailure, failure } from '../ai/claude-errors';
import { pairingRequest } from '../ai/pairing';
import { PairingRepository } from '../db/pairing.repository';
import { PairingRequest } from '../models/advice';
import { ClaudeService } from '../services/claude.service';
import { PhotoError, PhotoService } from '../services/photo.service';
import { ProfileDatastore } from './profile.datastore';
import { TastingDatastore } from './tasting.datastore';
import { WineDatastore } from './wine.datastore';

export const PAIRING_HISTORY_SIZE = 10;

export type PairingStatus = 'idle' | 'asking' | 'done' | 'error';

/** Accords mets et vins : demande à Claude, résultat courant, journal des derniers accords. */
@Injectable({ providedIn: 'root' })
export class PairingDatastore {
  private readonly repository = inject(PairingRepository);
  private readonly claude = inject(ClaudeService);
  private readonly photos = inject(PhotoService);
  private readonly wines = inject(WineDatastore);
  private readonly tastings = inject(TastingDatastore);
  private readonly profile = inject(ProfileDatastore);

  private readonly statusSignal = signal<PairingStatus>('idle');
  private readonly errorSignal = signal<ClaudeFailure | null>(null);
  private readonly currentSignal = signal<PairingRequest | null>(null);
  private readonly historySignal = signal<PairingRequest[]>([]);
  private readonly previewSignal = signal<string | null>(null);

  readonly status = this.statusSignal.asReadonly();
  readonly error = this.errorSignal.asReadonly();
  readonly current = this.currentSignal.asReadonly();
  readonly history = this.historySignal.asReadonly();
  readonly preview = this.previewSignal.asReadonly();

  async load(): Promise<void> {
    this.historySignal.set(await this.repository.listRecent(PAIRING_HISTORY_SIZE));
  }

  /** Demande un accord pour un plat décrit, photographié, ou les deux. */
  async ask(text: string, photo: File | null): Promise<void> {
    if (!text.trim() && !photo) {
      return;
    }
    this.clear();
    this.statusSignal.set('asking');
    let photoBase64: string | null = null;
    if (photo) {
      try {
        const prepared = await this.photos.prepare(photo);
        photoBase64 = prepared.base64;
        this.previewSignal.set(URL.createObjectURL(new Blob([prepared.bytes], { type: prepared.mediaType })));
      } catch (error) {
        this.fail(failure('not-readable', error instanceof PhotoError ? error.message : undefined));
        return;
      }
    }
    const result = await this.claude.structured(
      pairingRequest({ text, photoBase64 }, this.profile.profile(), this.wines.entries(), this.tastings.tastings(), new Date().getFullYear()),
    );
    if (!result.ok) {
      this.fail(result);
      return;
    }
    const { notADish, ...answer } = result.value;
    if (notADish) {
      this.fail(failure('not-a-dish'));
      return;
    }
    const request: PairingRequest = {
      ...answer,
      dish: answer.dish || text.trim(),
      id: crypto.randomUUID(),
      query: text.trim(),
      photoId: null,
      date: new Date().toISOString(),
    };
    await this.repository.add(request);
    this.historySignal.update((history) => [request, ...history].slice(0, PAIRING_HISTORY_SIZE));
    this.currentSignal.set(request);
    this.statusSignal.set('done');
  }

  /** Réaffiche un accord du journal, sans nouvel appel. */
  show(id: string): void {
    const request = this.historySignal().find((r) => r.id === id);
    if (request) {
      this.clear();
      this.currentSignal.set(request);
      this.statusSignal.set('done');
    }
  }

  clear(): void {
    const preview = this.previewSignal();
    if (preview) {
      URL.revokeObjectURL(preview);
    }
    this.previewSignal.set(null);
    this.currentSignal.set(null);
    this.errorSignal.set(null);
    this.statusSignal.set('idle');
  }

  private fail(error: ClaudeFailure): void {
    this.errorSignal.set(error);
    this.statusSignal.set('error');
  }
}
