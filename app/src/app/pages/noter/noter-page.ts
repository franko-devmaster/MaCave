import { ChangeDetectionStrategy, Component, computed, inject, input, OnInit, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormControl, FormGroup, ReactiveFormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { ChipGroupComponent } from '../../components/chip-group/chip-group';
import { ScorePickerComponent } from '../../components/score-picker/score-picker';
import { DISLIKED_DESCRIPTORS, LIKED_DESCRIPTORS } from '../../constants/descriptors';
import { TastingDatastore } from '../../datastore/tasting.datastore';
import { WineDatastore } from '../../datastore/wine.datastore';
import { Score } from '../../models/tasting';
import { pluralKey } from '../../utils/format';

/**
 * Noter une dégustation. Trois entrées : après « J'en ouvre une » (paramètre `ouverture`),
 * depuis la fiche sans ouvrir de bouteille, ou pour modifier une note (paramètre `degustation`).
 */
@Component({
  selector: 'app-noter-page',
  imports: [ReactiveFormsModule, RouterLink, TranslatePipe, ScorePickerComponent, ChipGroupComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  styleUrl: './noter-page.scss',
  templateUrl: './noter-page.html',
})
export class NoterPage implements OnInit {
  readonly id = input.required<string>();
  /** Mouvement de stock créé par « J'en ouvre une », annulable depuis cet écran. */
  readonly ouverture = input<string>();
  /** Dégustation à modifier. */
  readonly degustation = input<string>();
  /** Plat venant d'Accords, repris dans « Avec quoi, avec qui ». */
  readonly plat = input<string>();

  private readonly wines = inject(WineDatastore);
  private readonly tastings = inject(TastingDatastore);
  private readonly router = inject(Router);
  private readonly translate = inject(TranslateService);

  protected readonly liked = LIKED_DESCRIPTORS;
  protected readonly disliked = DISLIKED_DESCRIPTORS;
  protected readonly form = new FormGroup({
    score: new FormControl<Score | null>(null),
    liked: new FormControl<string[]>([], { nonNullable: true }),
    disliked: new FormControl<string[]>([], { nonNullable: true }),
    comment: new FormControl('', { nonNullable: true }),
    context: new FormControl('', { nonNullable: true }),
    rebuy: new FormControl(false, { nonNullable: true }),
  });
  protected readonly detail = computed(() => this.wines.detail(this.id()));
  protected readonly editing = computed(() => !!this.degustation() && !!this.tastings.get(this.degustation() ?? ''));
  protected readonly remainingKey = computed(() => pluralKey('noter.remaining', this.detail()?.bottles ?? 0));
  protected readonly scoreMissing = signal(false);
  protected readonly busy = signal(false);

  constructor() {
    this.form.controls.score.valueChanges.pipe(takeUntilDestroyed()).subscribe(() => this.scoreMissing.set(false));
  }

  ngOnInit(): void {
    const tasting = this.tastings.get(this.degustation() ?? '');
    if (!tasting && this.plat()) {
      this.form.controls.context.setValue(this.plat() ?? '');
    }
    if (tasting) {
      this.form.reset({
        score: tasting.score,
        liked: tasting.likedDescriptors,
        disliked: tasting.dislikedDescriptors,
        comment: tasting.comment,
        context: tasting.context,
        rebuy: tasting.rebuy,
      });
    }
  }

  protected async save(): Promise<void> {
    const value = this.form.getRawValue();
    if (value.score === null) {
      this.scoreMissing.set(true);
      return;
    }
    const input = {
      wineId: this.id(),
      score: value.score,
      likedDescriptors: value.liked,
      dislikedDescriptors: value.disliked,
      comment: value.comment.trim(),
      context: value.context.trim(),
      rebuy: value.rebuy,
    };
    await this.run(async () => {
      const editing = this.degustation();
      if (editing && this.editing()) {
        await this.tastings.update(editing, input);
      } else {
        await this.tastings.add(input);
      }
      await this.backToFiche();
    });
  }

  protected async cancelOpening(): Promise<void> {
    const movementId = this.ouverture();
    if (!movementId) {
      return;
    }
    await this.run(async () => {
      await this.wines.undoMovement(movementId);
      await this.backToFiche();
    });
  }

  protected async remove(): Promise<void> {
    const tastingId = this.degustation();
    if (!tastingId || !confirm(this.translate.instant('noter.deleteConfirm'))) {
      return;
    }
    await this.run(async () => {
      await this.tastings.remove(tastingId);
      await this.backToFiche();
    });
  }

  private backToFiche(): Promise<boolean> {
    return this.router.navigate(['/cave', this.id()], { replaceUrl: true });
  }

  private async run(action: () => Promise<void>): Promise<void> {
    this.busy.set(true);
    try {
      await action();
    } finally {
      this.busy.set(false);
    }
  }
}
