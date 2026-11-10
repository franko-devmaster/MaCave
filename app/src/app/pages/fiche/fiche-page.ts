import { ChangeDetectionStrategy, Component, computed, DestroyRef, inject, input, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { ColorDotComponent } from '../../components/color-dot/color-dot';
import { LabelPhotoComponent } from '../../components/label-photo/label-photo';
import { InfoAttachmentComponent } from '../../components/info-attachment/info-attachment';
import { TastingListComponent } from '../../components/tasting-list/tasting-list';
import { WineAdviceComponent } from '../../components/wine-advice/wine-advice';
import { PhotoService } from '../../services/photo.service';
import { WineDatastore } from '../../datastore/wine.datastore';
import { ChfPipe } from '../../pipes/chf.pipe';
import { formatDrinkWindow, pluralKey } from '../../utils/format';

interface Toast {
  key: string;
  movementId: string;
}

const TOAST_DURATION_MS = 6000;

@Component({
  selector: 'app-fiche-page',
  imports: [RouterLink, TranslatePipe, ColorDotComponent, LabelPhotoComponent, TastingListComponent, WineAdviceComponent, InfoAttachmentComponent, ChfPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  styleUrl: './fiche-page.scss',
  templateUrl: './fiche-page.html',
})
export class FichePage {
  readonly id = input.required<string>();
  /** Plat pour lequel ce vin a été proposé par Accords ; transmis à Noter. */
  readonly plat = input<string>();

  private readonly store = inject(WineDatastore);
  private readonly photos = inject(PhotoService);
  private readonly translate = inject(TranslateService);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);
  private toastTimer: ReturnType<typeof setTimeout> | undefined;

  protected readonly detail = computed(() => this.store.detail(this.id()));
  protected readonly drinkWindow = computed(() => {
    const wine = this.detail()?.wine;
    return wine ? formatDrinkWindow(wine.drinkFrom, wine.drinkUntil) : null;
  });
  protected readonly bottlesKey = computed(() => pluralKey('fiche.bottles', this.detail()?.bottles ?? 0));
  protected readonly subtitle = computed(() => {
    const wine = this.detail()?.wine;
    return wine ? [wine.appellation || wine.region, wine.country].filter(Boolean).join(' · ') : '';
  });
  protected readonly toast = signal<Toast | null>(null);
  protected readonly busy = signal(false);
  protected readonly photoError = signal(false);

  constructor() {
    this.destroyRef.onDestroy(() => clearTimeout(this.toastTimer));
  }

  /** −1 bouteille, puis l'écran Noter ; l'ouverture y reste annulable. */
  protected async open(): Promise<void> {
    await this.run(async () => {
      const movement = await this.store.open(this.id());
      if (movement) {
        await this.router.navigate(['/cave', this.id(), 'noter'], { queryParams: { ouverture: movement.id, plat: this.plat() } });
      }
    });
  }

  protected async buy(): Promise<void> {
    await this.run(async () => {
      const movement = await this.store.buy(this.id());
      this.showToast({ key: 'fiche.bought', movementId: movement.id });
    });
  }

  /**
   * Remplace la photo Bouteille sans appel à Claude. Si le vin n'a pas encore de fiche info,
   * l'ancienne photo peut y être conservée (cas d'une photo prise pour ses informations).
   */
  protected async changePhoto(file: File): Promise<void> {
    this.photoError.set(false);
    const wine = this.detail()?.wine;
    const keepPrevious = !!wine?.labelPhotoId && !wine.infoAttachmentId && confirm(this.translate.instant('fiche.keepAsInfo'));
    await this.run(async () => {
      try {
        await this.store.setPhoto(this.id(), await this.photos.prepare(file), keepPrevious);
      } catch {
        this.photoError.set(true);
      }
    });
  }

  protected async undo(): Promise<void> {
    const toast = this.toast();
    if (!toast) {
      return;
    }
    this.hideToast();
    await this.run(() => this.store.undoMovement(toast.movementId));
  }

  private async run(action: () => Promise<void>): Promise<void> {
    this.busy.set(true);
    try {
      await action();
    } finally {
      this.busy.set(false);
    }
  }

  private showToast(toast: Toast): void {
    clearTimeout(this.toastTimer);
    this.toast.set(toast);
    this.toastTimer = setTimeout(() => this.toast.set(null), TOAST_DURATION_MS);
  }

  private hideToast(): void {
    clearTimeout(this.toastTimer);
    this.toast.set(null);
  }
}
