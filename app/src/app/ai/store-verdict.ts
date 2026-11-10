import type { BetaContentBlockParam } from '@anthropic-ai/sdk/resources/beta/messages/messages';
import type { StructuredRequest } from '../services/claude.service';
import { REASON_SIGNS, Verdict, VERDICT_LEVELS, VerdictLevel, VerdictReason } from '../models/advice';
import { TasteProfile, Tasting } from '../models/tasting';
import { Wine, WINE_COLORS } from '../models/wine';
import { CellarEntry } from '../utils/cellar';
import { InvalidResponseError } from './claude-errors';
import { inventoryText, LABEL_FIELD_RULES, LABEL_READING_SCHEMA, LabelReading, LabelSource, parseLabelReading } from './label-reading';
import { profileText } from './pairing';

export const MAX_REASONS = 4;
export const CALIBRATION_SIZE = 10;

export interface StoreVerdictParsed {
  wine: LabelReading;
  level: VerdictLevel;
  affinity: number;
  reasons: VerdictReason[];
}

const COLOR_PLURALS: Record<(typeof WINE_COLORS)[number], string> = { rouge: 'rouges', blanc: 'blancs', rose: 'rosés', bulles: 'bulles' };

export const STORE_VERDICT_SCHEMA: Record<string, unknown> = {
  type: 'object',
  additionalProperties: false,
  required: ['wine', 'level', 'affinity', 'reasons'],
  properties: {
    wine: LABEL_READING_SCHEMA,
    level: { type: 'string', enum: [...VERDICT_LEVELS] },
    affinity: { type: 'integer' },
    reasons: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['sign', 'text'],
        properties: { sign: { type: 'string', enum: [...REASON_SIGNS] }, text: { type: 'string' } },
      },
    },
  },
};

export const STORE_VERDICT_SYSTEM = `Tu accompagnes une personne en magasin, devant un vin qu'elle ne connaît pas. À partir de la photo de l'étiquette ou de sa description, tu identifies le vin, puis tu dis s'il devrait lui plaire, au vu de son profil de goûts, de ses dégustations et de sa cave. Tu réponds selon le schéma imposé, en français, en la vouvoyant.

- wine : l'identification du vin, selon les règles plus bas.
- level : plaira, mitige ou deconseille.
- affinity : de 0 à 10, la probabilité qu'elle l'apprécie. Cohérent avec level : plaira à partir de 7, deconseille à 3 ou moins.
- reasons : 3 ou 4 raisons courtes, une ou deux phrases chacune, signées « + » pour un argument en faveur, « - » pour une réserve, « i » pour une information utile à la décision (doublon, garde, nombre de bouteilles du même style déjà en cave, prix). Cite des faits précis : ses notes, ses vins, son profil.

Règles :
- Avec un profil provisoire ou peu de dégustations, dis-le dans une raison « i » et reste prudent : affinity proche de 5.
- La calibration compare tes verdicts passés à ses notes réelles après achat : corrige tes biais en conséquence.
- Si l'image n'est pas une étiquette de vin lisible, wine.notReadable vaut true, level vaut mitige, affinity 5 et reasons est vide.

Identification du vin.
${LABEL_FIELD_RULES}`;

export function cellarOverview(entries: readonly CellarEntry[]): string {
  const inStock = entries.filter((e) => e.bottles > 0);
  const total = inStock.reduce((sum, e) => sum + e.bottles, 0);
  if (!total) {
    return 'Cave : aucune bouteille en stock.';
  }
  const byColor = WINE_COLORS.map((color) => [color, inStock.filter((e) => e.wine.color === color).reduce((s, e) => s + e.bottles, 0)] as const)
    .filter(([, count]) => count > 0)
    .map(([color, count]) => `${count} ${COLOR_PLURALS[color]}`);
  return `Cave : ${total} bouteilles en stock (${byColor.join(', ')}).`;
}

/** Vins déjà dégustés, en stock ou non, avec leurs notes. */
export function tastedText(wines: readonly Wine[], tastings: readonly Tasting[]): string {
  const lines = wines.flatMap((wine) => {
    const own = tastings.filter((t) => t.wineId === wine.id);
    if (!own.length) {
      return [];
    }
    const origin = [wine.region, wine.grapes.join(', ')].filter(Boolean).join(', ');
    const scores = own.map((t) => `${t.score}/5`).join(', ');
    const rebuy = own.some((t) => t.rebuy) ? ', à racheter' : '';
    return [`- ${[wine.name, wine.vintage].filter(Boolean).join(' ')}${wine.producer ? `, ${wine.producer}` : ''}${origin ? ` (${origin})` : ''} : ${scores}${rebuy}`];
  });
  return lines.length ? `Vins dégustés :\n${lines.join('\n')}` : 'Vins dégustés : aucun.';
}

