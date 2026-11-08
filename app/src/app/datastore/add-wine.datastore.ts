import { inject, Injectable, signal } from '@angular/core';
import { ClaudeFailure, failure } from '../ai/claude-errors';
import { LabelReading, labelReadingRequest, LabelSource } from '../ai/label-reading';
import { PhotoInput } from '../models/wine';
import { ClaudeService } from '../services/claude.service';
import { PhotoError, PhotoService, PreparedPhoto } from '../services/photo.service';
import { WineDatastore } from './wine.datastore';

export type ReadingStatus = 'idle' | 'reading' | 'done' | 'error';

/** État du flux « Ajouter » augmenté : photo ou description, lecture par Claude, résultat à vérifier. */
@Injectable({ providedIn: 'root' })
export class AddWineDatastore {
  private readonly claude = inject(ClaudeService);
  private readonly photos = inject(PhotoService);
  private readonly wines = inject(WineDatastore);

  private readonly statusSignal = signal<ReadingStatus>('idle');
  private readonly errorSignal = signal<ClaudeFailure | null>(null);
  private readonly readingSignal = signal<LabelReading | null>(null);
  private readonly photoSignal = signal<PreparedPhoto | null>(null);
  private readonly previewSignal = signal<string | null>(null);

  readonly status = this.statusSignal.asReadonly();
  readonly error = this.errorSignal.asReadonly();
  readonly reading = this.readingSignal.asReadonly();
  readonly preview = this.previewSignal.asReadonly();

  /** Photo à enregistrer avec le vin, sans la copie base64 destinée à l'API. */
  photoToSave(): PhotoInput | null {
    const photo = this.photoSignal();
    return photo ? { bytes: photo.bytes, mediaType: photo.mediaType, width: photo.width, height: photo.height } : null;
  }

  async readPhoto(file: File): Promise<void> {
    this.reset();
    this.statusSignal.set('reading');
    let photo: PreparedPhoto;
    try {
      photo = await this.photos.prepare(file);
    } catch (error) {
      this.fail(failure('not-readable', error instanceof PhotoError ? error.message : undefined));
      return;
    }
    this.photoSignal.set(photo);
    this.previewSignal.set(URL.createObjectURL(new Blob([photo.bytes], { type: photo.mediaType })));
    await this.read({ kind: 'photo', base64: photo.base64 });
  }

  async readDescription(description: string): Promise<void> {
    this.reset();
    if (!description.trim()) {
      return;
    }
    this.statusSignal.set('reading');
    await this.read({ kind: 'text', description });
  }

  reset(): void {
    const preview = this.previewSignal();
    if (preview) {
      URL.revokeObjectURL(preview);
    }
    this.statusSignal.set('idle');
    this.errorSignal.set(null);
    this.readingSignal.set(null);
    this.photoSignal.set(null);
    this.previewSignal.set(null);
  }

  private async read(source: LabelSource): Promise<void> {
    const result = await this.claude.structured(labelReadingRequest(source, this.wines.wines(), new Date().getFullYear()));
    if (!result.ok) {
      this.fail(result);
      return;
    }
    if (result.value.notReadable) {
      this.fail(failure('not-readable'));
      return;
    }
    this.readingSignal.set(result.value);
    this.statusSignal.set('done');
  }

  private fail(error: ClaudeFailure): void {
    this.errorSignal.set(error);
    this.statusSignal.set('error');
  }
}
