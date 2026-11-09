/** Descripteurs proposés après une dégustation. Les identifiants sont stockés ; le libellé vient des traductions. */
export const LIKED_DESCRIPTORS = ['fruite', 'epice', 'boise', 'tanins-souples', 'mineral', 'puissant', 'leger', 'long'] as const;
export const DISLIKED_DESCRIPTORS = ['trop-acide', 'trop-boise', 'finale-courte', 'alcool-marque', 'bouchonne'] as const;

const KNOWN: ReadonlySet<string> = new Set<string>([...LIKED_DESCRIPTORS, ...DISLIKED_DESCRIPTORS]);

/** Clé de traduction d'un descripteur prédéfini, ou null pour un descripteur saisi librement. */
export function descriptorKey(value: string): string | null {
  return KNOWN.has(value) ? `descriptors.${value}` : null;
}
