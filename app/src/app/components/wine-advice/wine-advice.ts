import { ChangeDetectionStrategy, Component, computed, effect, inject, input, untracked } from '@angular/core';
import { TranslatePipe } from '@ngx-translate/core';
import { AdviceDatastore } from '../../datastore/advice.datastore';
import { SettingsDatastore } from '../../datastore/settings.datastore';
import { WineDatastore } from '../../datastore/wine.datastore';

/** Bloc « Conseil » de la fiche : moment, service et plats, préparé par Claude une fois par vin. */
@Component({
  selector: 'app-wine-advice',
  imports: [TranslatePipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  styleUrl: './wine-advice.scss',
  template: `
    @if (settings.hasApiKey()) {
      <section class="advice" aria-labelledby="advice-title" data-testid="wine-advice">
        <p id="advice-title" class="advice__label">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M12 3v4M12 17v4M3 12h4M17 12h4M6 6l2.5 2.5M15.5 15.5 18 18M6 18l2.5-2.5M15.5 8.5 18 6" /></svg>
          {{ 'advice.title' | translate }}
        </p>
        @if (loading()) {
          <p class="advice__status" role="status"><span class="spinner" aria-hidden="true"></span>{{ 'advice.loading' | translate }}</p>
        } @else if (error(); as e) {
          <p class="advice__error" role="alert">{{ 'ai.errors.' + e.kind | translate: { detail: e.detail ?? '' } }}</p>
          <button type="button" class="advice__action" (click)="refresh()">{{ 'gouts.retry' | translate }}</button>
        } @else if (advice(); as a) {
          @if (a.status !== 'inconnu') {
            <p class="advice__state">{{ 'advice.status.' + a.status | translate }}</p>
          }
          <p class="advice__text">{{ a.text }}</p>
          @if (a.infoSummary) {
            <p class="advice__source">{{ 'advice.fromInfo' | translate: { summary: a.infoSummary } }}</p>
          }
          <button type="button" class="advice__action" (click)="refresh()">{{ 'advice.refresh' | translate }}</button>
        }
      </section>
    }
  `,
})
export class WineAdviceComponent {
  readonly wineId = input.required<string>();

  private readonly store = inject(AdviceDatastore);
  private readonly wines = inject(WineDatastore);
  protected readonly settings = inject(SettingsDatastore);

  protected readonly advice = computed(() => this.wines.detail(this.wineId())?.wine.advice ?? null);
  /** Une nouvelle fiche info rend le conseil périmé : il est redemandé avec elle. */
  private readonly infoId = computed(() => this.wines.detail(this.wineId())?.wine.infoAttachmentId ?? null);
  protected readonly loading = computed(() => this.store.loading().has(this.wineId()));
  protected readonly error = computed(() => this.store.errors().get(this.wineId()) ?? null);

  constructor() {
    effect(() => {
      const id = this.wineId();
      this.infoId();
      untracked(() => void this.store.ensure(id));
    });
  }

  protected refresh(): void {
    void this.store.refresh(this.wineId());
  }
}
