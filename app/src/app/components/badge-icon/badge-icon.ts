import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { TranslatePipe } from '@ngx-translate/core';

export type BadgeKind = 'soon' | 'ready' | 'star' | 'grand-cru';

/** Indicateur d'un vin : puce rouge (à boire rapidement) ou verte (prêt à boire), étoile (vos goûts), couronne (grand cru). */
@Component({
  selector: 'app-badge-icon',
  imports: [TranslatePipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { '[class]': "'badge badge--' + kind()" },
  styles: `
    :host {
      display: inline-flex;
      color: var(--color-ink);
    }

    :host(.badge--star) {
      color: var(--color-accent);
    }

    .badge__icon {
      display: inline-flex;
    }

    .badge__dot {
      width: 10px;
      height: 10px;
      border-radius: 50%;
      background: var(--color-ready);
    }

    :host(.badge--soon) .badge__dot {
      background: var(--color-soon);
    }
  `,
  template: `
    @if (kind() === 'soon' || kind() === 'ready') {
      <span class="badge__dot" role="img" [attr.aria-label]="'cave.badges.' + kind() | translate" [attr.title]="'cave.badges.' + kind() | translate"></span>
    } @else {
      <span class="badge__icon" role="img" [attr.aria-label]="'cave.badges.' + kind() | translate" [attr.title]="'cave.badges.' + kind() | translate">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
          @if (kind() === 'star') {
            <path d="m12 3 2.8 5.7 6.2.9-4.5 4.4 1.1 6.2L12 17.3l-5.6 2.9 1.1-6.2L3 9.6l6.2-.9z" />
          } @else {
            <path d="m3 7 4 4 5-6 5 6 4-4-2 11H5z" /><path d="M5 21h14" />
          }
        </svg>
      </span>
    }
  `,
})
export class BadgeIconComponent {
  readonly kind = input.required<BadgeKind>();
}
