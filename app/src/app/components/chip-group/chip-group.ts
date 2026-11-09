import { ChangeDetectionStrategy, Component, computed, forwardRef, input, signal } from '@angular/core';
import { ControlValueAccessor, NG_VALUE_ACCESSOR } from '@angular/forms';
import { TranslatePipe } from '@ngx-translate/core';
import { descriptorKey } from '../../constants/descriptors';

/** Choix multiple en puces ; on peut ajouter une valeur libre. */
@Component({
  selector: 'app-chip-group',
  imports: [TranslatePipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  providers: [{ provide: NG_VALUE_ACCESSOR, useExisting: forwardRef(() => ChipGroupComponent), multi: true }],
  styleUrl: './chip-group.scss',
  template: `
    <div class="chips" role="group" [attr.aria-label]="label()">
      @for (chip of chips(); track chip.value) {
        <button
          type="button"
          class="chip"
          [class.chip--on]="chip.selected"
          [class.chip--negative]="negative()"
          [attr.aria-pressed]="chip.selected"
          (click)="toggle(chip.value)"
        >
          {{ chip.key ? (chip.key | translate) : chip.value }}
        </button>
      }
      @if (adding()) {
        <span class="add">
          <input
            class="add__input"
            type="text"
            enterkeyhint="done"
            autocomplete="off"
            [attr.aria-label]="addLabel()"
            [value]="draft()"
            (input)="onDraft($event)"
            (keydown.enter)="$event.preventDefault(); add()"
            (blur)="add()"
          />
        </span>
      } @else {
        <button type="button" class="chip chip--add" (click)="adding.set(true)">+ {{ addLabel() }}</button>
      }
    </div>
  `,
})
export class ChipGroupComponent implements ControlValueAccessor {
  readonly options = input.required<readonly string[]>();
  readonly label = input.required<string>();
  readonly addLabel = input.required<string>();
  readonly negative = input(false);

  protected readonly selected = signal<readonly string[]>([]);
  protected readonly adding = signal(false);
  protected readonly draft = signal('');
  private onChange: (value: string[]) => void = () => undefined;
  private onTouched: () => void = () => undefined;

  /** Options prédéfinies puis valeurs libres déjà choisies. */
  protected readonly chips = computed(() => {
    const selected = new Set(this.selected());
    const custom = this.selected().filter((value) => !this.options().includes(value));
    return [...this.options(), ...custom].map((value) => ({ value, key: descriptorKey(value), selected: selected.has(value) }));
  });

  writeValue(value: string[] | null): void {
    this.selected.set(value ?? []);
  }

  registerOnChange(fn: (value: string[]) => void): void {
    this.onChange = fn;
  }

  registerOnTouched(fn: () => void): void {
    this.onTouched = fn;
  }

  protected onDraft(event: Event): void {
    this.draft.set((event.target as HTMLInputElement).value);
  }

  protected toggle(value: string): void {
    const current = this.selected();
    this.emit(current.includes(value) ? current.filter((v) => v !== value) : [...current, value]);
  }

  protected add(): void {
    const value = this.draft().trim();
    this.adding.set(false);
    this.draft.set('');
    if (value && !this.selected().includes(value)) {
      this.emit([...this.selected(), value]);
    }
  }

  private emit(value: string[]): void {
    this.selected.set(value);
    this.onChange(value);
    this.onTouched();
  }
}
