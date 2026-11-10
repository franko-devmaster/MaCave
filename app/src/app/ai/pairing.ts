import type { BetaContentBlockParam } from '@anthropic-ai/sdk/resources/beta/messages/messages';
import type { StructuredRequest } from '../services/claude.service';
import { PairingAnswer, PairingChoice } from '../models/advice';
import { TasteProfile, Tasting } from '../models/tasting';
import { CellarEntry } from '../utils/cellar';
import { InvalidResponseError } from './claude-errors';
import { currentInfoSummary } from './wine-advice';

export const MAX_ALTERNATIVES = 2;
export const MAX_REJECTED = 3;

export interface PairingParsed extends PairingAnswer {
  notADish: boolean;
}

export interface DishSource {
  text: string;
  photoBase64: string | null;
}

const choice = {
  type: 'object',
  additionalProperties: false,
  required: ['wineId', 'reason'],
  properties: { wineId: { type: 'string' }, reason: { type: 'string' } },
};

export const PAIRING_SCHEMA: Record<string, unknown> = {
  type: 'object',
  additionalProperties: false,
  required: ['notADish', 'dish', 'topPick', 'alternatives', 'rejected', 'buyAdvice'],
  properties: {
    notADish: { type: 'boolean' },
    dish: { type: 'string' },
    topPick: {
      anyOf: [
        {
          type: 'object',
          additionalProperties: false,
          required: ['wineId', 'reason', 'service'],
          properties: { wineId: { type: 'string' }, reason: { type: 'string' }, service: { type: 'string' } },
        },
        { type: 'null' },
      ],
    },
    alternatives: { type: 'array', items: choice },
    rejected: { type: 'array', items: choice },
    buyAdvice: { anyOf: [{ type: 'string' }, { type: 'null' }] },
  },
};

export const PAIRING_SYSTEM = `Tu es le sommelier personnel d'une seule personne. Elle cuisine chez elle et te demande quel vin de sa cave ouvrir avec son plat. Tu connais son profil de goûts, ses dégustations et le contenu exact de sa cave. Tu réponds selon le schéma imposé, en français, en la vouvoyant.

- dish : le plat tel que tu le comprends, en quelques mots (utile surtout quand il vient d'une photo).
- topPick : le meilleur vin de la cave pour ce plat. reason : deux phrases au plus, concrètes, qui disent pourquoi l'accord fonctionne ; cite ses propres notes ou son profil quand c'est pertinent. service : une ligne (température, carafage ou ouverture à l'avance).
- alternatives : jusqu'à ${MAX_ALTERNATIVES} autres vins de la cave qui conviennent, chacun avec une phrase.
- rejected : jusqu'à ${MAX_REJECTED} vins de la cave qui pourraient sembler convenir mais que tu écartes, avec la raison en quelques mots.
- buyAdvice : seulement si aucun vin de la cave ne convient vraiment ; le style de vin à acheter, en une ou deux phrases. Sinon null.

Règles :
- Ne propose que des vins de la liste, par leur identifiant exact. N'invente aucun vin.
- Respecte son profil : ses goûts priment sur les accords classiques quand ils divergent.
- Privilégie les vins à boire maintenant. Évite les vins trop jeunes, sauf s'il n'y a pas mieux ; dis-le alors.
- Si rien ne convient vraiment, mets topPick à null et remplis buyAdvice. Ne force pas un mauvais accord.
- Si la photo ne montre ni un plat ni une recette, mets notADish à true, dish à une chaîne vide, topPick à null et les listes vides.`;

export function profileText(profile: TasteProfile | null): string {
  if (!profile) {
    return 'Profil de goûts : pas encore établi.';
  }
  const axes = `fruit ${profile.axes.fruit}, fraîcheur ${profile.axes.freshness}, épices ${profile.axes.spice}, puissance ${profile.axes.power}, boisé ${profile.axes.oak}`;
  const lines = [`Profil de goûts : « ${profile.summary} »`, `Axes recherchés sur 10 : ${axes}.`];
  if (profile.favoriteGrapes.length) {
    lines.push(`Cépages qui lui réussissent : ${profile.favoriteGrapes.join(', ')}.`);
  }
  if (profile.avoidPatterns.length) {
    lines.push(`À éviter : ${profile.avoidPatterns.join(', ')}.`);
  }
  return lines.join('\n');
}

