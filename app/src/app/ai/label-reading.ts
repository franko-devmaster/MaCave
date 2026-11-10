import type { BetaContentBlockParam } from '@anthropic-ai/sdk/resources/beta/messages/messages';
import type { StructuredRequest } from '../services/claude.service';
import { SWEETNESS_LEVELS, Sweetness, Wine, WINE_COLORS, WineColor } from '../models/wine';
import { InvalidResponseError } from './claude-errors';

/** Champs que Claude peut signaler comme déduits ou incertains. */
export const READING_FIELDS = [
  'name', 'producer', 'vintage', 'color', 'country', 'region', 'appellation', 'grapes',
  'alcohol', 'sweetness', 'drinkFrom', 'drinkUntil', 'quantity', 'price',
] as const;
export type ReadingField = (typeof READING_FIELDS)[number];

export interface LabelReading {
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
  quantity: number | null;
  pricePaid: number | null;
  uncertainFields: ReadingField[];
  possibleDuplicateId: string | null;
  notReadable: boolean;
}

export type LabelSource = { kind: 'photo'; base64: string } | { kind: 'text'; description: string };

const nullable = (schema: Record<string, unknown>) => ({ anyOf: [schema, { type: 'null' }] });

/** Schéma JSON strict de la réponse : chaque champ est requis, null quand l'information manque. */
export const LABEL_READING_SCHEMA: Record<string, unknown> = {
  type: 'object',
  additionalProperties: false,
  required: [
    'notReadable', 'name', 'producer', 'vintage', 'color', 'country', 'region', 'appellation', 'grapes',
    'alcohol', 'sweetness', 'drinkFrom', 'drinkUntil', 'quantity', 'pricePaid', 'uncertainFields', 'possibleDuplicateId',
  ],
  properties: {
    notReadable: { type: 'boolean' },
    name: { type: 'string' },
    producer: nullable({ type: 'string' }),
    vintage: nullable({ type: 'integer' }),
    color: { type: 'string', enum: [...WINE_COLORS] },
    country: nullable({ type: 'string' }),
    region: nullable({ type: 'string' }),
    appellation: nullable({ type: 'string' }),
    grapes: { type: 'array', items: { type: 'string' } },
    alcohol: nullable({ type: 'number' }),
    sweetness: nullable({ type: 'string', enum: [...SWEETNESS_LEVELS] }),
    drinkFrom: nullable({ type: 'integer' }),
    drinkUntil: nullable({ type: 'integer' }),
    quantity: nullable({ type: 'integer' }),
    pricePaid: nullable({ type: 'number' }),
    uncertainFields: { type: 'array', items: { type: 'string', enum: [...READING_FIELDS] } },
    possibleDuplicateId: nullable({ type: 'string' }),
  },
};

/** Règles d'identification d'un vin, partagées par la lecture d'étiquette et le verdict en magasin. */
export const LABEL_FIELD_RULES = `Valeurs attendues :
- Textes en français : pays et régions sous leur nom français (Suisse, Valais, Piémont, Bourgogne, Toscane).
- color : rouge, blanc, rose ou bulles. Les vins effervescents sont « bulles », quelle que soit leur couleur.
- name : le nom du vin tel qu'on le demanderait à un caviste (cuvée, cépage ou appellation), sans le domaine ni le millésime.
- producer : le domaine, le château ou le producteur.
- grapes : les cépages, avec leur nom usuel.
- drinkFrom et drinkUntil : la fenêtre de consommation que tu estimes d'après le type de vin, l'appellation et le millésime.
- quantity et pricePaid : seulement s'ils figurent dans la description ou sur une étiquette de prix visible ; sinon null. pricePaid est en francs suisses, par bouteille.

Règles :
- N'invente rien. Une information absente vaut null, ou une liste vide pour grapes.
- Tu peux déduire couleur, pays, région ou cépages d'une appellation ou d'un cépage quand c'est sans ambiguïté. Ajoute alors le champ dans uncertainFields.
- Mets toujours drinkFrom et drinkUntil dans uncertainFields, ainsi que tout champ dont la lecture est douteuse.
- possibleDuplicateId : l'identifiant d'un vin de la cave qui est le même vin, du même producteur et du même millésime. Sinon null.
- Si la photo n'est pas une étiquette de vin lisible, mets notReadable à true, name à une chaîne vide et le reste à null.`;

