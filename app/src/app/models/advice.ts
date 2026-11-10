export type VerdictLevel = 'plaira' | 'mitige' | 'deconseille';

export interface VerdictReason {
  sign: '+' | '-' | 'i';
  text: string;
}

export interface Verdict {
  id: string;
  wineIdentified: Record<string, unknown>;
  affinity: number;
  level: VerdictLevel;
  reasons: VerdictReason[];
  outcome: 'achete' | 'passe' | null;
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
