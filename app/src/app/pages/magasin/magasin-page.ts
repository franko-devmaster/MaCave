import { ChangeDetectionStrategy, Component, computed, inject, OnDestroy, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { TranslatePipe } from '@ngx-translate/core';
import { AddModeSwitchComponent } from '../../components/add-mode-switch/add-mode-switch';
import { PageHeaderComponent } from '../../components/page-header/page-header';
import { SettingsDatastore } from '../../datastore/settings.datastore';
import { VerdictDatastore } from '../../datastore/verdict.datastore';
import { WineDatastore } from '../../datastore/wine.datastore';
import { ChfPipe } from '../../pipes/chf.pipe';

@Component({
  selector: 'app-magasin-page',
  imports: [PageHeaderComponent, AddModeSwitchComponent, RouterLink, TranslatePipe, ChfPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  styleUrl: './magasin-page.scss',
  templateUrl: './magasin-page.html',
})
export class MagasinPage implements OnDestroy {
  protected readonly store = inject(VerdictDatastore);
  protected readonly settings = inject(SettingsDatastore);
  private readonly wines = inject(WineDatastore);
  private readonly router = inject(Router);

  protected readonly description = signal('');
  /** Vin identique déjà en cave, s'il y en a un. */
  protected readonly duplicate = computed(() => {
    const id = this.store.current()?.wineIdentified.possibleDuplicateId;
    return id ? (this.wines.detail(id) ?? null) : null;
  });

  ngOnDestroy(): void {
    this.store.clear();
  }

  protected async onPhoto(event: Event): Promise<void> {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    input.value = '';
    if (file) {
      await this.store.checkPhoto(file);
    }
  }

  protected onDescriptionInput(event: Event): void {
    this.description.set((event.target as HTMLTextAreaElement).value);
  }

  protected async describe(): Promise<void> {
    await this.store.checkDescription(this.description());
  }

  protected async buy(): Promise<void> {
    this.store.buy();
    await this.router.navigate(['/ajouter'], { replaceUrl: true });
  }

  protected async pass(): Promise<void> {
    await this.store.pass();
    this.description.set('');
  }
}
