export const WINE_COLORS = ['rouge', 'blanc', 'rose', 'bulles'] as const;
export type WineColor = (typeof WINE_COLORS)[number];

export const SWEETNESS_LEVELS = ['sec', 'demi-sec', 'doux'] as const;
export type Sweetness = (typeof SWEETNESS_LEVELS)[number];

export interface Wine {
  id: string;
  name: string;
  producer: string;
  vintage: number | null;
  color: WineColor;
  country: string;
  region: string;
  appellation: string;
  grapes: string[];
  alcohol: number | null;
  sweetness: Sweetness | null;
  drinkFrom: number | null;
  drinkUntil: number | null;
  labelPhotoId: string | null;
  location: string;
  notes: string;
  createdAt: string;
  updatedAt: string;
}

/** Champs saisis par l'utilisateur ; l'identifiant et les dates sont gérés par le dépôt. */
export type WineInput = Omit<Wine, 'id' | 'labelPhotoId' | 'createdAt' | 'updatedAt'>;

/** Photo d'étiquette, stockée en octets (portable entre Safari, export JSON et tests). */
export interface Photo {
  id: string;
  bytes: ArrayBuffer;
  mediaType: string;
  width: number;
  height: number;
  createdAt: string;
}

export type PhotoInput = Omit<Photo, 'id' | 'createdAt'>;

export type StockReason = 'achat' | 'ouverture' | 'casse' | 'cadeau';

export interface StockMovement {
  id: string;
  wineId: string;
  delta: number;
  reason: StockReason;
  pricePaid: number | null;
  date: string;
}
