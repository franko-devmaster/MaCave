import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { TranslatePipe } from '@ngx-translate/core';
import { ColorDotComponent } from '../../components/color-dot/color-dot';
import { PageHeaderComponent } from '../../components/page-header/page-header';
import { PairingDatastore } from '../../datastore/pairing.datastore';
import { SettingsDatastore } from '../../datastore/settings.datastore';
import { WineDatastore, WineDetail } from '../../datastore/wine.datastore';
import { PairingChoice } from '../../models/advice';

interface ResolvedChoice {
  detail: WineDetail;
  reason: string;
}

@Component({
  selector: 'app-accords-page',
  imports: [PageHeaderComponent, ColorDotComponent, RouterLink, TranslatePipe, DatePipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  styleUrl: './accords-page.scss',
  templateUrl: './accords-page.html',
})
export class AccordsPage {
  protected readonly store = inject(PairingDatastore);
  protected readonly settings = inject(SettingsDatastore);
  private readonly wines = inject(WineDatastore);

  protected readonly dish = signal('');

  /** Résultat courant avec les vins retrouvés dans la cave ; un vin supprimé depuis disparaît. */
  protected readonly result = computed(() => {
    const current = this.store.current();
    if (!current) {
      return null;
    }
    const pick = current.topPick ? this.resolve([current.topPick])[0] : undefined;
    return {
      request: current,
      pick: pick && current.topPick ? { ...pick, service: current.topPick.service } : null,
      alternatives: this.resolve(current.alternatives),
      rejected: this.resolve(current.rejected),
    };
  });

  protected readonly history = computed(() =>
    this.store.history().map((request) => ({
      request,
      pickName: request.topPick ? (this.wines.detail(request.topPick.wineId)?.wine.name ?? null) : null,
    })),
  );

  protected onDishInput(event: Event): void {
    this.dish.set((event.target as HTMLInputElement).value);
  }

  protected async submit(): Promise<void> {
    await this.store.ask(this.dish(), null);
  }

  protected async onPhoto(event: Event): Promise<void> {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    input.value = '';
    if (file) {
      await this.store.ask(this.dish(), file);
    }
  }

  protected restart(): void {
    this.store.clear();
    this.dish.set('');
  }

  private resolve(choices: readonly PairingChoice[]): ResolvedChoice[] {
    return choices.flatMap((choice) => {
      const detail = this.wines.detail(choice.wineId);
      return detail ? [{ detail, reason: choice.reason }] : [];
    });
  }
}
