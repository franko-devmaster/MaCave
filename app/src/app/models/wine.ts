export const WINE_COLORS = ['rouge', 'blanc', 'rose', 'bulles'] as const;
export type WineColor = (typeof WINE_COLORS)[number];

export const SWEETNESS_LEVELS = ['sec', 'demi-sec', 'doux'] as const;
export type Sweetness = (typeof SWEETNESS_LEVELS)[number];

export const ADVICE_STATUSES = ['trop-jeune', 'pret', 'apogee', 'declin', 'inconnu'] as const;
export type AdviceStatus = (typeof ADVICE_STATUSES)[number];

/** Conseil de Claude sur une bouteille, mémorisé avec le vin. */
export interface WineAdvice {
  status: AdviceStatus;
  text: string;
  generatedAt: string;
}

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
  /** Absent sur les vins créés avant l'itération 7. */
  advice?: WineAdvice | null;
  /** Fiche info (photo ou PDF, par exemple un descriptif QoQa). Absent sur les vins plus anciens. */
  infoAttachmentId?: string | null;
}

/** Champs saisis par l'utilisateur ; l'identifiant et les dates sont gérés par le dépôt. */
export type WineInput = Omit<Wine, 'id' | 'labelPhotoId' | 'createdAt' | 'updatedAt' | 'advice' | 'infoAttachmentId'>;

export const PDF_MEDIA_TYPE = 'application/pdf';

/**
 * Fichier rattaché à un vin, stocké en octets (portable entre Safari, export JSON et tests) :
 * photo de la bouteille (JPEG) ou fiche info (JPEG ou PDF ; largeur et hauteur à 0 pour un PDF).
 */
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
