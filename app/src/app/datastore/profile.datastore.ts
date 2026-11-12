import { computed, inject, Injectable, signal } from '@angular/core';
import { ClaudeFailure } from '../ai/claude-errors';
import { tasteProfileRequest } from '../ai/taste-profile';
import { ProfileRepository } from '../db/profile.repository';
import { ProfileOverride, ProfileOverrideInput, TasteProfile } from '../models/tasting';
import { ClaudeService } from '../services/claude.service';
import { starWineIds } from '../utils/badges';
import { applyOverrides, profileSignature, PROVISIONAL_THRESHOLD } from '../utils/profile';
import { SettingsDatastore } from './settings.datastore';
import { TastingDatastore } from './tasting.datastore';
import { WineDatastore } from './wine.datastore';

export type ProfileStatus = 'idle' | 'updating' | 'error';

/**
 * Profil de goûts : synthèse de Claude, corrigée par l'utilisateur.
 * Recalculé seulement quand les dégustations ou les corrections ont changé.
 */
@Injectable({ providedIn: 'root' })
export class ProfileDatastore {
  private readonly repository = inject(ProfileRepository);
  private readonly tastings = inject(TastingDatastore);
  private readonly wines = inject(WineDatastore);
  private readonly settings = inject(SettingsDatastore);
  private readonly claude = inject(ClaudeService);

  private readonly profileSignal = signal<TasteProfile | null>(null);
  private readonly overridesSignal = signal<ProfileOverride[]>([]);
  private readonly statusSignal = signal<ProfileStatus>('idle');
  private readonly errorSignal = signal<ClaudeFailure | null>(null);

  readonly overrides = this.overridesSignal.asReadonly();
  readonly status = this.statusSignal.asReadonly();
  readonly error = this.errorSignal.asReadonly();
  readonly tastingCount = computed(() => this.tastings.tastings().length);
  readonly provisional = computed(() => this.tastingCount() < PROVISIONAL_THRESHOLD);
  private readonly signature = computed(() => profileSignature(this.tastings.tastings(), this.overridesSignal()));

  /** Il y a des dégustations et le profil enregistré ne les reflète pas (ou n'existe pas). */
  readonly stale = computed(() => this.tastingCount() > 0 && this.profileSignal()?.sourceSignature !== this.signature());

  /** Profil affiché : corrections appliquées, rien tant qu'aucune dégustation n'est notée. */
  readonly profile = computed(() => {
    const profile = this.profileSignal();
    return profile && this.tastingCount() > 0 ? applyOverrides(profile, this.overridesSignal()) : null;
  });

  /** Vins qui vous conviennent le mieux : bien notés, ou d'un cépage favori s'ils ne sont pas encore dégustés. */
  readonly starWineIds = computed(() =>
    starWineIds(this.wines.wines(), this.tastings.tastings(), this.profile()?.favoriteGrapes ?? []),
  );

  async load(): Promise<void> {
    const [profile, overrides] = await Promise.all([this.repository.getProfile(), this.repository.listOverrides()]);
    this.profileSignal.set(profile);
    this.overridesSignal.set(overrides);
  }

  /**
   * Recalcule si nécessaire et possible (clé présente, pas de calcul en cours).
   * Si une correction arrive pendant le calcul, un second passage la prend en compte.
   */
  async refreshIfStale(): Promise<void> {
    if (this.statusSignal() === 'updating' || !this.settings.hasApiKey()) {
      return;
    }
    while (this.stale()) {
      await this.refresh();
      if (this.statusSignal() === 'error') {
        return;
      }
    }
  }

  async refresh(): Promise<void> {
    const signature = this.signature();
    const tastings = this.tastings.tastings();
    this.statusSignal.set('updating');
    this.errorSignal.set(null);
    const result = await this.claude.structured(tasteProfileRequest(tastings, this.wines.wines(), this.overridesSignal()));
    if (!result.ok) {
      this.errorSignal.set(result);
      this.statusSignal.set('error');
      return;
    }
    const profile: TasteProfile = {
      id: 'current',
      ...result.value,
      basedOnTastings: tastings.length,
      generatedAt: new Date().toISOString(),
      sourceSignature: signature,
    };
    await this.repository.saveProfile(profile);
    this.profileSignal.set(profile);
    this.statusSignal.set('idle');
  }

  async addOverride(input: ProfileOverrideInput): Promise<void> {
    const override = await this.repository.addOverride(input);
    this.overridesSignal.update((overrides) => [...overrides, override]);
  }

  async removeOverride(id: string): Promise<void> {
    await this.repository.removeOverride(id);
    this.overridesSignal.update((overrides) => overrides.filter((o) => o.id !== id));
  }
}
