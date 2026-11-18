import { AfterViewInit, ChangeDetectionStrategy, Component, computed, effect, ElementRef, inject, input, OnDestroy, signal, viewChild } from '@angular/core';
import { RouterLink } from '@angular/router';
import { TranslatePipe } from '@ngx-translate/core';
import { AddModeSwitchComponent } from '../../components/add-mode-switch/add-mode-switch';
import { PageHeaderComponent } from '../../components/page-header/page-header';
import { WineFormComponent } from '../../components/wine-form/wine-form';
import { AddWineDatastore } from '../../datastore/add-wine.datastore';
import { SettingsDatastore } from '../../datastore/settings.datastore';
import { ScrollService } from '../../services/scroll.service';
import { VerdictDatastore } from '../../datastore/verdict.datastore';
import { WineDatastore } from '../../datastore/wine.datastore';
import { Wine } from '../../models/wine';
import { pluralKey } from '../../utils/format';
import { readingToFormValue, uncertainFormFields, WineFormMode, WineFormResult } from '../../utils/wine-form';

interface Added {
  id: string;
  label: string;
  key: string;
  count: number;
  /** Vin mis sur la liste de souhaits : la bannière propose de le noter. */
  wish: boolean;
}

interface PendingDuplicate {
  wine: Wine;
  result: WineFormResult;
}

/**
 * Ajout d'un vin : photo d'étiquette ou description lue par Claude, ou saisie manuelle.
 * En mode souhait (`/ajouter/souhait`), le vin goûté ou repéré rejoint la liste de souhaits,
 * sans bouteille. Après enregistrement, tout se vide pour enchaîner les saisies.
 */
@Component({
  selector: 'app-ajouter-page',
  imports: [PageHeaderComponent, AddModeSwitchComponent, WineFormComponent, RouterLink, TranslatePipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  styleUrl: './ajouter-page.scss',
  templateUrl: './ajouter-page.html',
})
export class AjouterPage implements AfterViewInit, OnDestroy {
  private readonly wines = inject(WineDatastore);
  private readonly scroll = inject(ScrollService);
  private readonly verdicts = inject(VerdictDatastore);
  private readonly form = viewChild.required(WineFormComponent);
  private readonly duplicateDialog = viewChild<ElementRef<HTMLDialogElement>>('duplicateDialog');

  /** Vient de la route `ajouter/souhait`. */
  readonly wish = input(false);
  protected readonly formMode = computed<WineFormMode>(() => (this.wish() ? 'wish' : 'create'));

  protected readonly flow = inject(AddWineDatastore);
  protected readonly settings = inject(SettingsDatastore);
  protected readonly busy = signal(false);
  protected readonly added = signal<Added | null>(null);
  protected readonly duplicate = signal<PendingDuplicate | null>(null);
  protected readonly description = signal('');
  protected readonly duplicateAddKey = computed(() => pluralKey('ajouter.duplicate.add', this.duplicate()?.result.quantity ?? 1));

  constructor() {
    // Le doublon s'affiche en feuille modale : la question reste visible quelle que soit la position dans le formulaire.
    effect(() => {
      const dialog = this.duplicateDialog()?.nativeElement;
      if (!dialog) {
        return;
      }
      if (this.duplicate() && !dialog.open) {
        dialog.showModal();
      } else if (!this.duplicate() && dialog.open) {
        dialog.close();
      }
    });
  }

  /** Une lecture déjà prête (venue du magasin) remplit le formulaire dès l'ouverture. */
  ngAfterViewInit(): void {
    const reading = this.flow.reading();
    if (reading) {
      this.form().fill(readingToFormValue(reading), uncertainFormFields(reading));
    }
  }

  ngOnDestroy(): void {
    this.flow.reset();
  }

  protected async onPhoto(event: Event): Promise<void> {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    input.value = '';
    if (file) {
      await this.read(() => this.flow.readPhoto(file));
    }
  }

  protected async onDescribe(): Promise<void> {
    await this.read(() => this.flow.readDescription(this.description()));
  }

  protected onDescriptionInput(event: Event): void {
    this.description.set((event.target as HTMLTextAreaElement).value);
  }

  protected restart(): void {
    this.flow.reset();
    this.form().reset();
    this.description.set('');
  }

  protected async save(result: WineFormResult): Promise<void> {
    const readingDuplicate = this.flow.reading()?.possibleDuplicateId;
    const existing = (readingDuplicate ? this.wines.detail(readingDuplicate)?.wine : null) ?? this.wines.findDuplicate(result.input);
    if (existing) {
      this.duplicate.set({ wine: existing, result });
      return;
    }
    await this.create(result);
  }

  protected async addToExisting(): Promise<void> {
    const pending = this.duplicate();
    if (!pending) {
      return;
    }
    await this.run(async () => {
      const { wine, result } = pending;
      if (this.wish()) {
        await this.wines.setWishlist(wine.id, true);
      } else {
        await this.wines.buy(wine.id, result.pricePaid, result.quantity);
      }
      await this.linkVerdict(wine.id);
      const photo = this.flow.photoToSave();
      if (photo && !wine.labelPhotoId) {
        await this.wines.setPhoto(wine.id, photo);
      }
      const key = this.wish() ? 'ajouter.wished' : pluralKey('ajouter.addedBottles', result.quantity);
      this.done({ id: wine.id, label: wineLabel(wine), key, count: result.quantity, wish: this.wish() });
    });
  }

  protected async createAnyway(): Promise<void> {
    const pending = this.duplicate();
    if (pending) {
      await this.create(pending.result);
    }
  }

  protected cancelDuplicate(): void {
    this.duplicate.set(null);
  }

  private async read(action: () => Promise<void>): Promise<void> {
    this.added.set(null);
    this.duplicate.set(null);
    await action();
    const reading = this.flow.reading();
    if (reading) {
      this.form().fill(readingToFormValue(reading), uncertainFormFields(reading));
    }
  }

  private async create(result: WineFormResult): Promise<void> {
    await this.run(async () => {
      const photo = this.flow.photoToSave();
      const wine = this.wish()
        ? await this.wines.createWish(result.input, photo)
        : await this.wines.create(result.input, { quantity: result.quantity, pricePaid: result.pricePaid }, photo);
      await this.linkVerdict(wine.id);
      this.done({ id: wine.id, label: wineLabel(wine), key: this.wish() ? 'ajouter.wished' : 'ajouter.added', count: result.quantity, wish: this.wish() });
    });
  }

  private async linkVerdict(wineId: string): Promise<void> {
    const verdictId = this.flow.verdictId();
    if (verdictId) {
      await (this.wish() ? this.verdicts.markWished(verdictId) : this.verdicts.markBought(verdictId, wineId));
    }
  }

  private async run(action: () => Promise<void>): Promise<void> {
    this.busy.set(true);
    try {
      await action();
    } finally {
      this.busy.set(false);
    }
  }

  private done(added: Added): void {
    this.added.set(added);
    this.duplicate.set(null);
    this.restart();
    this.scroll.toTop();
  }
}

function wineLabel(wine: Wine): string {
  return [wine.name, wine.vintage].filter(Boolean).join(' ');
}