/** Vins en stock seulement, avec garde, notes et plats déjà associés par l'utilisateur. */
export function cellarText(entries: readonly CellarEntry[], tastings: readonly Tasting[], year: number): string {
  const inStock = entries.filter((e) => e.bottles > 0);
  if (!inStock.length) {
    return 'Cave : aucune bouteille en stock.';
  }
  const lines = inStock.map(({ wine, bottles, drinkNow }) => {
    const own = tastings.filter((t) => t.wineId === wine.id);
    const contexts = [...new Set(own.map((t) => t.context).filter(Boolean))];
    const parts = [
      `id=${wine.id}`,
      [wine.name, wine.vintage].filter(Boolean).join(' '),
      wine.producer,
      wine.color,
      [wine.region, wine.country].filter(Boolean).join(', '),
      wine.grapes.length ? `cépages : ${wine.grapes.join(', ')}` : '',
      `${bottles} btl`,
      keepingText(wine.drinkFrom, wine.drinkUntil, drinkNow, year),
      own.length ? `ses notes : ${own.map((t) => `${t.score}/5`).join(', ')}` : '',
      contexts.length ? `déjà bu avec : ${contexts.join(', ')}` : '',
      currentInfoSummary(wine) ? `fiche info : ${currentInfoSummary(wine)}` : '',
    ];
    return `- ${parts.filter(Boolean).join(' | ')}`;
  });
  return `Cave (${inStock.length} vins en stock) :\n${lines.join('\n')}`;
}

export function pairingContent(
  source: DishSource,
  profile: TasteProfile | null,
  entries: readonly CellarEntry[],
  tastings: readonly Tasting[],
  year: number,
): BetaContentBlockParam[] {
  const content: BetaContentBlockParam[] = [{ type: 'text', text: `${profileText(profile)}\n\n${cellarText(entries, tastings, year)}` }];
  const text = source.text.trim();
  if (source.photoBase64) {
    content.push({ type: 'image', source: { type: 'base64', media_type: 'image/jpeg', data: source.photoBase64 } });
    content.push({ type: 'text', text: text ? `Le plat est sur la photo. Précision : « ${text} »` : 'Le plat est sur la photo (plat préparé ou recette).' });
  } else {
    content.push({ type: 'text', text: `Plat : « ${text} »` });
  }
  return content;
}

/** Ne garde que des vins en stock ; un vin ne figure qu'une fois dans toute la réponse. */
export function parsePairing(raw: unknown, inStockIds: ReadonlySet<string>): PairingParsed {
  if (!isRecord(raw)) {
    throw new InvalidResponseError('objet attendu');
  }
  const notADish = raw['notADish'] === true;
  const used = new Set<string>();
  const rawPick = raw['topPick'];
  let topPick: PairingParsed['topPick'] = null;
  if (isRecord(rawPick) && typeof rawPick['wineId'] === 'string' && inStockIds.has(rawPick['wineId']) && text(rawPick['reason'])) {
    topPick = { wineId: rawPick['wineId'], reason: text(rawPick['reason']), service: text(rawPick['service']) };
    used.add(topPick.wineId);
  }
  const alternatives = choices(raw['alternatives'], inStockIds, used, MAX_ALTERNATIVES);
  const rejected = choices(raw['rejected'], inStockIds, used, MAX_REJECTED);
  const buyAdvice = text(raw['buyAdvice']) || null;
  if (!notADish && !topPick && !buyAdvice) {
    throw new InvalidResponseError('aucune proposition');
  }
  return { notADish, dish: text(raw['dish']), topPick, alternatives, rejected, buyAdvice };
}

export function pairingRequest(
  source: DishSource,
  profile: TasteProfile | null,
  entries: readonly CellarEntry[],
  tastings: readonly Tasting[],
  year: number,
): StructuredRequest<PairingParsed> {
  const inStock = new Set(entries.filter((e) => e.bottles > 0).map((e) => e.wine.id));
  return {
    system: PAIRING_SYSTEM,
    content: pairingContent(source, profile, entries, tastings, year),
    schema: PAIRING_SCHEMA,
    effort: 'medium',
    parse: (raw) => parsePairing(raw, inStock),
  };
}

function keepingText(from: number | null, until: number | null, drinkNow: boolean, year: number): string {
  if (from !== null && from > year) {
    return `trop jeune, à boire dès ${from}`;
  }
  if (drinkNow) {
    return 'à boire maintenant';
  }
  if (from !== null || until !== null) {
    return `garde ${from ?? '?'}–${until ?? '?'}`;
  }
  return '';
}

function choices(value: unknown, known: ReadonlySet<string>, used: Set<string>, max: number): PairingChoice[] {
  if (!Array.isArray(value)) {
    return [];
  }
  const result: PairingChoice[] = [];
  for (const item of value) {
    if (result.length >= max) {
      break;
    }
    if (isRecord(item) && typeof item['wineId'] === 'string' && known.has(item['wineId']) && !used.has(item['wineId']) && text(item['reason'])) {
      used.add(item['wineId']);
      result.push({ wineId: item['wineId'], reason: text(item['reason']) });
    }
  }
  return result;
}

function text(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
