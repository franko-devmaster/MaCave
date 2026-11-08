import { DOCUMENT } from '@angular/common';
import { ChangeDetectionStrategy, Component, inject, signal, viewChild } from '@angular/core';
import { RouterLink } from '@angular/router';
import { TranslatePipe } from '@ngx-translate/core';
import { PageHeaderComponent } from '../../components/page-header/page-header';
import { WineFormComponent } from '../../components/wine-form/wine-form';
import { WineDatastore } from '../../datastore/wine.datastore';
import { WineFormResult } from '../../utils/wine-form';

interface Added {
  id: string;
  label: string;
}

/** Ajout manuel. Après enregistrement, le formulaire se vide pour enchaîner les saisies. */
@Component({
  selector: 'app-ajouter-page',
  imports: [PageHeaderComponent, WineFormComponent, RouterLink, TranslatePipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  styleUrl: './ajouter-page.scss',
  template: `
    <div class="top">
      <a class="close" routerLink="/cave" [attr.aria-label]="'ajouter.close' | translate">
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6 6 18" /></svg>
      </a>
    </div>
    <app-page-header [title]="'ajouter.title' | translate" [subtitle]="'ajouter.subtitle' | translate" />
    @if (added(); as wine) {
      <div class="added" role="status">
        <span>{{ 'ajouter.added' | translate: { name: wine.label } }}</span>
        <a class="added__link" [routerLink]="['/cave', wine.id]">{{ 'ajouter.view' | translate }}</a>
      </div>
    }
    <app-wine-form mode="create" [submitLabel]="'ajouter.submit' | translate" [busy]="busy()" (submitted)="save($event)" />
  `,
})
export class AjouterPage {
  private readonly store = inject(WineDatastore);
  private readonly document = inject(DOCUMENT);
  private readonly form = viewChild.required(WineFormComponent);

  protected readonly busy = signal(false);
  protected readonly added = signal<Added | null>(null);

  protected async save(result: WineFormResult): Promise<void> {
    this.busy.set(true);
    try {
      const wine = await this.store.create(result.input, { quantity: result.quantity, pricePaid: result.pricePaid });
      this.added.set({ id: wine.id, label: [wine.name, wine.vintage].filter(Boolean).join(' ') });
      this.form().reset();
      this.document.querySelector('main')?.scrollTo({ top: 0, behavior: 'smooth' });
    } finally {
      this.busy.set(false);
    }
  }
}
