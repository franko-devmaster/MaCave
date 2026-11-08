import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { TranslatePipe } from '@ngx-translate/core';
import { CellarEntry } from '../../utils/cellar';

@Component({
  selector: 'app-wine-row',
  imports: [RouterLink, TranslatePipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  styleUrl: './wine-row.scss',
  template: `
    @let wine = entry().wine;
    <a class="row" [class.row--empty]="entry().bottles === 0" [routerLink]="['/cave', wine.id]" [style.--bar]="'var(--wine-' + wine.color + ')'">
      <span class="row__vintage">{{ wine.vintage ?? '—' }}</span>
      <span class="row__text">
        <span class="row__name">{{ wine.name }}</span>
        @if (entry().drinkNow) {
          <span class="row__meta row__meta--accent">{{ origin() }}{{ origin() ? ' · ' : '' }}{{ 'cave.drinkNow' | translate }}</span>
        } @else if (origin()) {
          <span class="row__meta">{{ origin() }}</span>
        }
      </span>
      <span class="row__count">{{ entry().bottles }}</span>
    </a>
  `,
})
export class WineRowComponent {
  readonly entry = input.required<CellarEntry>();

  protected readonly origin = computed(() => {
    const { producer, region, country } = this.entry().wine;
    return [producer, region || country].filter(Boolean).join(' · ');
  });
}
