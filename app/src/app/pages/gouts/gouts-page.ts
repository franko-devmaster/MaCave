import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject, OnInit, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { EmptyStateComponent } from '../../components/empty-state/empty-state';
import { PageHeaderComponent } from '../../components/page-header/page-header';
import { AdviceDatastore } from '../../datastore/advice.datastore';
import { ProfileDatastore } from '../../datastore/profile.datastore';
import { SettingsDatastore } from '../../datastore/settings.datastore';
import { ProfileOverride, ProfileOverrideInput, TASTE_AXES, TasteAxis } from '../../models/tasting';
import { pluralKey } from '../../utils/format';
import { axisOf } from '../../utils/profile';

@Component({
  selector: 'app-gouts-page',
  imports: [PageHeaderComponent, EmptyStateComponent, RouterLink, TranslatePipe, DatePipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  styleUrl: './gouts-page.scss',
  templateUrl: './gouts-page.html',
})
export class GoutsPage implements OnInit {
  protected readonly store = inject(ProfileDatastore);
  protected readonly settings = inject(SettingsDatastore);
  protected readonly advice = inject(AdviceDatastore);
  private readonly translate = inject(TranslateService);

  protected readonly axes = TASTE_AXES;
  protected readonly editingAxis = signal<TasteAxis | null>(null);
  protected readonly axisDraft = signal(5);
  protected readonly noteDraft = signal('');

  protected readonly subtitleKey = computed(() => {
    const count = this.store.tastingCount();
    if (count === 0) {
      return 'gouts.subtitle';
    }
    return pluralKey(this.store.provisional() ? 'gouts.provisional' : 'gouts.basedOn', count);
  });

  /** Axes corrigés à la main, signalés à côté de la valeur. */
  protected readonly correctedAxes = computed(
    () => new Set(this.store.overrides().map((o) => axisOf(o.field)).filter((axis): axis is TasteAxis => axis !== null)),
  );

  protected readonly corrections = computed(() =>
    [...this.store.overrides()].reverse().map((override) => ({ override, ...describe(override) })),
  );

  ngOnInit(): void {
    void this.store.refreshIfStale();
  }

  protected editAxis(axis: TasteAxis): void {
    this.axisDraft.set(this.store.profile()?.axes[axis] ?? 5);
    this.editingAxis.set(axis);
  }

  protected onAxisInput(event: Event): void {
    this.axisDraft.set(Number((event.target as HTMLInputElement).value));
  }

  protected async saveAxis(): Promise<void> {
    const axis = this.editingAxis();
    this.editingAxis.set(null);
    if (axis) {
      await this.correct({ field: `axis:${axis}`, userValue: String(this.axisDraft()) });
    }
  }

  protected async removeGrape(grape: string): Promise<void> {
    await this.correct({ field: 'remove-grape', userValue: grape });
  }

  protected async removeAvoid(pattern: string): Promise<void> {
    await this.correct({ field: 'remove-avoid', userValue: pattern });
  }

  protected onNoteInput(event: Event): void {
    this.noteDraft.set((event.target as HTMLInputElement).value);
  }

  protected async addNote(): Promise<void> {
    const note = this.noteDraft().trim();
    if (note) {
      this.noteDraft.set('');
      await this.correct({ field: 'note', userValue: note });
    }
  }

  protected async undoCorrection(override: ProfileOverride): Promise<void> {
    await this.store.removeOverride(override.id);
    void this.store.refreshIfStale();
  }

  /** Recalcule l'affinité et le grand cru de chaque vin en cave, après confirmation (un appel par vin). */
  protected reevaluate(): void {
    const count = this.advice.reevaluableCount();
    if (count > 0 && confirm(this.translate.instant('gouts.reevaluate.confirm', { count }))) {
      void this.advice.reevaluateAll();
    }
  }

  protected retry(): void {
    void this.store.refreshIfStale();
  }

  private async correct(input: ProfileOverrideInput): Promise<void> {
    await this.store.addOverride(input);
    void this.store.refreshIfStale();
  }
}

function describe(override: ProfileOverride): { key: string; params: Record<string, string> } {
  const axis = axisOf(override.field);
  if (axis) {
    return { key: 'gouts.correction.axis', params: { axis: `gouts.axes.${axis}`, value: override.userValue } };
  }
  const keys: Record<string, string> = {
    'remove-grape': 'gouts.correction.removeGrape',
    'remove-avoid': 'gouts.correction.removeAvoid',
    note: 'gouts.correction.note',
  };
  return { key: keys[override.field], params: { value: override.userValue } };
}
