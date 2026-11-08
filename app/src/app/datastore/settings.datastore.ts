import { inject, Injectable, signal } from '@angular/core';
import { SETTINGS_KEYS } from '../constants/settings-keys';
import { SettingsRepository } from '../db/settings.repository';

@Injectable({ providedIn: 'root' })
export class SettingsDatastore {
  private readonly repository = inject(SettingsRepository);
  private readonly lastExportAtSignal = signal<string | null>(null);

  readonly lastExportAt = this.lastExportAtSignal.asReadonly();

  async load(): Promise<void> {
    this.lastExportAtSignal.set(await this.repository.getString(SETTINGS_KEYS.lastExportAt));
  }

  async markExported(at: Date = new Date()): Promise<void> {
    await this.repository.set(SETTINGS_KEYS.lastExportAt, at.toISOString());
    this.lastExportAtSignal.set(at.toISOString());
  }
}
