import { computed, inject, Injectable, signal } from '@angular/core';
import { SETTINGS_KEYS } from '../constants/settings-keys';
import { SettingsRepository } from '../db/settings.repository';

@Injectable({ providedIn: 'root' })
export class SettingsDatastore {
  private readonly repository = inject(SettingsRepository);
  private readonly lastExportAtSignal = signal<string | null>(null);
  private readonly apiKeySignal = signal<string | null>(null);

  readonly lastExportAt = this.lastExportAtSignal.asReadonly();
  /** Clé API Claude, propre à cet appareil : jamais exportée. */
  readonly apiKey = this.apiKeySignal.asReadonly();
  readonly hasApiKey = computed(() => !!this.apiKeySignal());
  readonly maskedApiKey = computed(() => maskApiKey(this.apiKeySignal()));

  async load(): Promise<void> {
    const [lastExportAt, apiKey] = await Promise.all([
      this.repository.getString(SETTINGS_KEYS.lastExportAt),
      this.repository.getString(SETTINGS_KEYS.anthropicApiKey),
    ]);
    this.lastExportAtSignal.set(lastExportAt);
    this.apiKeySignal.set(apiKey);
  }

  async markExported(at: Date = new Date()): Promise<void> {
    await this.repository.set(SETTINGS_KEYS.lastExportAt, at.toISOString());
    this.lastExportAtSignal.set(at.toISOString());
  }

  async setApiKey(apiKey: string): Promise<void> {
    const trimmed = apiKey.trim();
    await this.repository.set(SETTINGS_KEYS.anthropicApiKey, trimmed);
    this.apiKeySignal.set(trimmed);
  }

  async clearApiKey(): Promise<void> {
    await this.repository.delete(SETTINGS_KEYS.anthropicApiKey);
    this.apiKeySignal.set(null);
  }
}

/** « sk-ant-…a1b2 » : assez pour reconnaître la clé, sans l'afficher. */
export function maskApiKey(apiKey: string | null): string | null {
  if (!apiKey) {
    return null;
  }
  return apiKey.length <= 12 ? '••••' : `${apiKey.slice(0, 7)}…${apiKey.slice(-4)}`;
}
