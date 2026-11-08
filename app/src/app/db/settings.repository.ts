import { inject, Injectable } from '@angular/core';
import { MACAVE_DB } from './schema';

@Injectable({ providedIn: 'root' })
export class SettingsRepository {
  private readonly db = inject(MACAVE_DB);

  async getString(key: string): Promise<string | null> {
    const setting = await this.db.settings.get(key);
    return typeof setting?.value === 'string' ? setting.value : null;
  }

  async set(key: string, value: unknown): Promise<void> {
    await this.db.settings.put({ key, value });
  }
}
