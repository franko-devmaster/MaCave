import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { TranslatePipe } from '@ngx-translate/core';

export type BadgeKind = 'soon' | 'ready' | 'star' | 'grand-cru';

/** Indicateur d'un vin dans la liste : à boire rapidement, prêt, selon vos goûts, grand cru. */
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

    .badge__icon {
      display: inline-flex;
    }

    :host(.badge--soon),
    :host(.badge--star) {
      color: var(--color-accent);
    }
  `,
  template: `
    <span
      class="badge__icon"
      role="img"
      [attr.aria-label]="'cave.badges.' + kind() | translate"
      [attr.title]="'cave.badges.' + kind() | translate"
    >
      <svg
        width="18"
        height="18"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        stroke-width="1.75"
        stroke-linecap="round"
        stroke-linejoin="round"
        aria-hidden="true"
      >
        @switch (kind()) {
          @case ('soon') {
            <path
              d="M6 2h12M6 22h12M7 2v4.2a2 2 0 0 0 .6 1.4L12 12l4.4-4.4a2 2 0 0 0 .6-1.4V2M17 22v-4.2a2 2 0 0 0-.6-1.4L12 12l-4.4 4.4a2 2 0 0 0-.6 1.4V22"
            />
          }
          @case ('ready') {
            <path d="M7 3h10l-1 7a4 4 0 0 1-8 0z" />
            <path d="M12 14v6M8 20h8" />
          }
          @case ('star') {
            <path d="m12 3 2.8 5.7 6.2.9-4.5 4.4 1.1 6.2L12 17.3l-5.6 2.9 1.1-6.2L3 9.6l6.2-.9z" />
          }
          @case ('grand-cru') {
            <path d="m3 7 4 4 5-6 5 6 4-4-2 11H5z" />
            <path d="M5 21h14" />
          }
        }
      </svg>
    </span>
  `,
})
export class BadgeIconComponent {
  readonly kind = input.required<BadgeKind>();
}
