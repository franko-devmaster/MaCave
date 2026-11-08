import { inject, Injectable } from '@angular/core';
import { DB_VERSION, MACAVE_DB, TABLE_NAMES, TableName } from '../db/schema';
import { DEVICE_ONLY_SETTINGS } from '../constants/settings-keys';
import { Setting } from '../models/reference';

export const BACKUP_APP_ID = 'ma-cave';

export interface BackupFile {
  app: typeof BACKUP_APP_ID;
  schemaVersion: number;
  exportedAt: string;
  data: Record<TableName, unknown[]>;
}

/** Remplacer : vide l'application puis charge le fichier. Fusionner : ajoute ou met à jour par identifiant. */
export type RestoreMode = 'replace' | 'merge';

export class BackupFormatError extends Error {}

/** Export et import de toutes les données de l'application en un fichier JSON. */
@Injectable({ providedIn: 'root' })
export class BackupService {
  private readonly db = inject(MACAVE_DB);

  async createBackup(now: Date = new Date()): Promise<BackupFile> {
    const data = {} as Record<TableName, unknown[]>;
    await this.db.transaction('r', TABLE_NAMES.map((name) => this.db.table(name)), async () => {
      for (const name of TABLE_NAMES) {
        data[name] = await this.db.table(name).toArray();
      }
    });
    data.settings = (data.settings as Setting[]).filter((s) => !DEVICE_ONLY_SETTINGS.includes(s.key));
    return { app: BACKUP_APP_ID, schemaVersion: DB_VERSION, exportedAt: now.toISOString(), data };
  }

  async exportToFile(now: Date = new Date()): Promise<File> {
    const backup = await this.createBackup(now);
    return new File([JSON.stringify(backup, null, 2)], backupFileName(now), { type: 'application/json' });
  }

  /** Écrit le contenu d'une sauvegarde déjà validée. Les réglages propres à l'appareil sont toujours conservés. */
  async restore(backup: BackupFile, mode: RestoreMode): Promise<number> {
    const tables = TABLE_NAMES.map((name) => this.db.table(name));
    let count = 0;
    await this.db.transaction('rw', tables, async () => {
      const kept = await this.db.settings.where('key').anyOf([...DEVICE_ONLY_SETTINGS]).toArray();
      for (const name of TABLE_NAMES) {
        const rows = name === 'settings' ? withoutDeviceOnly(backup.data[name]) : backup.data[name];
        const table = this.db.table(name);
        if (mode === 'replace') {
          await table.clear();
        }
        await table.bulkPut(rows);
        count += rows.length;
      }
      await this.db.settings.bulkPut(kept);
    });
    return count;
  }

  async importFromText(text: string, mode: RestoreMode = 'replace'): Promise<number> {
    return this.restore(parseBackup(text), mode);
  }
}

export function backupFileName(date: Date): string {
  return `ma-cave-${date.toISOString().slice(0, 10)}.json`;
}

export function parseBackup(text: string): BackupFile {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    throw new BackupFormatError('fichier JSON illisible');
  }
  if (!isRecord(raw) || raw['app'] !== BACKUP_APP_ID) {
    throw new BackupFormatError("ce fichier n'est pas une sauvegarde Ma Cave");
  }
  const version = raw['schemaVersion'];
  if (typeof version !== 'number' || version < 1 || version > DB_VERSION) {
    throw new BackupFormatError('version de sauvegarde non prise en charge');
  }
  const data = raw['data'];
  if (!isRecord(data)) {
    throw new BackupFormatError('données absentes');
  }
  const tables = {} as Record<TableName, unknown[]>;
  for (const name of TABLE_NAMES) {
    const rows = data[name] ?? [];
    if (!Array.isArray(rows)) {
      throw new BackupFormatError(`table ${name} invalide`);
    }
    tables[name] = rows;
  }
  return {
    app: BACKUP_APP_ID,
    schemaVersion: version,
    exportedAt: typeof raw['exportedAt'] === 'string' ? raw['exportedAt'] : '',
    data: tables,
  };
}

function withoutDeviceOnly(rows: unknown[]): unknown[] {
  return rows.filter((row) => !(isRecord(row) && DEVICE_ONLY_SETTINGS.includes(String(row['key']))));
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
