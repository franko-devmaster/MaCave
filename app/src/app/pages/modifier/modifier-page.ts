import { ChangeDetectionStrategy, Component, computed, inject, input, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { PageHeaderComponent } from '../../components/page-header/page-header';
import { WineFormComponent } from '../../components/wine-form/wine-form';
import { WineDatastore } from '../../datastore/wine.datastore';
import { WineFormResult } from '../../utils/wine-form';

@Component({
  selector: 'app-modifier-page',
  imports: [PageHeaderComponent, WineFormComponent, RouterLink, TranslatePipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  styleUrl: './modifier-page.scss',
  template: `
    <div class="top">
      <a class="back" [routerLink]="['/cave', id()]">
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m15 5-7 7 7 7" /></svg>
        {{ 'modifier.back' | translate }}
      </a>
    </div>
    <app-page-header [title]="'modifier.title' | translate" />
    @if (wine(); as current) {
      <app-wine-form mode="edit" [initial]="current" [submitLabel]="'modifier.submit' | translate" [busy]="busy()" (submitted)="save($event)">
        <button type="button" class="btn btn--quiet delete" [disabled]="busy()" (click)="remove()">{{ 'modifier.delete' | translate }}</button>
      </app-wine-form>
    } @else {
      <p class="not-found">{{ 'fiche.notFound' | translate }}</p>
    }
  `,
})
export class ModifierPage {
  readonly id = input.required<string>();

  private readonly store = inject(WineDatastore);
  private readonly router = inject(Router);
  private readonly translate = inject(TranslateService);

  protected readonly wine = computed(() => this.store.detail(this.id())?.wine ?? null);
  protected readonly busy = signal(false);

  protected async save(result: WineFormResult): Promise<void> {
    this.busy.set(true);
    try {
      await this.store.update(this.id(), result.input);
      await this.router.navigate(['/cave', this.id()], { replaceUrl: true });
    } finally {
      this.busy.set(false);
    }
  }

  protected async remove(): Promise<void> {
    const wine = this.wine();
    if (!wine || !confirm(this.translate.instant('modifier.deleteConfirm', { name: wine.name }))) {
      return;
    }
    this.busy.set(true);
    try {
      await this.store.remove(this.id());
      await this.router.navigate(['/cave'], { replaceUrl: true });
    } finally {
      this.busy.set(false);
    }
  }
}
