import { Tasting } from '../models/tasting';
import { Wine } from '../models/wine';

/** Moyenne des notes à partir de laquelle un vin dégusté est une étoile. */
export const STAR_MIN_SCORE = 4;
/** Affinité donnée par Claude (sur 10) à partir de laquelle un vin pas encore dégusté est une étoile. */
export const STAR_MIN_AFFINITY = 8;

/** Grand cru selon l'évaluation de Claude dans le conseil de la fiche ; rien tant que le conseil n'existe pas. */
export function isGrandCru(wine: Pick<Wine, 'advice'>): boolean {
  return wine.advice?.grandCru === true;
}

/**
 * Vins qui vous conviennent le mieux. Dégusté : moyenne de vos notes d'au moins 4 sur 5.
 * Pas encore dégusté : affinité d'au moins 8 sur 10 dans le conseil de Claude.
 */
export function starWineIds(wines: readonly Wine[], tastings: readonly Tasting[]): Set<string> {
  const scores = new Map<string, number[]>();
  for (const tasting of tastings) {
    scores.set(tasting.wineId, [...(scores.get(tasting.wineId) ?? []), tasting.score]);
  }
  const stars = wines.filter((wine) => {
    const own = scores.get(wine.id);
    if (own?.length) {
      return own.reduce((sum, score) => sum + score, 0) / own.length >= STAR_MIN_SCORE;
    }
    return (wine.advice?.affinity ?? 0) >= STAR_MIN_AFFINITY;
  });
  return new Set(stars.map((wine) => wine.id));
}
