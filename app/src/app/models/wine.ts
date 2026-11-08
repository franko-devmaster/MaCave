export type WineColor = 'rouge' | 'blanc' | 'rose' | 'bulles';

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
  sweetness: 'sec' | 'demi-sec' | 'doux' | null;
  drinkFrom: number | null;
  drinkUntil: number | null;
  labelPhotoId: string | null;
  location: string;
  notes: string;
  createdAt: string;
  updatedAt: string;
}

export interface Photo {
  id: string;
  blob: Blob;
  width: number;
  height: number;
  createdAt: string;
}

export type StockReason = 'achat' | 'ouverture' | 'casse' | 'cadeau';

export interface StockMovement {
  id: string;
  wineId: string;
  delta: number;
  reason: StockReason;
  pricePaid: number | null;
  date: string;
}
