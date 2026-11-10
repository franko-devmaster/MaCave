import type { BetaContentBlockParam } from '@anthropic-ai/sdk/resources/beta/messages/messages';
import type { StructuredRequest } from '../services/claude.service';
import { DESCRIPTOR_PROMPT_LABELS } from '../constants/descriptors';
import { ProfileOverride, TASTE_AXES, TasteAxes, Tasting } from '../models/tasting';
import { Wine } from '../models/wine';
import { axisOf } from '../utils/profile';
import { InvalidResponseError } from './claude-errors';

export const MAX_FAVORITE_GRAPES = 6;
export const MAX_AVOID_PATTERNS = 4;

/** Ce que Claude renvoie ; le datastore ajoute la date, le nombre de dégustations et la signature. */
export interface ProfileSynthesis {
  summary: string;
  axes: TasteAxes;
  favoriteGrapes: string[];
  avoidPatterns: string[];
}

const AXIS_PROMPT_LABELS: Record<(typeof TASTE_AXES)[number], string> = {
  fruit: 'fruit',
  freshness: 'fraîcheur',
  spice: 'épices',
  power: 'puissance',
  oak: 'boisé',
};

export const TASTE_PROFILE_SCHEMA: Record<string, unknown> = {
  type: 'object',
  additionalProperties: false,
  required: ['summary', 'axes', 'favoriteGrapes', 'avoidPatterns'],
  properties: {
    summary: { type: 'string' },
    axes: {
      type: 'object',
      additionalProperties: false,
      required: [...TASTE_AXES],
      properties: Object.fromEntries(TASTE_AXES.map((axis) => [axis, { type: 'integer' }])),
    },
    favoriteGrapes: { type: 'array', items: { type: 'string' } },
    avoidPatterns: { type: 'array', items: { type: 'string' } },
  },
};

export const TASTE_PROFILE_SYSTEM = `Tu tiens le profil de goûts en vin d'une seule personne, à partir de ses dégustations notées. Ce profil servira ensuite à lui conseiller des vins de sa cave et à juger des vins en magasin. Tu réponds selon le schéma imposé, en français.

- summary : une phrase, deux au plus, 30 mots au maximum. Elle décrit ce que la personne aime vraiment, de façon concrète (style, régions, cépages, structure), sans flatterie ni généralités sur le vin.
- axes : de 0 à 10, à quel point la personne recherche chaque trait. fruit = vins fruités ; freshness = acidité, tension, fraîcheur ; spice = notes épicées ; power = corps, puissance, alcool ; oak = élevage en bois perceptible. 5 signifie indifférent ou inconnu.
- favoriteGrapes : au plus ${MAX_FAVORITE_GRAPES} cépages qui lui réussissent, du plus sûr au moins sûr.
- avoidPatterns : au plus ${MAX_AVOID_PATTERNS} profils de vins à éviter, en quatre mots au plus chacun (par exemple « Chardonnay boisé », « Rouges confiturés »).

Règles :
- Appuie-toi uniquement sur les dégustations fournies. Les notes élevées, les mentions « à racheter » et les dégustations récentes pèsent davantage.
- Les corrections de l'utilisateur priment sur tes déductions : respecte-les exactement et n'affirme jamais le contraire.
- Avec peu de dégustations, reste prudent : axes proches de 5 quand l'information manque, listes courtes, voire vides.`;

