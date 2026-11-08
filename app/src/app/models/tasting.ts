export interface Tasting {
  id: string;
  wineId: string;
  score: 1 | 2 | 3 | 4 | 5;
  likedDescriptors: string[];
  dislikedDescriptors: string[];
  comment: string;
  context: string;
  rebuy: boolean;
  date: string;
}

export interface TasteAxes {
  fruit: number;
  freshness: number;
  spice: number;
  power: number;
  oak: number;
}

export interface TasteProfile {
  id: 'current';
  summary: string;
  axes: TasteAxes;
  favoriteGrapes: string[];
  avoidPatterns: string[];
  basedOnTastings: number;
  generatedAt: string;
}

export interface ProfileOverride {
  id: string;
  field: string;
  userValue: string;
  reason: string;
  date: string;
}
