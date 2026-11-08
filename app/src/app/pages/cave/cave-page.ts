import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { TranslatePipe } from '@ngx-translate/core';
import { ColorDotComponent } from '../../components/color-dot/color-dot';
import { PageHeaderComponent } from '../../components/page-header/page-header';
import { WineRowComponent } from '../../components/wine-row/wine-row';
import { SettingsDatastore } from '../../datastore/settings.datastore';
import { WineDatastore } from '../../datastore/wine.datastore';
import { WINE_COLORS } from '../../models/wine';
import { CellarFilter, daysWithoutExport, groupByColor, isExportDue, matchesFilter, matchesSearch } from '../../utils/cellar';
import { pluralKey } from '../../utils/format';

@Component({
  selector: 'app-cave-page',
  imports: [PageHeaderComponent, WineRowComponent, ColorDotComponent, RouterLink, TranslatePipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  styleUrl: './cave-page.scss',
  templateUrl: './cave-page.html',
})
export class CavePage {
  private readonly store = inject(WineDatastore);
  private readonly settings = inject(SettingsDatastore);

  protected readonly colors = WINE_COLORS;
  protected readonly query = signal('');
  protected readonly filter = signal<CellarFilter>('tous');
  protected readonly showEmptied = signal(false);

  protected readonly summary = this.store.summary;
  protected readonly isEmpty = computed(() => this.store.wines().length === 0);
  protected readonly summaryParts = computed(() => {
    const { bottles, wines, drinkNow } = this.summary();
    const parts = [
      { key: pluralKey('cave.summary.bottles', bottles), count: bottles, accent: false },
      { key: pluralKey('cave.summary.wines', wines), count: wines, accent: false },
    ];
    if (drinkNow > 0) {
      parts.push({ key: pluralKey('cave.summary.drinkNow', drinkNow), count: drinkNow, accent: true });
    }
    return parts;
  });

  private readonly visible = computed(() =>
    this.store.entries().filter((e) => matchesSearch(e.wine, this.query()) && matchesFilter(e, this.filter())),
  );
  protected readonly groups = computed(() => groupByColor(this.visible().filter((e) => e.bottles > 0)));
  protected readonly emptied = computed(() =>
    this.visible()
      .filter((e) => e.bottles === 0)
      .sort((a, b) => a.wine.name.localeCompare(b.wine.name, 'fr')),
  );
  protected readonly noResult = computed(() => !this.isEmpty() && this.groups().length === 0 && this.emptied().length === 0);

  protected readonly exportReminder = computed(() => {
    const wines = this.store.wines();
    const lastExportAt = this.settings.lastExportAt();
    const now = new Date();
    if (!isExportDue(lastExportAt, wines, now)) {
      return null;
    }
    return { key: lastExportAt ? 'cave.reminder.since' : 'cave.reminder.never', days: daysWithoutExport(lastExportAt, wines, now) };
  });

  protected onSearch(event: Event): void {
    this.query.set((event.target as HTMLInputElement).value);
  }
}
