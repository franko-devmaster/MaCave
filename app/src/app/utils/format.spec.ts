import { formatChf, formatDrinkWindow, parseList, parseNumber, pluralKey } from './format';

describe('format', () => {
  it.each([
    [34, 'CHF 34.–'],
    [34.5, 'CHF 34.50'],
    [12.345, 'CHF 12.35'],
    [null, ''],
  ])('formatChf(%s) should be "%s"', (value, expected) => {
    expect(formatChf(value)).toBe(expected);
  });

  it.each([
    ['34', 34],
    ['34,50', 34.5],
    [' 13.5 ', 13.5],
    ['', null],
    ['abc', null],
  ])('parseNumber("%s") should be %s', (text, expected) => {
    expect(parseNumber(text)).toBe(expected);
  });

  it('parseList should split on commas and semicolons, trim and dedupe', () => {
    expect(parseList(' Merlot, Cabernet Franc ;Merlot,, ')).toEqual(['Merlot', 'Cabernet Franc']);
  });

  it('pluralKey should follow French rules', () => {
    expect(pluralKey('cave.bottles', 0)).toBe('cave.bottles.one');
    expect(pluralKey('cave.bottles', 1)).toBe('cave.bottles.one');
    expect(pluralKey('cave.bottles', 2)).toBe('cave.bottles.other');
  });
});

describe('formatDrinkWindow', () => {
  it.each([
    [2024, 2030, '2024 – 2030'],
    [2026, 2026, '2026'],
    [2024, null, 'dès 2024'],
    [null, 2030, "jusqu'en 2030"],
    [null, null, null],
  ])('formatDrinkWindow(%s, %s) should be %s', (from, until, expected) => {
    expect(formatDrinkWindow(from, until)).toBe(expected);
  });
});