/** Verdicts passés dont le vin a été acheté puis noté : prédiction contre réalité. */
export function calibrationText(verdicts: readonly Verdict[], tastings: readonly Tasting[]): string {
  const lines = [...verdicts]
    .sort((a, b) => b.date.localeCompare(a.date))
    .flatMap((verdict) => {
      const scores = verdict.boughtWineId ? tastings.filter((t) => t.wineId === verdict.boughtWineId).map((t) => `${t.score}/5`) : [];
      if (!scores.length) {
        return [];
      }
      const wine = verdict.wineIdentified;
      const label = `${[wine.name, wine.vintage].filter(Boolean).join(' ')}${wine.producer ? ` (${wine.producer})` : ''}`;
      return [`- ${label} : prédit ${verdict.affinity}/10 (${verdict.level}), noté ${scores.join(', ')} après achat`];
    })
    .slice(0, CALIBRATION_SIZE);
  return lines.length ? `Calibration :\n${lines.join('\n')}` : 'Calibration : aucun verdict suivi d’une dégustation.';
}

export function storeVerdictContent(
  source: LabelSource,
  profile: TasteProfile | null,
  entries: readonly CellarEntry[],
  wines: readonly Wine[],
  tastings: readonly Tasting[],
  verdicts: readonly Verdict[],
): BetaContentBlockParam[] {
  const context = [profileText(profile), cellarOverview(entries), tastedText(wines, tastings), calibrationText(verdicts, tastings), inventoryText(wines)].join('\n\n');
  const content: BetaContentBlockParam[] = [{ type: 'text', text: context }];
  if (source.kind === 'photo') {
    content.push({ type: 'image', source: { type: 'base64', media_type: 'image/jpeg', data: source.base64 } });
    content.push({ type: 'text', text: 'Voici le vin en magasin. Ton verdict ?' });
  } else {
    content.push({ type: 'text', text: `Vin vu en magasin : « ${source.description.trim()} ». Ton verdict ?` });
  }
  return content;
}

export function parseStoreVerdict(raw: unknown, knownWineIds: ReadonlySet<string>, currentYear: number): StoreVerdictParsed {
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) {
    throw new InvalidResponseError('objet attendu');
  }
  const record = raw as Record<string, unknown>;
  const wine = parseLabelReading(record['wine'], knownWineIds, currentYear);
  const level = record['level'];
  if (typeof level !== 'string' || !(VERDICT_LEVELS as readonly string[]).includes(level)) {
    throw new InvalidResponseError('niveau inconnu');
  }
  const affinity = typeof record['affinity'] === 'number' && Number.isFinite(record['affinity']) ? Math.min(10, Math.max(0, Math.round(record['affinity']))) : 5;
  const reasons = (Array.isArray(record['reasons']) ? record['reasons'] : [])
    .flatMap((item: unknown): VerdictReason[] => {
      if (typeof item !== 'object' || item === null) {
        return [];
      }
      const { sign, text } = item as Record<string, unknown>;
      const trimmed = typeof text === 'string' ? text.trim() : '';
      return typeof sign === 'string' && (REASON_SIGNS as readonly string[]).includes(sign) && trimmed ? [{ sign: sign as VerdictReason['sign'], text: trimmed }] : [];
    })
    .slice(0, MAX_REASONS);
  if (!wine.notReadable && !reasons.length) {
    throw new InvalidResponseError('raisons manquantes');
  }
  return { wine, level: level as VerdictLevel, affinity, reasons };
}

export function storeVerdictRequest(
  source: LabelSource,
  profile: TasteProfile | null,
  entries: readonly CellarEntry[],
  wines: readonly Wine[],
  tastings: readonly Tasting[],
  verdicts: readonly Verdict[],
  currentYear: number,
): StructuredRequest<StoreVerdictParsed> {
  const knownIds = new Set(wines.map((w) => w.id));
  return {
    system: STORE_VERDICT_SYSTEM,
    content: storeVerdictContent(source, profile, entries, wines, tastings, verdicts),
    schema: STORE_VERDICT_SCHEMA,
    effort: 'medium',
    parse: (raw) => parseStoreVerdict(raw, knownIds, currentYear),
  };
}
