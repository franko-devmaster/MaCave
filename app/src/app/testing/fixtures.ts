import { StockMovement, Wine, WineInput } from '../models/wine';

export const FIXED_NOW = new Date('2026-11-08T20:00:00.000Z');

export function wineInput(overrides: Partial<WineInput> = {}): WineInput {
  return {
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
    location: 'B2',
    notes: '',
    ...overrides,
  };
}

export function wine(id: string, overrides: Partial<Wine> = {}): Wine {
  return {
    ...wineInput(),
    id,
    labelPhotoId: null,
    createdAt: FIXED_NOW.toISOString(),
    updatedAt: FIXED_NOW.toISOString(),
    ...overrides,
  };
}

export function movement(wineId: string, delta: number, overrides: Partial<StockMovement> = {}): StockMovement {
  return {
    id: crypto.randomUUID(),
    wineId,
    delta,
    reason: delta > 0 ? 'achat' : 'ouverture',
    pricePaid: null,
    date: FIXED_NOW.toISOString(),
    ...overrides,
  };
}
