import { ProfileOverride, TASTE_AXES, TasteAxis, TasteProfile, Tasting } from '../models/tasting';

export const PROVISIONAL_THRESHOLD = 5;

/** Profil affiché : celui de Claude, corrigé par l'utilisateur. Les corrections l'emportent toujours. */
export function applyOverrides(profile: TasteProfile, overrides: readonly ProfileOverride[]): TasteProfile {
  const sorted = [...overrides].sort((a, b) => a.date.localeCompare(b.date));
  const axes = { ...profile.axes };
  const removedGrapes = new Set<string>();
  const removedAvoid = new Set<string>();
  for (const override of sorted) {
    const axis = axisOf(override.field);
    if (axis) {
      const value = Number(override.userValue);
      if (Number.isInteger(value) && value >= 0 && value <= 10) {
        axes[axis] = value;
      }
    } else if (override.field === 'remove-grape') {
      removedGrapes.add(key(override.userValue));
    } else if (override.field === 'remove-avoid') {
      removedAvoid.add(key(override.userValue));
    }
  }
  return {
    ...profile,
    axes,
    favoriteGrapes: profile.favoriteGrapes.filter((g) => !removedGrapes.has(key(g))),
    avoidPatterns: profile.avoidPatterns.filter((p) => !removedAvoid.has(key(p))),
  };
}

export function axisOf(field: ProfileOverride['field']): TasteAxis | null {
  const axis = field.startsWith('axis:') ? field.slice(5) : '';
  return (TASTE_AXES as readonly string[]).includes(axis) ? (axis as TasteAxis) : null;
}

/** Empreinte stable des données qui nourrissent le profil : toute note ou correction modifiée la change. */
export function profileSignature(tastings: readonly Tasting[], overrides: readonly ProfileOverride[]): string {
  const source = JSON.stringify([
    [...tastings]
      .sort((a, b) => a.id.localeCompare(b.id))
      .map((t) => [t.id, t.wineId, t.score, t.likedDescriptors, t.dislikedDescriptors, t.comment, t.context, t.rebuy]),
    [...overrides].sort((a, b) => a.id.localeCompare(b.id)).map((o) => [o.id, o.field, o.userValue]),
  ]);
  let hash = 5381;
  for (let i = 0; i < source.length; i++) {
    hash = ((hash << 5) + hash + source.charCodeAt(i)) | 0;
  }
  return `${tastings.length}-${(hash >>> 0).toString(16)}`;
}

function key(text: string): string {
  return text.trim().toLowerCase();
}
