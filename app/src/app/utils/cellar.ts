import { StockMovement, Wine, WINE_COLORS, WineColor } from '../models/wine';

export interface CellarEntry {
  wine: Wine;
  bottles: number;
  drinkNow: boolean;
}

export interface ColorGroup {
  color: WineColor;
  bottles: number;
  entries: CellarEntry[];
}

export interface CellarSummary {
  bottles: number;
  wines: number;
  drinkNow: number;
}

export type CellarFilter = 'tous' | 'a-boire' | WineColor;

export const EXPORT_REMINDER_DAYS = 30;

/** Stock par vin : somme des mouvements. */
export function stockByWine(movements: readonly StockMovement[]): Map<string, number> {
  const stock = new Map<string, number>();
  for (const movement of movements) {
    stock.set(movement.wineId, (stock.get(movement.wineId) ?? 0) + movement.delta);
  }
  return stock;
}

/** Dernier prix payé pour ce vin, ou null. */
export function lastPricePaid(movements: readonly StockMovement[], wineId: string): number | null {
  const purchases = movements
    .filter((m) => m.wineId === wineId && m.pricePaid !== null)
    .sort((a, b) => b.date.localeCompare(a.date));
  return purchases[0]?.pricePaid ?? null;
}

/** À boire maintenant : la fin de la fenêtre de garde est atteinte cette année ou dépassée. */
export function isDrinkNow(wine: Wine, year: number): boolean {
  return wine.drinkUntil !== null && wine.drinkUntil <= year;
}

export function buildEntries(wines: readonly Wine[], movements: readonly StockMovement[], year: number): CellarEntry[] {
  const stock = stockByWine(movements);
  return wines.map((wine) => {
    const bottles = Math.max(0, stock.get(wine.id) ?? 0);
    return { wine, bottles, drinkNow: bottles > 0 && isDrinkNow(wine, year) };
  });
}

export function summarize(entries: readonly CellarEntry[]): CellarSummary {
  const inStock = entries.filter((e) => e.bottles > 0);
  return {
    bottles: inStock.reduce((total, e) => total + e.bottles, 0),
    wines: inStock.length,
    drinkNow: inStock.filter((e) => e.drinkNow).length,
  };
}

/** Minuscules, sans accents, pour une recherche tolérante. */
export function normalize(text: string): string {
  return text.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase().trim();
}

export function matchesSearch(wine: Wine, query: string): boolean {
  const terms = normalize(query).split(/\s+/).filter(Boolean);
  if (!terms.length) {
    return true;
  }
  const haystack = normalize(
    [wine.name, wine.producer, wine.region, wine.country, wine.appellation, wine.grapes.join(' '), wine.vintage ?? ''].join(' '),
  );
  return terms.every((term) => haystack.includes(term));
}

export function matchesFilter(entry: CellarEntry, filter: CellarFilter): boolean {
  if (filter === 'tous') {
    return true;
  }
  if (filter === 'a-boire') {
    return entry.drinkNow;
  }
  return entry.wine.color === filter;
}

/** Groupes par couleur, dans l'ordre rouge, blanc, rosé, bulles ; tri par nom puis millésime. */
export function groupByColor(entries: readonly CellarEntry[]): ColorGroup[] {
  return WINE_COLORS.map((color) => {
    const groupEntries = entries
      .filter((e) => e.wine.color === color)
      .sort((a, b) => a.wine.name.localeCompare(b.wine.name, 'fr') || (a.wine.vintage ?? 0) - (b.wine.vintage ?? 0));
    return { color, bottles: groupEntries.reduce((t, e) => t + e.bottles, 0), entries: groupEntries };
  }).filter((group) => group.entries.length > 0);
}

/**
 * Jours écoulés depuis la dernière sauvegarde, ou depuis le premier vin saisi si aucune
 * sauvegarde n'existe. Null quand il n'y a rien à sauvegarder.
 */
export function daysWithoutExport(lastExportAt: string | null, wines: readonly Wine[], now: Date): number | null {
  if (!wines.length) {
    return null;
  }
  const reference = lastExportAt ?? wines.map((w) => w.createdAt).sort()[0];
  return Math.floor((now.getTime() - new Date(reference).getTime()) / 86_400_000);
}

export function isExportDue(lastExportAt: string | null, wines: readonly Wine[], now: Date): boolean {
  const days = daysWithoutExport(lastExportAt, wines, now);
  return days !== null && days > EXPORT_REMINDER_DAYS;
}

/** Même vin : nom et producteur identiques sans tenir compte des accents ni de la casse, même millésime. */
export function findDuplicate(input: Pick<Wine, 'name' | 'producer' | 'vintage'>, wines: readonly Wine[]): Wine | null {
  const name = normalize(input.name);
  const producer = normalize(input.producer);
  return wines.find((w) => normalize(w.name) === name && normalize(w.producer) === producer && w.vintage === input.vintage) ?? null;
}
