import { inject, Injectable } from '@angular/core';
import { ProfileOverride, ProfileOverrideInput, TasteProfile } from '../models/tasting';
import { MACAVE_DB } from './schema';

@Injectable({ providedIn: 'root' })
export class ProfileRepository {
  private readonly db = inject(MACAVE_DB);

  async getProfile(): Promise<TasteProfile | null> {
    return (await this.db.tasteProfile.get('current')) ?? null;
  }

  async saveProfile(profile: TasteProfile): Promise<void> {
    await this.db.tasteProfile.put(profile);
  }

  listOverrides(): Promise<ProfileOverride[]> {
    return this.db.profileOverrides.orderBy('date').toArray();
  }

  async addOverride(input: ProfileOverrideInput, now: Date = new Date()): Promise<ProfileOverride> {
    const override: ProfileOverride = { ...input, id: crypto.randomUUID(), reason: '', date: now.toISOString() };
    await this.db.profileOverrides.add(override);
    return override;
  }

  removeOverride(id: string): Promise<void> {
    return this.db.profileOverrides.delete(id);
  }
}
