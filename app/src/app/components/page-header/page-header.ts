import { ChangeDetectionStrategy, Component, input } from '@angular/core';

/** En-tête d'écran : grand titre condensé, sous-titre facultatif, emplacement d'action à droite. */
@Component({
  selector: 'app-page-header',
  changeDetection: ChangeDetectionStrategy.OnPush,
  styleUrl: './page-header.scss',
  template: `
    <header class="header">
      <div class="header__row">
        <h1 class="header__title">{{ title() }}</h1>
        <ng-content select="[headerAction]" />
      </div>
      @if (subtitle()) {
        <p class="header__subtitle">{{ subtitle() }}</p>
      }
    </header>
  `,
})
export class PageHeaderComponent {
  readonly title = input.required<string>();
  readonly subtitle = input<string>();
}