export const LABEL_READING_SYSTEM = `Tu aides à tenir l'inventaire d'une cave à vin personnelle, en Suisse romande. On te donne la photo d'une étiquette ou une courte description, et la liste des vins déjà en cave. Tu réponds selon le schéma imposé.

${LABEL_FIELD_RULES}`;

/** Liste compacte des vins en cave, pour la détection de doublons. */
export function inventoryText(wines: readonly Wine[]): string {
  if (!wines.length) {
    return 'Vins déjà en cave : aucun.';
  }
  const lines = wines.map((w) => [`id=${w.id}`, w.name, w.producer || '-', w.vintage ?? '-', w.color].join(' | '));
  return `Vins déjà en cave (id | nom | producteur | millésime | couleur) :\n${lines.join('\n')}`;
}

export function labelReadingContent(source: LabelSource, wines: readonly Wine[]): BetaContentBlockParam[] {
  const inventory: BetaContentBlockParam = { type: 'text', text: inventoryText(wines) };
  if (source.kind === 'photo') {
    return [
      inventory,
      { type: 'image', source: { type: 'base64', media_type: 'image/jpeg', data: source.base64 } },
      { type: 'text', text: 'Lis cette étiquette.' },
    ];
  }
  return [inventory, { type: 'text', text: `Description du vin : « ${source.description.trim()} »` }];
}

/** Valide et nettoie la réponse. Les valeurs hors bornes deviennent null plutôt que d'être rejetées. */
export function parseLabelReading(raw: unknown, knownWineIds: ReadonlySet<string>, currentYear: number): LabelReading {
  if (!isRecord(raw)) {
    throw new InvalidResponseError('objet attendu');
  }
  const notReadable = raw['notReadable'] === true;
  const name = text(raw['name']);
  if (!notReadable && !name) {
    throw new InvalidResponseError('nom manquant');
  }
  const color = raw['color'];
  if (!isOneOf(color, WINE_COLORS)) {
    throw new InvalidResponseError('couleur inconnue');
  }
  let drinkFrom = integerIn(raw['drinkFrom'], 1900, 2100);
  let drinkUntil = integerIn(raw['drinkUntil'], 1900, 2100);
  if (drinkFrom !== null && drinkUntil !== null && drinkFrom > drinkUntil) {
    [drinkFrom, drinkUntil] = [drinkUntil, drinkFrom];
  }
  const duplicate = raw['possibleDuplicateId'];
  const grapes = Array.isArray(raw['grapes']) ? raw['grapes'].map(text).filter(Boolean) : [];
  const uncertain = Array.isArray(raw['uncertainFields']) ? raw['uncertainFields'].filter((f) => isOneOf(f, READING_FIELDS)) : [];
  return {
    notReadable,
    name,
    producer: text(raw['producer']),
    vintage: integerIn(raw['vintage'], 1900, currentYear + 1),
    color,
    country: text(raw['country']),
    region: text(raw['region']),
    appellation: text(raw['appellation']),
    grapes: [...new Set(grapes)],
    alcohol: numberIn(raw['alcohol'], 0, 25),
    sweetness: isOneOf(raw['sweetness'], SWEETNESS_LEVELS) ? raw['sweetness'] : null,
    drinkFrom,
    drinkUntil,
    quantity: integerIn(raw['quantity'], 1, 999),
    pricePaid: numberIn(raw['pricePaid'], 0, 100_000),
    uncertainFields: [...new Set(uncertain)],
    possibleDuplicateId: typeof duplicate === 'string' && knownWineIds.has(duplicate) ? duplicate : null,
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isOneOf<T extends string>(value: unknown, allowed: readonly T[]): value is T {
  return typeof value === 'string' && (allowed as readonly string[]).includes(value);
}

function text(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

function numberIn(value: unknown, min: number, max: number): number | null {
  return typeof value === 'number' && Number.isFinite(value) && value >= min && value <= max ? value : null;
}

function integerIn(value: unknown, min: number, max: number): number | null {
  const number = numberIn(value, min, max);
  return number !== null && Number.isInteger(number) ? number : null;
}

/** Requête complète de lecture d'étiquette, prête pour ClaudeService.structured. */
export function labelReadingRequest(source: LabelSource, wines: readonly Wine[], currentYear: number): StructuredRequest<LabelReading> {
  const knownIds = new Set(wines.map((w) => w.id));
  return {
    system: LABEL_READING_SYSTEM,
    content: labelReadingContent(source, wines),
    schema: LABEL_READING_SCHEMA,
    effort: 'low',
    parse: (raw) => parseLabelReading(raw, knownIds, currentYear),
  };
}
