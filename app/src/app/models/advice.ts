import type { LabelReading } from '../ai/label-reading';

export const VERDICT_LEVELS = ['plaira', 'mitige', 'deconseille'] as const;
export type VerdictLevel = (typeof VERDICT_LEVELS)[number];

export const REASON_SIGNS = ['+', '-', 'i'] as const;
export type ReasonSign = (typeof REASON_SIGNS)[number];

export interface VerdictReason {
  sign: ReasonSign;
  text: string;
}

export interface Verdict {
  id: string;
  wineIdentified: LabelReading;
  affinity: number;
  level: VerdictLevel;
  reasons: VerdictReason[];
  outcome: 'achete' | 'passe' | null;
  /** Vin de la cave créé ou complété après achat : sert à calibrer les verdicts suivants. */
  boughtWineId: string | null;
  date: string;
}

export interface PairingChoice {
  wineId: string;
  reason: string;
}

export interface PairingPick extends PairingChoice {
  /** Conseil de service : température, carafage. */
  service: string;
}

/** Réponse de Claude à une demande d'accord, validée. */
export interface PairingAnswer {
  dish: string;
  topPick: PairingPick | null;
  alternatives: PairingChoice[];
  rejected: PairingChoice[];
  /** Type de vin à acheter quand rien ne convient en cave. */
  buyAdvice: string | null;
}

export interface PairingRequest extends PairingAnswer {
  id: string;
  /** Texte saisi par l'utilisateur, vide pour une photo seule. */
  query: string;
  /** Les photos de plats ne sont pas conservées. */
  photoId: null;
  date: string;
}
