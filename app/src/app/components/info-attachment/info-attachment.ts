import { ChangeDetectionStrategy, Component, computed, effect, ElementRef, inject, input, signal, viewChild } from '@angular/core';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { WineDatastore } from '../../datastore/wine.datastore';
import { PDF_MEDIA_TYPE, Photo } from '../../models/wine';
import { FileShareService } from '../../services/file-share.service';
import { PhotoService } from '../../services/photo.service';
import { formatBytes } from '../../utils/format';

/** Fiche info d'un vin : une photo ou un PDF (descriptif QoQa…), sans aucun appel à Claude. */
@Component({
  selector: 'app-info-attachment',
  imports: [TranslatePipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  styleUrl: './info-attachment.scss',
  templateUrl: './info-attachment.html',
})
export class InfoAttachmentComponent {
  readonly wineId = input.required<string>();
  readonly attachmentId = input<string | null>(null);

  private readonly wines = inject(WineDatastore);
  private readonly photos = inject(PhotoService);
  private readonly share = inject(FileShareService);
  private readonly translate = inject(TranslateService);
  private readonly dialog = viewChild<ElementRef<HTMLDialogElement>>('viewer');
  private readonly pdfFrame = viewChild<ElementRef<HTMLObjectElement>>('pdf');

  protected readonly file = signal<Photo | null>(null);
  protected readonly url = signal<string | null>(null);
  protected readonly busy = signal(false);
  protected readonly error = signal(false);
  protected readonly isPdf = computed(() => this.file()?.mediaType === PDF_MEDIA_TYPE);
  protected readonly size = computed(() => formatBytes(this.file()?.bytes.byteLength ?? 0));

  constructor() {
    effect((onCleanup) => {
      const id = this.attachmentId();
      let objectUrl: string | null = null;
      let cancelled = false;
      this.file.set(null);
      this.url.set(null);
      if (id) {
        void this.photos.load(id).then((file) => {
          if (cancelled || !file) {
            return;
          }
          objectUrl = URL.createObjectURL(new Blob([file.bytes], { type: file.mediaType }));
          this.file.set(file);
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
    // L'URL est un blob créé ici à partir du fichier de l'utilisateur ; Angular interdit de lier
    // l'attribut data d'un <object>, on le pose donc directement sur l'élément.
    effect(() => {
      const frame = this.pdfFrame()?.nativeElement;
      const url = this.url();
      if (frame && url) {
        frame.setAttribute('data', url);
      }
    });
  }

  protected async onPick(event: Event): Promise<void> {
    const input = event.target as HTMLInputElement;
    const picked = input.files?.[0];
    input.value = '';
    if (!picked) {
      return;
    }
    this.error.set(false);
    this.busy.set(true);
    try {
      await this.wines.setInfo(this.wineId(), await this.photos.prepareInfo(picked));
    } catch {
      this.error.set(true);
    } finally {
      this.busy.set(false);
    }
  }

  protected async remove(): Promise<void> {
    if (confirm(this.translate.instant('info.removeConfirm'))) {
      await this.wines.removeInfo(this.wineId());
    }
  }

  protected open(): void {
    this.dialog()?.nativeElement.showModal();
  }

  protected close(): void {
    this.dialog()?.nativeElement.close();
  }

  protected async shareFile(): Promise<void> {
    const file = this.file();
    if (file) {
      const name = file.mediaType === PDF_MEDIA_TYPE ? 'fiche-info.pdf' : 'fiche-info.jpg';
      await this.share.deliver(new File([file.bytes], name, { type: file.mediaType }));
    }
  }
}
