import { Tasting } from '../models/tasting';
import { Wine } from '../models/wine';
import { normalize } from './cellar';

/** Moyenne des notes à partir de laquelle un vin dégusté est une étoile. */
export const STAR_MIN_SCORE = 4;

/** Grand cru : la mention figure dans le nom ou l'appellation (Dézaley Grand Cru, Grand Cru Classé…). */
export function isGrandCru(wine: Pick<Wine, 'name' | 'appellation'>): boolean {
  return normalize(`${wine.name} ${wine.appellation}`).includes('grand cru');
}

/**
 * Vins qui vous conviennent le mieux. Dégusté : moyenne de vos notes d'au moins 4 sur 5.
 * Pas encore dégusté : un de ses cépages fait partie des favoris de votre profil.
 */
export function starWineIds(wines: readonly Wine[], tastings: readonly Tasting[], favoriteGrapes: readonly string[]): Set<string> {
  const scores = new Map<string, number[]>();
  for (const tasting of tastings) {
    scores.set(tasting.wineId, [...(scores.get(tasting.wineId) ?? []), tasting.score]);
  }
  const favorites = new Set(favoriteGrapes.map(normalize));
  const stars = wines.filter((wine) => {
    const own = scores.get(wine.id);
    if (own?.length) {
      return own.reduce((sum, score) => sum + score, 0) / own.length >= STAR_MIN_SCORE;
    }
    return wine.grapes.some((grape) => favorites.has(normalize(grape)));
  });
  return new Set(stars.map((wine) => wine.id));
}
