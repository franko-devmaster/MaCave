import { ChangeDetectionStrategy, Component } from '@angular/core';
import { TranslatePipe } from '@ngx-translate/core';
import { EmptyStateComponent } from '../../components/empty-state/empty-state';
import { PageHeaderComponent } from '../../components/page-header/page-header';

@Component({
  selector: 'app-accords-page',
  imports: [PageHeaderComponent, EmptyStateComponent, TranslatePipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <app-page-header [title]="'accords.title' | translate" [subtitle]="'accords.subtitle' | translate" />
    <app-empty-state [title]="'accords.empty.title' | translate" [text]="'accords.empty.text' | translate" />
  `,
})
export class AccordsPage {}
