import { ChangeDetectionStrategy, Component, computed, ElementRef, inject, input, OnInit, output, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { FormControl, FormGroup, ReactiveFormsModule } from '@angular/forms';
import { TranslatePipe } from '@ngx-translate/core';
import { ReferenceDatastore } from '../../datastore/reference.datastore';
import { SWEETNESS_LEVELS, Sweetness, WINE_COLORS, WineColor, WineInput } from '../../models/wine';
import {
  emptyWineForm,
  WineFormField,
  toFormValue,
  toWineFormResult,
  validateWineForm,
  WineFormErrors,
  WineFormResult,
  WineFormValue,
} from '../../utils/wine-form';
import { ColorDotComponent } from '../color-dot/color-dot';

type WineFormGroup = FormGroup<{
  [K in keyof WineFormValue]: FormControl<WineFormValue[K]>;
}>;

function buildForm(value: WineFormValue): WineFormGroup {
  const control = <T>(initial: T): FormControl<T> => new FormControl<T>(initial, { nonNullable: true });
  return new FormGroup({
    name: control(value.name),
    producer: control(value.producer),
    vintage: control(value.vintage),
    color: control<WineColor>(value.color),
    quantity: control(value.quantity),
    price: control(value.price),
    country: control(value.country),
    region: control(value.region),
    appellation: control(value.appellation),
    grapes: control(value.grapes),
    drinkFrom: control(value.drinkFrom),
    drinkUntil: control(value.drinkUntil),
    alcohol: control(value.alcohol),
    sweetness: control<Sweetness | ''>(value.sweetness),
    location: control(value.location),
    notes: control(value.notes),
  });
}

/** Saisie d'un vin : champs essentiels visibles, le reste dans « Plus de détails ». */
@Component({
  selector: 'app-wine-form',
  imports: [ReactiveFormsModule, TranslatePipe, ColorDotComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  styleUrl: './wine-form.scss',
  templateUrl: './wine-form.html',
})
export class WineFormComponent implements OnInit {
  readonly mode = input<'create' | 'edit'>('create');
  readonly initial = input<WineInput | null>(null);
  /** En modification : stock en cave et dernier prix payé, éditables avec la fiche. */
  readonly stock = input<{ bottles: number; pricePaid: number | null } | null>(null);
  readonly submitLabel = input.required<string>();
  readonly busy = input(false);
  readonly submitted = output<WineFormResult>();

  private readonly references = inject(ReferenceDatastore);
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);

  protected readonly colors = WINE_COLORS;
  protected readonly sweetnessLevels = SWEETNESS_LEVELS;
  protected readonly form = buildForm(emptyWineForm());
  protected readonly errors = signal<WineFormErrors>({});
  /** Champs préremplis par Claude qu'il faut relire. */
  protected readonly uncertain = signal<ReadonlySet<WineFormField>>(new Set());
  protected readonly detailsOpen = signal(false);
  protected readonly hasErrors = computed(() => Object.keys(this.errors()).length > 0);
  protected readonly countries = this.references.countries;
  protected readonly grapes = this.references.grapes;
  private readonly country = toSignal(this.form.controls.country.valueChanges, { initialValue: '' });
  protected readonly regions = computed(() => this.references.regionsFor(this.country()));

  ngOnInit(): void {
    this.detailsOpen.set(this.mode() === 'edit');
    const initial = this.initial();
    if (initial) {
      this.form.reset(toFormValue(initial, this.stock()));
    }
  }

  /** Vide le formulaire pour une nouvelle saisie (ajout en série). */
  reset(): void {
    this.form.reset(emptyWineForm());
    this.errors.set({});
    this.uncertain.set(new Set());
    this.detailsOpen.set(false);
  }

  /** Remplit le formulaire à partir d'une lecture ; les détails s'ouvrent pour être relus. */
  fill(patch: Partial<WineFormValue>, uncertain: readonly WineFormField[]): void {
    this.form.reset({ ...emptyWineForm(), ...patch });
    this.errors.set({});
    this.uncertain.set(new Set(uncertain));
    this.detailsOpen.set(true);
  }

  protected isUncertain(field: WineFormField): boolean {
    return this.uncertain().has(field);
  }

  protected stepQuantity(delta: number): void {
    const current = Number.parseInt(this.form.controls.quantity.value, 10) || 0;
    const min = this.mode() === 'create' ? 1 : 0;
    this.form.controls.quantity.setValue(String(Math.min(999, Math.max(min, current + delta))));
  }

  protected submit(): void {
    const value = this.form.getRawValue();
    const errors = validateWineForm(value, this.mode(), new Date().getFullYear());
    this.errors.set(errors);
    if (Object.keys(errors).length) {
      this.focusFirstError();
      return;
    }
    this.submitted.emit(toWineFormResult(value));
  }

  private focusFirstError(): void {
    queueMicrotask(() => {
      const details = this.host.nativeElement.querySelector('details');
      const invalid = this.host.nativeElement.querySelector<HTMLElement>('[aria-invalid="true"]');
      if (invalid && details && details.contains(invalid)) {
        details.open = true;
      }
      invalid?.focus();
    });
  }
}
