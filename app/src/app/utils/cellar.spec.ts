import { FIXED_NOW, movement, wine } from '../testing/fixtures';
import {
  buildEntries,
  daysWithoutExport,
  groupByColor,
  isDrinkNow,
  isExportDue,
  lastPricePaid,
  matchesFilter,
  matchesSearch,
  normalize,
  stockByWine,
  summarize,
} from './cellar';

describe('cellar', () => {
  it('stockByWine should sum movements per wine', () => {
    const stock = stockByWine([movement('a', 6), movement('a', -1), movement('b', 2), movement('a', -2)]);

    expect(stock.get('a')).toBe(3);
    expect(stock.get('b')).toBe(2);
  });

  it('lastPricePaid should return the most recent known price', () => {
    const movements = [
      movement('a', 6, { pricePaid: 30, date: '2025-01-01T00:00:00Z' }),
      movement('a', 1, { pricePaid: 34, date: '2026-03-01T00:00:00Z' }),
      movement('a', 1, { pricePaid: null, date: '2026-06-01T00:00:00Z' }),
      movement('b', 1, { pricePaid: 99, date: '2026-09-01T00:00:00Z' }),
    ];

    expect(lastPricePaid(movements, 'a')).toBe(34);
    expect(lastPricePaid(movements, 'c')).toBeNull();
  });

  it.each([
    [2026, 2026, true],
    [2025, 2026, true],
    [2030, 2026, false],
    [null, 2026, false],
  ])('isDrinkNow when drinkUntil is %s in %s should be %s', (drinkUntil, year, expected) => {
    expect(isDrinkNow(wine('a', { drinkUntil }), year)).toBe(expected);
  });

  it('buildEntries should never report negative stock and ignore drink-now for empty wines', () => {
    const entries = buildEntries(
      [wine('a', { drinkUntil: 2020 }), wine('b', { drinkUntil: 2020 })],
      [movement('a', 1), movement('a', -3), movement('b', 2)],
      2026,
    );

    expect(entries.map((e) => [e.wine.id, e.bottles, e.drinkNow])).toEqual([
      ['a', 0, false],
      ['b', 2, true],
    ]);
  });

  it('summarize should count only wines in stock', () => {
    const summary = summarize([
      { wine: wine('a'), bottles: 3, drinkNow: true },
      { wine: wine('b'), bottles: 0, drinkNow: false },
      { wine: wine('c'), bottles: 2, drinkNow: false },
    ]);

    expect(summary).toEqual({ bottles: 5, wines: 2, drinkNow: 1 });
  });

  it('normalize should drop accents and case', () => {
    expect(normalize('  Dézaley Grand Crû ')).toBe('dezaley grand cru');
  });

  it.each([
    ['cornalin', true],
    ['GERMANIER valais', true],
    ['2019', true],
    ['petite arvine', false],
    ['', true],
  ])('matchesSearch for "%s" should be %s', (query, expected) => {
    expect(matchesSearch(wine('a'), query)).toBe(expected);
  });

  it('matchesSearch should look into grapes and appellation without accents', () => {
    const dezaley = wine('a', { name: 'Grand Cru', appellation: 'Dézaley', grapes: ['Chasselas'], color: 'blanc' });

    expect(matchesSearch(dezaley, 'dezaley chasselas')).toBe(true);
  });

  it('matchesFilter should handle all, drink-now and colors', () => {
    const entry = { wine: wine('a', { color: 'blanc' }), bottles: 1, drinkNow: true };

    expect(matchesFilter(entry, 'tous')).toBe(true);
    expect(matchesFilter(entry, 'a-boire')).toBe(true);
    expect(matchesFilter(entry, 'blanc')).toBe(true);
    expect(matchesFilter(entry, 'rouge')).toBe(false);
  });

  it('groupByColor should order colors, sort by name then vintage and count bottles', () => {
    const groups = groupByColor([
      { wine: wine('1', { color: 'blanc', name: 'Petite Arvine' }), bottles: 2, drinkNow: false },
      { wine: wine('2', { color: 'rouge', name: 'Pinot Noir', vintage: 2021 }), bottles: 4, drinkNow: false },
      { wine: wine('3', { color: 'rouge', name: 'Cornalin' }), bottles: 3, drinkNow: false },
      { wine: wine('4', { color: 'rouge', name: 'Pinot Noir', vintage: 2018 }), bottles: 1, drinkNow: false },
    ]);

    expect(groups.map((g) => [g.color, g.bottles])).toEqual([
      ['rouge', 8],
      ['blanc', 2],
    ]);
    expect(groups[0].entries.map((e) => e.wine.id)).toEqual(['3', '4', '2']);
  });

  it('daysWithoutExport when the cellar is empty should be null', () => {
    expect(daysWithoutExport(null, [], FIXED_NOW)).toBeNull();
  });

  it('daysWithoutExport when never exported should count from the first wine', () => {
    const wines = [wine('a', { createdAt: '2026-10-01T20:00:00Z' }), wine('b', { createdAt: '2026-09-01T20:00:00Z' })];

    expect(daysWithoutExport(null, wines, FIXED_NOW)).toBe(68);
  });

  it('isExportDue should trigger only after 30 days', () => {
    const wines = [wine('a')];

    expect(isExportDue('2026-10-09T20:00:00Z', wines, FIXED_NOW)).toBe(false);
    expect(isExportDue('2026-10-08T19:00:00Z', wines, FIXED_NOW)).toBe(true);
  });
});
