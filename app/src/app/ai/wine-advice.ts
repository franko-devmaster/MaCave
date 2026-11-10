import type { BetaContentBlockParam } from '@anthropic-ai/sdk/resources/beta/messages/messages';
import type { StructuredRequest } from '../services/claude.service';
import { TasteProfile, Tasting } from '../models/tasting';
import { ADVICE_STATUSES, AdviceStatus, PDF_MEDIA_TYPE, Wine } from '../models/wine';
import { InvalidResponseError } from './claude-errors';
import { profileText } from './pairing';

export interface AdviceParsed {
  status: AdviceStatus;
  text: string;
  infoSummary: string | null;
}

/** Fiche info jointe à la demande : PDF ou image JPEG, en base64. */
export interface InfoFile {
  mediaType: string;
  base64: string;
}

export const WINE_ADVICE_SCHEMA: Record<string, unknown> = {
  type: 'object',
  additionalProperties: false,
  required: ['status', 'text', 'infoSummary'],
  properties: {
    status: { type: 'string', enum: [...ADVICE_STATUSES] },
    text: { type: 'string' },
    infoSummary: { anyOf: [{ type: 'string' }, { type: 'null' }] },
  },
};

export const WINE_ADVICE_SYSTEM = `Tu conseilles une personne sur une bouteille de sa propre cave. Tu réponds selon le schéma imposé, en français, en la vouvoyant.

- status : trop-jeune (mieux vaut attendre), pret (bon maintenant, peut encore attendre), apogee (son meilleur moment), declin (à boire sans tarder), inconnu (pas assez d'informations).
- text : trois phrases au plus. Quand l'ouvrir ; comment la servir (température, carafe ou aération) ; deux ou trois plats qui lui iront, en tenant compte des goûts de la personne. L'état de garde est déjà affiché à part : ne le répète pas, commence directement par le conseil.

- infoSummary : si une fiche info est jointe (descriptif du producteur ou du vendeur, en PDF ou en photo), un résumé factuel en deux phrases au plus : élevage, style, garde, accords conseillés. Sans fiche info : null.

Règles : appuie-toi sur le type de vin, l'appellation, le millésime, la fenêtre de garde, la fiche info si elle est jointe, et ses propres dégustations de ce vin. La fiche info prime sur tes estimations générales, jamais sur les dégustations de la personne. N'invente aucun fait sur le producteur. Pas de formule de politesse.`;

/** Le vin, son stock, ses dégustations par la personne. */
export function wineText(wine: Wine, bottles: number, tastings: readonly Tasting[]): string {
  const keeping = wine.drinkFrom !== null || wine.drinkUntil !== null ? `garde ${wine.drinkFrom ?? '?'}–${wine.drinkUntil ?? '?'}` : '';
  const facts = [
    [wine.name, wine.vintage].filter(Boolean).join(' '),
    wine.producer,
    wine.color,
    wine.appellation,
    [wine.region, wine.country].filter(Boolean).join(', '),
    wine.grapes.length ? `cépages : ${wine.grapes.join(', ')}` : '',
    wine.alcohol !== null ? `${wine.alcohol} % vol.` : '',
    wine.sweetness ?? '',
    keeping,
    `${bottles} btl en cave`,
  ];
  const own = tastings
    .filter((t) => t.wineId === wine.id)
    .map((t) => `- ${t.date.slice(0, 10)} : ${t.score}/5${t.comment ? ` « ${t.comment} »` : ''}${t.context ? `, avec ${t.context}` : ''}`);
  return `Vin : ${facts.filter(Boolean).join(' | ')}\n${own.length ? `Ses dégustations de ce vin :\n${own.join('\n')}` : 'Pas encore dégusté.'}`;
}

export function parseWineAdvice(raw: unknown): AdviceParsed {
  if (typeof raw !== 'object' || raw === null) {
    throw new InvalidResponseError('objet attendu');
  }
  const { status, text, infoSummary } = raw as Record<string, unknown>;
  const trimmed = typeof text === 'string' ? text.trim() : '';
  if (!trimmed) {
    throw new InvalidResponseError('conseil manquant');
  }
  return {
    status: typeof status === 'string' && (ADVICE_STATUSES as readonly string[]).includes(status) ? (status as AdviceStatus) : 'inconnu',
    text: trimmed,
    infoSummary: typeof infoSummary === 'string' && infoSummary.trim() ? infoSummary.trim() : null,
  };
}

export function wineAdviceContent(
  wine: Wine,
  bottles: number,
  tastings: readonly Tasting[],
  profile: TasteProfile | null,
  today: Date,
  info: InfoFile | null,
): BetaContentBlockParam[] {
  const content: BetaContentBlockParam[] = [
    { type: 'text', text: `Nous sommes en ${today.getFullYear()}.\n\n${profileText(profile)}\n\n${wineText(wine, bottles, tastings)}` },
  ];
  if (info?.mediaType === PDF_MEDIA_TYPE) {
    content.push({ type: 'document', source: { type: 'base64', media_type: PDF_MEDIA_TYPE, data: info.base64 }, title: 'Fiche info' });
  } else if (info) {
    content.push({ type: 'image', source: { type: 'base64', media_type: 'image/jpeg', data: info.base64 } });
  }
  content.push({ type: 'text', text: info ? 'La fiche info de ce vin est jointe. Ton conseil ?' : 'Pas de fiche info pour ce vin. Ton conseil ?' });
  return content;
}

export function wineAdviceRequest(
  wine: Wine,
  bottles: number,
  tastings: readonly Tasting[],
  profile: TasteProfile | null,
  today: Date,
  info: InfoFile | null = null,
): StructuredRequest<AdviceParsed> {
  return {
    system: WINE_ADVICE_SYSTEM,
    content: wineAdviceContent(wine, bottles, tastings, profile, today, info),
    schema: WINE_ADVICE_SCHEMA,
    effort: 'low',
    parse: parseWineAdvice,
  };
}

/** Un conseil reste valable tant que le vin n'a pas été modifié et que l'année n'a pas changé. */
export function isAdviceFresh(wine: Wine, today: Date): boolean {
  const advice = wine.advice;
  if (!advice) {
    return false;
  }
  return (
    advice.generatedAt >= wine.updatedAt &&
    new Date(advice.generatedAt).getFullYear() === today.getFullYear() &&
    (advice.infoAttachmentId ?? null) === (wine.infoAttachmentId ?? null)
  );
}

/** Résumé de la fiche info, seulement s'il correspond à la fiche info actuelle du vin. */
export function currentInfoSummary(wine: Wine): string | null {
  const advice = wine.advice;
  if (!advice?.infoSummary || !wine.infoAttachmentId || advice.infoAttachmentId !== wine.infoAttachmentId) {
    return null;
  }
  return advice.infoSummary;
}
