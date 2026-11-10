import { ChangeDetectionStrategy, Component, effect, inject, input, output, signal } from '@angular/core';
import { TranslatePipe } from '@ngx-translate/core';
import { WineColor } from '../../models/wine';
import { PhotoService } from '../../services/photo.service';
import { MediaViewerComponent } from '../media-viewer/media-viewer';

/**
 * Photo Bouteille d'un vin. Touchée, elle s'affiche en plein écran, d'où on peut la remplacer.
 * Sans photo, toucher l'emplacement ouvre l'appareil photo.
 */
@Component({
  selector: 'app-label-photo',
  imports: [TranslatePipe, MediaViewerComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  styleUrl: './label-photo.scss',
  template: `
    @if (url(); as src) {
      <button type="button" class="photo" [style.--tint]="'var(--wine-' + color() + ')'" (click)="viewer.open()">
        <img [src]="src" [alt]="'photo.alt' | translate" />
        <span class="photo__zoom" aria-hidden="true">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M15 3h6v6M9 21H3v-6M21 3l-7 7M3 21l7-7" /></svg>
        </span>
      </button>
      <app-media-viewer #viewer [url]="src" mediaType="image/jpeg" [title]="'photo.alt' | translate">
        <label viewerAction>
          {{ 'photo.replace' | translate }}
          <input class="visually-hidden" type="file" accept="image/*" capture="environment" [disabled]="busy()" (change)="onPick($event); viewer.close()" />
        </label>
      </app-media-viewer>
    } @else {
      <label class="photo" [style.--tint]="'var(--wine-' + color() + ')'">
        <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round" aria-hidden="true">
          <path d="M10 2h4v4l2 3v12a1 1 0 0 1-1 1H9a1 1 0 0 1-1-1V9l2-3z" /><path d="M8 13h8" />
        </svg>
        <span class="photo__action">{{ 'photo.add' | translate }}</span>
        <input class="visually-hidden" type="file" accept="image/*" capture="environment" [disabled]="busy()" (change)="onPick($event)" />
      </label>
    }
  `,
})
export class LabelPhotoComponent {
  readonly photoId = input<string | null>(null);
  readonly color = input.required<WineColor>();
  readonly busy = input(false);
  readonly picked = output<File>();

  private readonly photos = inject(PhotoService);
  protected readonly url = signal<string | null>(null);

  constructor() {
    effect((onCleanup) => {
      const id = this.photoId();
      let objectUrl: string | null = null;
      let cancelled = false;
      this.url.set(null);
      if (id) {
        void this.photos.load(id).then((photo) => {
          if (cancelled || !photo) {
            return;
          }
          objectUrl = URL.createObjectURL(new Blob([photo.bytes], { type: photo.mediaType }));
          this.url.set(objectUrl);
        });
      }
      onCleanup(() => {
        cancelled = true;
        if (objectUrl) {
          URL.revokeObjectURL(objectUrl);
        }
      });
    });
  }

  protected onPick(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    input.value = '';
    if (file) {
      this.picked.emit(file);
    }
  }
}
