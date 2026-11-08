import { ChangeDetectionStrategy, Component } from '@angular/core';
import { TranslatePipe } from '@ngx-translate/core';
import { EmptyStateComponent } from '../../components/empty-state/empty-state';
import { PageHeaderComponent } from '../../components/page-header/page-header';

@Component({
  selector: 'app-ajouter-page',
  imports: [PageHeaderComponent, EmptyStateComponent, TranslatePipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <app-page-header [title]="'ajouter.title' | translate" [subtitle]="'ajouter.subtitle' | translate" />
    <app-empty-state [title]="'ajouter.empty.title' | translate" [text]="'ajouter.empty.text' | translate" />
  `,
})
export class AjouterPage {}
