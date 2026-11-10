import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { TranslatePipe } from '@ngx-translate/core';

/** Bascule de l'onglet Ajouter : vin acheté ou vin vu en magasin. */
@Component({
  selector: 'app-add-mode-switch',
  imports: [RouterLink, TranslatePipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  styles: `
    .modes {
      display: grid;
      grid-template-columns: repeat(2, minmax(0, 1fr));
      margin: var(--space-4) var(--gutter) 0;
      padding: 3px;
      border-radius: var(--radius-md);
      background: var(--color-surface);
    }
    a {
      display: flex;
      align-items: center;
      justify-content: center;
      min-height: var(--touch-target);
      border-radius: var(--radius-sm);
      font-size: 14px;
      font-weight: 500;
      color: var(--color-muted);
    }
    .on {
      background: var(--color-bg);
      color: var(--color-ink);
      font-weight: 600;
      box-shadow: 0 1px 2px rgb(23 18 15 / 12%);
    }
  `,
  template: `
    <nav class="modes" [attr.aria-label]="'addMode.label' | translate">
      <a routerLink="/ajouter" [replaceUrl]="true" [class.on]="active() === 'achat'" [attr.aria-current]="active() === 'achat' ? 'page' : null">
        {{ 'addMode.bought' | translate }}
      </a>
      <a routerLink="/magasin" [replaceUrl]="true" [class.on]="active() === 'magasin'" [attr.aria-current]="active() === 'magasin' ? 'page' : null">
        {{ 'addMode.store' | translate }}
      </a>
    </nav>
  `,
})
export class AddModeSwitchComponent {
  readonly active = input.required<'achat' | 'magasin'>();
}
