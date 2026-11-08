import { InjectionToken } from '@angular/core';
import Dexie, { Table } from 'dexie';
import { PairingRequest, Verdict } from '../models/advice';
import { RefCountry, RefGrape, RefRegion, Setting } from '../models/reference';
import { ProfileOverride, TasteProfile, Tasting } from '../models/tasting';
import { Photo, StockMovement, Wine } from '../models/wine';

export const DB_NAME = 'macave';
export const DB_VERSION = 1;

/** Toutes les tables, dans l'ordre utilisé par l'export et l'import. */
export const TABLE_NAMES = [
  'wines',
  'photos',
  'stockMovements',
  'tastings',
  'tasteProfile',
  'profileOverrides',
  'verdicts',
  'pairingRequests',
  'settings',
  'refCountries',
  'refRegions',
  'refGrapes',
] as const;

export type TableName = (typeof TABLE_NAMES)[number];

export class MaCaveDb extends Dexie {
  wines!: Table<Wine, string>;
  photos!: Table<Photo, string>;
  stockMovements!: Table<StockMovement, string>;
  tastings!: Table<Tasting, string>;
  tasteProfile!: Table<TasteProfile, string>;
  profileOverrides!: Table<ProfileOverride, string>;
  verdicts!: Table<Verdict, string>;
  pairingRequests!: Table<PairingRequest, string>;
  settings!: Table<Setting, string>;
  refCountries!: Table<RefCountry, string>;
  refRegions!: Table<RefRegion, [string, string]>;
  refGrapes!: Table<RefGrape, string>;

  constructor(name: string = DB_NAME) {
    super(name);
    this.version(DB_VERSION).stores({
      wines: 'id, color, country, region, producer, vintage',
      photos: 'id',
      stockMovements: 'id, wineId, date',
      tastings: 'id, wineId, date',
      tasteProfile: 'id',
      profileOverrides: 'id, date',
      verdicts: 'id, date',
      pairingRequests: 'id, date',
      settings: 'key',
      refCountries: 'name',
      refRegions: '[country+name], country',
      refGrapes: 'name',
    });
  }
}

export const MACAVE_DB = new InjectionToken<MaCaveDb>('MACAVE_DB', {
  providedIn: 'root',
  factory: () => new MaCaveDb(),
});
