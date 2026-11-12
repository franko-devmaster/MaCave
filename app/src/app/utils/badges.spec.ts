import { Tasting } from '../models/tasting';
import { WineAdvice } from '../models/wine';
import { wine } from '../testing/fixtures';
import { isGrandCru, starWineIds, wineBadges } from './badges';

function tasting(wineId: string, score: Tasting['score']): Tasting {
  return { id: `${wineId}-${score}-${Math.random()}`, wineId, score, likedDescriptors: [], dislikedDescriptors: [], comment: '', context: '', rebuy: false, date: '' };
}

function advice(overrides: Partial<WineAdvice> = {}): WineAdvice {
  return { status: 'pret', text: '', generatedAt: '2026-11-01T00:00:00Z', affinity: null, grandCru: false, ...overrides };
}

describe('badges', () => {
  it('isGrandCru should follow the evaluation of Claude, not the name', () => {
    expect(isGrandCru(wine('a', { name: 'Château Margaux', advice: advice({ grandCru: true }) }))).toBe(true);
    expect(isGrandCru(wine('b', { name: 'Saint-Émilion Grand Cru', advice: advice({ grandCru: false }) }))).toBe(false);
    expect(isGrandCru(wine('c', { name: 'Dézaley Grand Cru', advice: null }))).toBe(false);
  });

  it('starWineIds when tasted should require an average of at least 4, whatever the affinity', () => {
    const wines = [wine('a'), wine('b', { advice: advice({ affinity: 10 }) }), wine('c')];
    const tastings = [tasting('a', 5), tasting('a', 3), tasting('b', 3), tasting('c', 4)];

    expect(starWineIds(wines, tastings)).toEqual(new Set(['a', 'c']));
  });

  it('starWineIds when not tasted should require an affinity of at least 8', () => {
    const wines = [wine('a', { advice: advice({ affinity: 8 }) }), wine('b', { advice: advice({ affinity: 7 }) }), wine('c', { advice: null })];

    expect(starWineIds(wines, [])).toEqual(new Set(['a']));
  });

  it('wineBadges should list the drinking state, the star and the grand cru in this order', () => {
    expect(wineBadges({ wine: wine('a', { advice: advice({ grandCru: true }) }), readiness: 'soon' }, true)).toEqual(['soon', 'star', 'grand-cru']);
    expect(wineBadges({ wine: wine('b', { advice: null }), readiness: null }, false)).toEqual([]);
  });
});
