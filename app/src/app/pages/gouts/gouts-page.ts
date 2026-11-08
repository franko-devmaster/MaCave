import { ChangeDetectionStrategy, Component } from '@angular/core';
import { TranslatePipe } from '@ngx-translate/core';
import { EmptyStateComponent } from '../../components/empty-state/empty-state';
import { PageHeaderComponent } from '../../components/page-header/page-header';

@Component({
  selector: 'app-gouts-page',
  imports: [PageHeaderComponent, EmptyStateComponent, TranslatePipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <app-page-header [title]="'gouts.title' | translate" [subtitle]="'gouts.subtitle' | translate" />
    <app-empty-state [title]="'gouts.empty.title' | translate" [text]="'gouts.empty.text' | translate" />
  `,
})
export class GoutsPage {}
