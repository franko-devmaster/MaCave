import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { TranslatePipe } from '@ngx-translate/core';
import { isGrandCru } from '../../utils/badges';
import { CellarEntry } from '../../utils/cellar';
import { BadgeIconComponent } from '../badge-icon/badge-icon';

@Component({
  selector: 'app-wine-row',
  imports: [RouterLink, TranslatePipe, BadgeIconComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  styleUrl: './wine-row.scss',
  template: `
    @let wine = entry().wine;
    <a class="row" [class.row--empty]="entry().bottles === 0" [routerLink]="['/cave', wine.id]" [style.--bar]="'var(--wine-' + wine.color + ')'">
      <span class="row__vintage">{{ wine.vintage ?? '—' }}</span>
      <span class="row__text">
        <span class="row__name">{{ wine.name }}</span>
        @if (rebuy() && entry().bottles === 0) {
          <span class="row__meta row__meta--accent">{{ origin() }}{{ origin() ? ' · ' : '' }}{{ 'cave.rebuy' | translate }}</span>
        } @else if (origin()) {
          <span class="row__meta">{{ origin() }}</span>
        }
      </span>
      @if (star()) {
        <app-badge-icon kind="star" />
      }
      @if (grandCru()) {
        <app-badge-icon kind="grand-cru" />
      }
      <span class="row__stock">
        <span class="row__count">{{ entry().bottles }}</span>
        @if (entry().readiness; as state) {
          <app-badge-icon [kind]="state" />
        }
      </span>
    </a>
  `,
})
export class WineRowComponent {
  readonly entry = input.required<CellarEntry>();
  /** La dernière dégustation demande de racheter ce vin. */
  readonly rebuy = input(false);
  /** Vin qui vous convient le mieux (voir `starWineIds`). */
  readonly star = input(false);

  protected readonly grandCru = computed(() => isGrandCru(this.entry().wine));

  protected readonly origin = computed(() => {
    const { producer, region, country } = this.entry().wine;
    return [producer, region || country].filter(Boolean).join(' · ');
  });
}
