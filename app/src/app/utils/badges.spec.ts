import { Tasting } from '../models/tasting';
import { wine } from '../testing/fixtures';
import { isGrandCru, starWineIds } from './badges';

function tasting(wineId: string, score: Tasting['score']): Tasting {
  return { id: `${wineId}-${score}-${Math.random()}`, wineId, score, likedDescriptors: [], dislikedDescriptors: [], comment: '', context: '', rebuy: false, date: '' };
}

describe('badges', () => {
  it.each([
    ['Dézaley', 'Dézaley Grand Cru', true],
    ['Château Figeac', 'Saint-Émilion Grand Cru Classé', true],
    ['Calamin GRAND CRU', '', true],
    ['Chablis', 'Premier Cru', false],
    ['Cornalin', 'Valais AOC', false],
  ])('isGrandCru when name is %s and appellation %s should be %s', (name, appellation, expected) => {
    expect(isGrandCru({ name, appellation })).toBe(expected);
  });

  it('starWineIds when tasted should require an average of at least 4', () => {
    const wines = [wine('a'), wine('b'), wine('c')];
    const tastings = [tasting('a', 5), tasting('a', 3), tasting('b', 4), tasting('b', 3), tasting('c', 4)];

    expect(starWineIds(wines, tastings, [])).toEqual(new Set(['a', 'c']));
  });

  it('starWineIds when not tasted should match a favorite grape, ignoring case and accents', () => {
    const wines = [wine('a', { grapes: ['Pinot noir'] }), wine('b', { grapes: ['Chardonnay'] }), wine('c', { grapes: ['Humagne Rouge'] })];

    expect(starWineIds(wines, [], ['Pinot Noir', 'humagne rouge'])).toEqual(new Set(['a', 'c']));
  });

  it('starWineIds should let a poor tasting override a favorite grape', () => {
    const wines = [wine('a', { grapes: ['Cornalin'] })];

    expect(starWineIds(wines, [tasting('a', 2)], ['Cornalin']).size).toBe(0);
  });
});
