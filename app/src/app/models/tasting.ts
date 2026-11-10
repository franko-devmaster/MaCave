export const SCORES = [1, 2, 3, 4, 5] as const;
export type Score = (typeof SCORES)[number];

export interface Tasting {
  id: string;
  wineId: string;
  score: Score;
  likedDescriptors: string[];
  dislikedDescriptors: string[];
  comment: string;
  context: string;
  rebuy: boolean;
  date: string;
}

/** Champs saisis ; l'identifiant et la date sont gérés par le dépôt. */
export type TastingInput = Omit<Tasting, 'id' | 'date'>;

export const TASTE_AXES = ['fruit', 'freshness', 'spice', 'power', 'oak'] as const;
export type TasteAxis = (typeof TASTE_AXES)[number];
export type TasteAxes = Record<TasteAxis, number>;

export interface TasteProfile {
  id: 'current';
  summary: string;
  axes: TasteAxes;
  favoriteGrapes: string[];
  avoidPatterns: string[];
  basedOnTastings: number;
  generatedAt: string;
  /** Empreinte des dégustations et corrections utilisées : le profil est à recalculer quand elle change. */
  sourceSignature: string;
}

/** Corrections de l'utilisateur, prioritaires sur les déductions de Claude. */
export type ProfileOverrideField = `axis:${TasteAxis}` | 'remove-grape' | 'remove-avoid' | 'note';

export interface ProfileOverride {
  id: string;
  field: ProfileOverrideField;
  userValue: string;
  reason: string;
  date: string;
}

export type ProfileOverrideInput = Pick<ProfileOverride, 'field' | 'userValue'>;
