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

export interface PairingRequest {
  id: string;
  dish: string;
  photoId: string | null;
  topPickWineId: string | null;
  alternatives: PairingChoice[];
  rejected: PairingChoice[];
  date: string;
}
