import { ChangeDetectionStrategy, Component } from '@angular/core';
import { RouterLink, RouterLinkActive } from '@angular/router';
import { TranslatePipe } from '@ngx-translate/core';

@Component({
  selector: 'app-tab-bar',
  imports: [RouterLink, RouterLinkActive, TranslatePipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  styleUrl: './tab-bar.scss',
  template: `
    <nav class="tabs" [attr.aria-label]="'nav.label' | translate">
      <a class="tab" routerLink="/cave" routerLinkActive="tab--active" ariaCurrentWhenActive="page">
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linejoin="round" aria-hidden="true">
          <path d="M10 2h4v4l2 3v12a1 1 0 0 1-1 1H9a1 1 0 0 1-1-1V9l2-3z" /><path d="M8 13h8" />
        </svg>
        <span>{{ 'nav.cave' | translate }}</span>
      </a>
      <a class="tab" routerLink="/ajouter" routerLinkActive="tab--active" ariaCurrentWhenActive="page">
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linejoin="round" aria-hidden="true">
          <path d="M4 8h3l2-3h6l2 3h3v11H4z" /><circle cx="12" cy="13" r="3.5" />
        </svg>
        <span>{{ 'nav.ajouter' | translate }}</span>
      </a>
      <a class="tab" routerLink="/accords" routerLinkActive="tab--active" ariaCurrentWhenActive="page">
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" aria-hidden="true">
          <circle cx="12" cy="12" r="9" /><circle cx="12" cy="12" r="4" />
        </svg>
        <span>{{ 'nav.accords' | translate }}</span>
      </a>
      <a class="tab" routerLink="/gouts" routerLinkActive="tab--active" ariaCurrentWhenActive="page">
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
          <path d="M7 3h10l-1 7a4 4 0 0 1-8 0z" /><path d="M12 14v6M8 20h8" />
        </svg>
        <span>{{ 'nav.gouts' | translate }}</span>
      </a>
    </nav>
  `,
})
export class TabBarComponent {}