/** Une ligne par dégustation, avec le vin dégusté. */
export function tastingsText(tastings: readonly Tasting[], wines: readonly Wine[]): string {
  const byId = new Map(wines.map((w) => [w.id, w]));
  const lines = [...tastings]
    .sort((a, b) => a.date.localeCompare(b.date))
    .map((t) => {
      const wine = byId.get(t.wineId);
      const parts = [
        t.date.slice(0, 10),
        wine ? [wine.name, wine.vintage, wine.producer && `, ${wine.producer}`].filter(Boolean).join(' ').replace(' ,', ',') : 'vin inconnu',
        wine?.color ?? '',
        wine ? [wine.country, wine.region].filter(Boolean).join(', ') : '',
        wine?.grapes.length ? `cépages : ${wine.grapes.join(', ')}` : '',
        `note ${t.score}/5`,
        t.likedDescriptors.length ? `aimé : ${t.likedDescriptors.map(label).join(', ')}` : '',
        t.dislikedDescriptors.length ? `gêné : ${t.dislikedDescriptors.map(label).join(', ')}` : '',
        t.comment ? `« ${t.comment} »` : '',
        t.context ? `avec : ${t.context}` : '',
        t.rebuy ? 'à racheter' : '',
      ];
      return `- ${parts.filter(Boolean).join(' | ')}`;
    });
  return `Dégustations (${tastings.length}) :\n${lines.join('\n')}`;
}

export function overridesText(overrides: readonly ProfileOverride[]): string {
  if (!overrides.length) {
    return 'Corrections de l’utilisateur : aucune.';
  }
  const lines = [...overrides]
    .sort((a, b) => a.date.localeCompare(b.date))
    .map((o) => {
      const axis = axisOf(o.field);
      if (axis) {
        return `- Axe ${AXIS_PROMPT_LABELS[axis]} : ${o.userValue}/10`;
      }
      if (o.field === 'remove-grape') {
        return `- Ne pas citer comme cépage favori : ${o.userValue}`;
      }
      if (o.field === 'remove-avoid') {
        return `- Ne pas citer comme profil à éviter : ${o.userValue}`;
      }
      return `- Précision : « ${o.userValue} »`;
    });
  return `Corrections de l’utilisateur (prioritaires) :\n${lines.join('\n')}`;
}

export function tasteProfileContent(tastings: readonly Tasting[], wines: readonly Wine[], overrides: readonly ProfileOverride[]): BetaContentBlockParam[] {
  return [
    { type: 'text', text: tastingsText(tastings, wines) },
    { type: 'text', text: `${overridesText(overrides)}\n\nMets à jour le profil.` },
  ];
}

export function parseProfileSynthesis(raw: unknown): ProfileSynthesis {
  if (!isRecord(raw) || !isRecord(raw['axes'])) {
    throw new InvalidResponseError('objet attendu');
  }
  const summary = typeof raw['summary'] === 'string' ? raw['summary'].trim() : '';
  if (!summary) {
    throw new InvalidResponseError('synthèse manquante');
  }
  const rawAxes = raw['axes'];
  const axes = Object.fromEntries(
    TASTE_AXES.map((axis) => {
      const value = rawAxes[axis];
      if (typeof value !== 'number' || !Number.isFinite(value)) {
        throw new InvalidResponseError(`axe ${axis} manquant`);
      }
      return [axis, Math.min(10, Math.max(0, Math.round(value)))];
    }),
  ) as TasteAxes;
  return {
    summary,
    axes,
    favoriteGrapes: list(raw['favoriteGrapes'], MAX_FAVORITE_GRAPES),
    avoidPatterns: list(raw['avoidPatterns'], MAX_AVOID_PATTERNS),
  };
}

export function tasteProfileRequest(
  tastings: readonly Tasting[],
  wines: readonly Wine[],
  overrides: readonly ProfileOverride[],
): StructuredRequest<ProfileSynthesis> {
  return {
    system: TASTE_PROFILE_SYSTEM,
    content: tasteProfileContent(tastings, wines, overrides),
    schema: TASTE_PROFILE_SCHEMA,
    effort: 'medium',
    parse: parseProfileSynthesis,
  };
}

function label(descriptor: string): string {
  return DESCRIPTOR_PROMPT_LABELS[descriptor] ?? descriptor;
}

function list(value: unknown, max: number): string[] {
  if (!Array.isArray(value)) {
    return [];
  }
  const items = value.filter((v): v is string => typeof v === 'string').map((v) => v.trim()).filter(Boolean);
  return [...new Set(items)].slice(0, max);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
