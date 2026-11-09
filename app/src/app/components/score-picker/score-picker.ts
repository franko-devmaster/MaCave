import { ChangeDetectionStrategy, Component, forwardRef, input, signal } from '@angular/core';
import { ControlValueAccessor, NG_VALUE_ACCESSOR } from '@angular/forms';
import { Score, SCORES } from '../../models/tasting';

let nextId = 0;

/** Note de 1 à 5 : boutons radio natifs, libellés aux deux extrémités. */
@Component({
  selector: 'app-score-picker',
  changeDetection: ChangeDetectionStrategy.OnPush,
  providers: [{ provide: NG_VALUE_ACCESSOR, useExisting: forwardRef(() => ScorePickerComponent), multi: true }],
  styleUrl: './score-picker.scss',
  template: `
    <div class="scores" role="radiogroup" [attr.aria-label]="label()">
      @for (score of scores; track score) {
        <label class="score" [class.score--on]="value() === score">
          <input class="visually-hidden" type="radio" [name]="name" [value]="score" [checked]="value() === score" [disabled]="disabled()" (change)="select(score)" />
          <span aria-hidden="true">{{ score }}</span>
          <span class="visually-hidden">{{ score }} / 5</span>
        </label>
      }
    </div>
    <div class="ends" aria-hidden="true">
      <span>{{ minLabel() }}</span>
      <span>{{ maxLabel() }}</span>
    </div>
  `,
})
export class ScorePickerComponent implements ControlValueAccessor {
  readonly label = input.required<string>();
  readonly minLabel = input.required<string>();
  readonly maxLabel = input.required<string>();

  protected readonly scores = SCORES;
  protected readonly name = `score-${nextId++}`;
  protected readonly value = signal<Score | null>(null);
  protected readonly disabled = signal(false);
  private onChange: (value: Score | null) => void = () => undefined;
  private onTouched: () => void = () => undefined;

  writeValue(value: Score | null): void {
    this.value.set(value);
  }

  registerOnChange(fn: (value: Score | null) => void): void {
    this.onChange = fn;
  }

  registerOnTouched(fn: () => void): void {
    this.onTouched = fn;
  }

  setDisabledState(disabled: boolean): void {
    this.disabled.set(disabled);
  }

  protected select(score: Score): void {
    this.value.set(score);
    this.onChange(score);
    this.onTouched();
  }
}
