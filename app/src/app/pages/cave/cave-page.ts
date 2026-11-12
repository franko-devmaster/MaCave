import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { TranslatePipe } from '@ngx-translate/core';
import { BadgeIconComponent } from '../../components/badge-icon/badge-icon';
import { ColorDotComponent } from '../../components/color-dot/color-dot';
import { PageHeaderComponent } from '../../components/page-header/page-header';
import { WineRowComponent } from '../../components/wine-row/wine-row';
import { SettingsDatastore } from '../../datastore/settings.datastore';
import { TastingDatastore } from '../../datastore/tasting.datastore';
import { WineDatastore } from '../../datastore/wine.datastore';
import { WINE_COLORS, WineColor } from '../../models/wine';
import { daysWithoutExport, groupByColor, isExportDue, matchesSearch, Readiness } from '../../utils/cellar';
import { CellarFilters, hasFilters, matchesFilters, NO_FILTERS, TasteFilter, toggleFilter } from '../../utils/cellar-filters';
import { pluralKey } from '../../utils/format';

@Component({
  selector: 'app-cave-page',
  imports: [PageHeaderComponent, WineRowComponent, ColorDotComponent, BadgeIconComponent, RouterLink, TranslatePipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  styleUrl: './cave-page.scss',
  templateUrl: './cave-page.html',
})
export class CavePage {
  private readonly store = inject(WineDatastore);
  protected readonly starIds = this.store.starWineIds;
  private readonly settings = inject(SettingsDatastore);
  protected readonly rebuyIds = inject(TastingDatastore).rebuyWineIds;
  protected readonly whenChoices: readonly Readiness[] = ['soon', 'ready'];
  protected readonly tasteChoices: readonly TasteFilter[] = ['star', 'grand-cru'];

  protected readonly colors = WINE_COLORS;
  protected readonly query = signal('');
  protected readonly noFilters = NO_FILTERS;
  protected readonly filters = signal<CellarFilters>(NO_FILTERS);
  protected readonly filtered = computed(() => hasFilters(this.filters()));
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
    this.store.entries().filter((e) => matchesSearch(e.wine, this.query()) && matchesFilters(e, this.filters(), this.starIds().has(e.wine.id))),
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

  protected toggleColor(color: WineColor): void {
    this.filters.update((f) => toggleFilter(f, 'colors', color));
  }

  protected toggleWhen(value: Readiness): void {
    this.filters.update((f) => toggleFilter(f, 'when', value));
  }

  protected toggleTaste(value: TasteFilter): void {
    this.filters.update((f) => toggleFilter(f, 'taste', value));
  }

  protected onSearch(event: Event): void {
    this.query.set((event.target as HTMLInputElement).value);
  }
}
