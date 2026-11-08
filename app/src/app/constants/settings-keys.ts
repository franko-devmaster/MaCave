export const SETTINGS_KEYS = {
  anthropicApiKey: 'anthropicApiKey',
  lastExportAt: 'lastExportAt',
} as const;

/** Réglages qui ne quittent jamais l'appareil : exclus de l'export, conservés à l'import. */
export const DEVICE_ONLY_SETTINGS: readonly string[] = [SETTINGS_KEYS.anthropicApiKey];
