import { WineAdvice } from '../models/wine';
import { wine } from '../testing/fixtures';
import { CellarEntry } from './cellar';
import { hasFilters, matchesFilters, NO_FILTERS, toggleFilter } from './cellar-filters';

function entry(overrides: Partial<CellarEntry> = {}, wineOverrides = {}): CellarEntry {
  return { wine: wine('a', wineOverrides), bottles: 2, drinkNow: false, readiness: null, ...overrides };
}

const GRAND_CRU: WineAdvice = { status: 'pret', text: '', generatedAt: '2026-11-01T00:00:00Z', affinity: null, grandCru: true };

describe('cellar filters', () => {
  it('matchesFilters without filters should keep every wine', () => {
    expect(matchesFilters(entry(), NO_FILTERS, false)).toBe(true);
  });

  it('matchesFilters should add choices within a group', () => {
    const filters = { ...NO_FILTERS, colors: ['rouge', 'blanc'] as const };

    expect(matchesFilters(entry({}, { color: 'blanc' }), filters, false)).toBe(true);
    expect(matchesFilters(entry({}, { color: 'rose' }), filters, false)).toBe(false);
  });

  it('matchesFilters should combine groups', () => {
    const filters = { colors: ['rouge'] as const, when: ['ready'] as const, taste: ['grand-cru'] as const };

    expect(matchesFilters(entry({ readiness: 'ready' }, { advice: GRAND_CRU }), filters, false)).toBe(true);
    expect(matchesFilters(entry({ readiness: 'soon' }, { advice: GRAND_CRU }), filters, false)).toBe(false);
    expect(matchesFilters(entry({ readiness: 'ready' }, { name: 'Cornalin' }), filters, false)).toBe(false);
  });

  it('matchesFilters on taste should accept a star or a grand cru', () => {
    const filters = { ...NO_FILTERS, taste: ['star', 'grand-cru'] as const };

    expect(matchesFilters(entry(), filters, true)).toBe(true);
    expect(matchesFilters(entry({}, { advice: GRAND_CRU }), filters, false)).toBe(true);
    expect(matchesFilters(entry(), filters, false)).toBe(false);
  });

  it('matchesFilters on when should exclude wines without a drinking state', () => {
    expect(matchesFilters(entry(), { ...NO_FILTERS, when: ['soon', 'ready'] }, false)).toBe(false);
  });

  it('toggleFilter should add then remove a choice, and hasFilters should follow', () => {
    const once = toggleFilter(NO_FILTERS, 'when', 'soon');

    expect(once.when).toEqual(['soon']);
    expect(hasFilters(once)).toBe(true);
    expect(toggleFilter(once, 'when', 'soon')).toEqual(NO_FILTERS);
  });
});
