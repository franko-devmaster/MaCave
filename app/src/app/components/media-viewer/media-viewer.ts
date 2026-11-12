import { ChangeDetectionStrategy, Component, effect, ElementRef, input, viewChild } from '@angular/core';
import { TranslatePipe } from '@ngx-translate/core';
import { PDF_MEDIA_TYPE } from '../../models/wine';

/**
 * Visionneuse plein écran d'une photo ou d'un PDF. Les actions propres à l'appelant
 * (remplacer, partager) se placent en bas par projection : `<… viewerAction class="btn">`.
 */
@Component({
  selector: 'app-media-viewer',
  imports: [TranslatePipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  styleUrl: './media-viewer.scss',
  template: `
    <dialog #dialog class="viewer" [attr.aria-label]="title()">
      <div class="viewer__bar">
        <button type="button" class="viewer__close" (click)="close()" [attr.aria-label]="'info.close' | translate">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6 6 18" /></svg>
        </button>
        <span class="label viewer__title">{{ title() }}</span>
        <span class="viewer__spacer" aria-hidden="true"></span>
      </div>
      <div class="viewer__body">
        @if (mediaType() === pdfType) {
          <object #pdf class="viewer__pdf" type="application/pdf" [attr.aria-label]="title()">
            <p class="viewer__fallback">{{ 'info.pdfFallback' | translate }}</p>
          </object>
        } @else if (url(); as src) {
          <img class="viewer__image" [src]="src" [alt]="title()" />
        }
      </div>
      <div class="viewer__actions">
        <ng-content select="[viewerAction]" />
      </div>
    </dialog>
  `,
})
export class MediaViewerComponent {
  readonly url = input<string | null>(null);
  readonly mediaType = input<string | null>(null);
  readonly title = input.required<string>();

  protected readonly pdfType = PDF_MEDIA_TYPE;
  private readonly dialog = viewChild.required<ElementRef<HTMLDialogElement>>('dialog');
  private readonly pdfFrame = viewChild<ElementRef<HTMLObjectElement>>('pdf');

  constructor() {
    // L'URL est un blob créé par l'application à partir du fichier de l'utilisateur ; Angular interdit
    // de lier l'attribut data d'un <object>, on le pose donc directement sur l'élément.
    effect(() => {
      const frame = this.pdfFrame()?.nativeElement;
      const url = this.url();
      if (frame && url) {
        frame.setAttribute('data', url);
      }
    });
  }

  open(): void {
    this.dialog().nativeElement.showModal();
  }

  close(): void {
    this.dialog().nativeElement.close();
  }
}
