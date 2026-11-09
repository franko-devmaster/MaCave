import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { TranslatePipe } from '@ngx-translate/core';
import { descriptorKey } from '../../constants/descriptors';
import { TastingDatastore } from '../../datastore/tasting.datastore';

/** Historique des dégustations d'un vin ; chaque ligne ouvre la note pour la modifier. */
@Component({
  selector: 'app-tasting-list',
  imports: [RouterLink, TranslatePipe, DatePipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'tastings', role: 'region', 'aria-labelledby': 'tastings-title' },
  styleUrl: './tasting-list.scss',
  template: `
    <div class="tastings__head">
      <h2 id="tastings-title" class="label tastings__title">{{ 'fiche.tastings' | translate }}</h2>
      <a class="tastings__add" [routerLink]="['/cave', wineId(), 'noter']">{{ 'fiche.addTasting' | translate }}</a>
    </div>
    @for (tasting of tastings(); track tasting.id) {
      <a class="tasting" [routerLink]="['/cave', wineId(), 'noter']" [queryParams]="{ degustation: tasting.id }">
        <span class="tasting__score">{{ tasting.score }}<span class="tasting__max">/5</span></span>
        <span class="tasting__body">
          @if (tasting.comment) {
            <span class="tasting__comment">{{ tasting.comment }}</span>
          }
          @if (tasting.descriptors.length) {
            <span class="tasting__descriptors">
              @for (d of tasting.descriptors; track d.value; let last = $last) {
                {{ d.key ? (d.key | translate) : d.value }}{{ last ? '' : ', ' }}
              }
            </span>
          }
          <span class="tasting__meta">
            {{ tasting.date | date: 'd MMM y' }}{{ tasting.context ? ' · ' + tasting.context : '' }}{{ tasting.rebuy ? ' · ' + ('fiche.rebuy' | translate) : '' }}
          </span>
        </span>
      </a>
    } @empty {
      <p class="tastings__empty">{{ 'fiche.noTasting' | translate }}</p>
    }
  `,
})
export class TastingListComponent {
  readonly wineId = input.required<string>();

  private readonly store = inject(TastingDatastore);

  protected readonly tastings = computed(() =>
    this.store.forWine(this.wineId()).map((tasting) => ({
      ...tasting,
      descriptors: [...tasting.likedDescriptors, ...tasting.dislikedDescriptors].map((value) => ({ value, key: descriptorKey(value) })),
    })),
  );
}
