import { WineColor } from '../models/wine';
import { isGrandCru } from './badges';
import { CellarEntry, Readiness } from './cellar';

export type TasteFilter = 'star' | 'grand-cru';

/**
 * Filtres de la cave, par groupe : couleur, moment de boire, goût. Dans un groupe, les choix
 * s'additionnent (rouges ou blancs) ; entre groupes, ils se cumulent (rouges et prêts à boire).
 * Un groupe vide ne filtre pas.
 */
export interface CellarFilters {
  colors: readonly WineColor[];
  when: readonly Readiness[];
  taste: readonly TasteFilter[];
}

export const NO_FILTERS: CellarFilters = { colors: [], when: [], taste: [] };

export function hasFilters(filters: CellarFilters): boolean {
  return filters.colors.length + filters.when.length + filters.taste.length > 0;
}

/** Ajoute ou retire un choix dans un groupe. */
export function toggleFilter<K extends keyof CellarFilters>(filters: CellarFilters, group: K, value: CellarFilters[K][number]): CellarFilters {
  const current = filters[group] as readonly CellarFilters[K][number][];
  const next = current.includes(value) ? current.filter((v) => v !== value) : [...current, value];
  return { ...filters, [group]: next };
}

export function matchesFilters(entry: CellarEntry, filters: CellarFilters, star: boolean): boolean {
  const { colors, when, taste } = filters;
  if (colors.length && !colors.includes(entry.wine.color)) {
    return false;
  }
  if (when.length && !(entry.readiness && when.includes(entry.readiness))) {
    return false;
  }
  if (taste.length && !((taste.includes('star') && star) || (taste.includes('grand-cru') && isGrandCru(entry.wine)))) {
    return false;
  }
  return true;
}
