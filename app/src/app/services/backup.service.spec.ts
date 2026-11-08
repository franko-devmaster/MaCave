import { TestBed } from '@angular/core/testing';
import { SETTINGS_KEYS } from '../constants/settings-keys';
import { DB_VERSION, MaCaveDb, TABLE_NAMES } from '../db/schema';
import { Wine } from '../models/wine';
import { createTestDb, provideTestDb } from '../testing/test-db';
import { BACKUP_APP_ID, BackupFormatError, BackupService, backupFileName, parseBackup } from './backup.service';

const NOW = new Date('2026-11-08T20:15:00.000Z');

function wine(id: string): Wine {
  return {
    id,
    name: 'Cornalin',
    producer: 'Germanier',
    vintage: 2019,
    color: 'rouge',
    country: 'Suisse',
    region: 'Valais',
    appellation: 'AOC Valais',
    grapes: ['Cornalin'],
    alcohol: 13.5,
    sweetness: 'sec',
    drinkFrom: 2024,
    drinkUntil: 2030,
    labelPhotoId: null,
    location: 'B2',
    notes: '',
    createdAt: NOW.toISOString(),
    updatedAt: NOW.toISOString(),
  };
}

describe('BackupService', () => {
  let db: MaCaveDb;
  let sut: BackupService;

  beforeEach(() => {
    db = createTestDb();
    TestBed.configureTestingModule({ providers: [provideTestDb(db)] });
    sut = TestBed.inject(BackupService);
  });

  afterEach(async () => {
    await db.delete();
  });

  it('createBackup when database is empty should list every table as an empty array', async () => {
    const backup = await sut.createBackup(NOW);

    expect(backup.app).toBe(BACKUP_APP_ID);
    expect(backup.schemaVersion).toBe(DB_VERSION);
    expect(backup.exportedAt).toBe(NOW.toISOString());
    expect(Object.keys(backup.data)).toEqual([...TABLE_NAMES]);
    for (const name of TABLE_NAMES) {
      expect(backup.data[name]).toEqual([]);
    }
  });

  it('createBackup should never include the API key', async () => {
    await db.settings.bulkPut([
      { key: SETTINGS_KEYS.anthropicApiKey, value: 'sk-ant-secret' },
      { key: 'language', value: 'fr' },
    ]);

    const backup = await sut.createBackup(NOW);

    expect(backup.data.settings).toEqual([{ key: 'language', value: 'fr' }]);
    expect(JSON.stringify(backup)).not.toContain('sk-ant-secret');
  });

  it('exportToFile should name the file by date', async () => {
    const file = await sut.exportToFile(NOW);

    expect(file.name).toBe('ma-cave-2026-11-08.json');
    expect(file.type).toBe('application/json');
  });

  it('importFromText should replace existing data with the backup content', async () => {
    await db.wines.put(wine('old'));
    const text = JSON.stringify({
      app: BACKUP_APP_ID,
      schemaVersion: DB_VERSION,
      exportedAt: NOW.toISOString(),
      data: { wines: [wine('a'), wine('b')] },
    });

    const count = await sut.importFromText(text);

    expect(count).toBe(2);
    expect((await db.wines.toArray()).map((w) => w.id).sort()).toEqual(['a', 'b']);
  });

  it('importFromText should keep the API key of this device and ignore one found in the file', async () => {
    await db.settings.put({ key: SETTINGS_KEYS.anthropicApiKey, value: 'sk-device' });
    const text = JSON.stringify({
      app: BACKUP_APP_ID,
      schemaVersion: DB_VERSION,
      data: { settings: [{ key: SETTINGS_KEYS.anthropicApiKey, value: 'sk-file' }, { key: 'language', value: 'fr' }] },
    });

    await sut.importFromText(text);

    expect(await db.settings.get(SETTINGS_KEYS.anthropicApiKey)).toEqual({ key: SETTINGS_KEYS.anthropicApiKey, value: 'sk-device' });
    expect(await db.settings.get('language')).toEqual({ key: 'language', value: 'fr' });
  });

  it('importFromText when the file is invalid should leave data untouched', async () => {
    await db.wines.put(wine('keep'));

    await expect(sut.importFromText('{"app":"autre"}')).rejects.toBeInstanceOf(BackupFormatError);

    expect(await db.wines.count()).toBe(1);
  });

  it('importFromText in merge mode should keep existing rows and upsert those of the file', async () => {
    await db.wines.bulkPut([wine('local'), { ...wine('shared'), name: 'Ancien nom' }]);
    const text = JSON.stringify({
      app: BACKUP_APP_ID,
      schemaVersion: DB_VERSION,
      data: { wines: [{ ...wine('shared'), name: 'Nouveau nom' }, wine('file')] },
    });

    const count = await sut.importFromText(text, 'merge');

    expect(count).toBe(2);
    const wines = await db.wines.toArray();
    expect(wines.map((w) => w.id).sort()).toEqual(['file', 'local', 'shared']);
    expect(wines.find((w) => w.id === 'shared')?.name).toBe('Nouveau nom');
  });

  it('createBackup should encode photos in base64 and the round trip should restore the bytes', async () => {
    await db.photos.put({ id: 'p1', bytes: new Uint8Array([65, 66, 67]).buffer, mediaType: 'image/jpeg', width: 3, height: 1, createdAt: NOW.toISOString() });

    const backup = await sut.createBackup(NOW);
    expect(backup.data.photos).toEqual([{ id: 'p1', mediaType: 'image/jpeg', width: 3, height: 1, createdAt: NOW.toISOString(), base64: 'QUJD' }]);

    await db.photos.clear();
    await sut.restore(parseBackup(JSON.stringify(backup)), 'replace');
    const photo = await db.photos.get('p1');
    expect(new Uint8Array(photo?.bytes ?? new ArrayBuffer(0))).toEqual(new Uint8Array([65, 66, 67]));
  });

  it('round trip export then import should restore the same data', async () => {
    await db.wines.bulkPut([wine('a'), wine('b')]);
    const exported = JSON.stringify(await sut.createBackup(NOW));
    await db.wines.clear();

    await sut.importFromText(exported);

    expect(await db.wines.toArray()).toEqual([wine('a'), wine('b')]);
  });
});

describe('parseBackup', () => {
  it.each([
    ['not json', 'fichier JSON illisible'],
    ['[]', "ce fichier n'est pas une sauvegarde Ma Cave"],
    ['{"app":"autre"}', "ce fichier n'est pas une sauvegarde Ma Cave"],
    [`{"app":"ma-cave","schemaVersion":${DB_VERSION + 1},"data":{}}`, 'version de sauvegarde non prise en charge'],
    ['{"app":"ma-cave","schemaVersion":1}', 'données absentes'],
    ['{"app":"ma-cave","schemaVersion":1,"data":{"wines":{}}}', 'table wines invalide'],
  ])('parseBackup when input is %s should reject with "%s"', (input, message) => {
    expect(() => parseBackup(input)).toThrow(new BackupFormatError(message));
  });

  it('parseBackup when tables are missing should default them to empty arrays', () => {
    const backup = parseBackup('{"app":"ma-cave","schemaVersion":1,"data":{}}');

    expect(backup.data.wines).toEqual([]);
    expect(backup.data.refGrapes).toEqual([]);
  });

  it('backupFileName should use the ISO date', () => {
    expect(backupFileName(NOW)).toBe('ma-cave-2026-11-08.json');
  });
});
