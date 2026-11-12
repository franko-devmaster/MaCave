import { Verdict } from '../models/advice';
import { tastingInput, wine } from '../testing/fixtures';
import { CellarEntry } from '../utils/cellar';
import { InvalidResponseError } from './claude-errors';
import { LabelReading } from './label-reading';
import {
  calibrationText,
  cellarOverview,
  parseStoreVerdict,
  STORE_VERDICT_SCHEMA,
  storeVerdictContent,
  storeVerdictRequest,
  tastedText,
} from './store-verdict';

const READ_WINE = {
  notReadable: false, name: 'Syrah Cayas', producer: 'Germanier', vintage: 2020, color: 'rouge', country: 'Suisse',
  region: 'Valais', appellation: null, grapes: ['Syrah'], alcohol: 14, sweetness: null, drinkFrom: 2026, drinkUntil: 2034,
  quantity: null, pricePaid: 39, uncertainFields: ['drinkFrom', 'drinkUntil'], possibleDuplicateId: null,
};

function answer(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    wine: READ_WINE,
    level: 'plaira',
    affinity: 8,
    reasons: [
      { sign: '+', text: 'Même domaine que votre Cornalin noté 5/5.' },
      { sign: '-', text: 'Plus puissant que vos habitudes.' },
      { sign: 'i', text: 'Pas de doublon en cave.' },
    ],
    ...overrides,
  };
}

function verdict(overrides: Partial<Verdict>): Verdict {
  return {
    id: 'v1',
    wineIdentified: { ...READ_WINE, color: 'rouge', producer: 'Germanier', appellation: '' } as LabelReading,
    affinity: 8,
    level: 'plaira',
    reasons: [],
    outcome: 'achete',
    boughtWineId: 'w9',
    date: '2026-10-01T00:00:00Z',
    ...overrides,
  };
}

describe('store-verdict', () => {
  it('schema should nest the label schema and stay strict', () => {
    const properties = STORE_VERDICT_SCHEMA['properties'] as Record<string, Record<string, unknown>>;

    expect(STORE_VERDICT_SCHEMA['additionalProperties']).toBe(false);
    expect(properties['wine']['additionalProperties']).toBe(false);
    expect(STORE_VERDICT_SCHEMA['required']).toEqual(['wine', 'level', 'affinity', 'reasons']);
  });

  it('cellarOverview should count bottles in stock by color', () => {
    const entries: CellarEntry[] = [
      { wine: wine('a'), bottles: 14, drinkNow: false, readiness: null },
      { wine: wine('b', { color: 'blanc' }), bottles: 3, drinkNow: false, readiness: null },
      { wine: wine('c', { color: 'blanc' }), bottles: 0, drinkNow: false, readiness: null },
    ];

    expect(cellarOverview(entries)).toBe('Cave : 17 bouteilles en stock (14 rouges, 3 blancs).');
    expect(cellarOverview([])).toBe('Cave : aucune bouteille en stock.');
  });

  it('tastedText should list tasted wines, even out of stock, with scores', () => {
    const tastings = [
      { ...tastingInput('a', { score: 5, rebuy: true }), id: 't1', date: '1' },
      { ...tastingInput('a', { score: 4, rebuy: false }), id: 't2', date: '2' },
    ];

    expect(tastedText([wine('a'), wine('b')], tastings)).toBe('Vins dégustés :\n- Cornalin 2019, Germanier (Valais, Cornalin) : 5/5, 4/5, à racheter');
    expect(tastedText([wine('a')], [])).toBe('Vins dégustés : aucun.');
  });

  it('calibrationText should compare bought verdicts with real scores', () => {
    const tastings = [{ ...tastingInput('w9', { score: 2 }), id: 't1', date: '1' }];

    expect(calibrationText([verdict({}), verdict({ id: 'v2', boughtWineId: null })], tastings)).toBe(
      'Calibration :\n- Syrah Cayas 2020 (Germanier) : prédit 8/10 (plaira), noté 2/5 après achat',
    );
    expect(calibrationText([verdict({})], [])).toBe('Calibration : aucun verdict suivi d’une dégustation.');
  });

  it('storeVerdictContent should put context first, then the photo or the description', () => {
    const photo = storeVerdictContent({ kind: 'photo', base64: 'QUJD' }, null, [], [], [], []);
    expect(photo.map((b) => b.type)).toEqual(['text', 'image', 'text']);
    expect(JSON.stringify(photo[0])).toContain('Profil de goûts : pas encore établi.');

    const text = storeVerdictContent({ kind: 'text', description: ' Syrah Cayas 2020 à 39 francs ' }, null, [], [], [], []);
    expect(text[1]).toEqual({ type: 'text', text: 'Vin vu en magasin : « Syrah Cayas 2020 à 39 francs ». Ton verdict ?' });
  });

  it('storeVerdictRequest should use medium effort', () => {
    expect(storeVerdictRequest({ kind: 'text', description: 'x' }, null, [], [], [], [], 2026).effort).toBe('medium');
  });

  it('parseStoreVerdict should accept a complete answer with the shelf price', () => {
    const result = parseStoreVerdict(answer(), new Set(), 2026);

    expect(result.level).toBe('plaira');
    expect(result.affinity).toBe(8);
    expect(result.wine).toMatchObject({ name: 'Syrah Cayas', pricePaid: 39 });
    expect(result.reasons.map((r) => r.sign)).toEqual(['+', '-', 'i']);
  });

  it('parseStoreVerdict should clamp affinity, drop invalid reasons and cap them', () => {
    const result = parseStoreVerdict(
      answer({
        affinity: 14,
        reasons: [
          { sign: '?', text: 'signe inconnu' },
          { sign: '+', text: '  ' },
          { sign: '+', text: 'a' },
          { sign: '+', text: 'b' },
          { sign: '-', text: 'c' },
          { sign: 'i', text: 'd' },
          { sign: 'i', text: 'e' },
        ],
      }),
      new Set(),
      2026,
    );

    expect(result.affinity).toBe(10);
    expect(result.reasons.map((r) => r.text)).toEqual(['a', 'b', 'c', 'd']);
  });

  it('parseStoreVerdict should accept an unreadable label without reasons', () => {
    const result = parseStoreVerdict(answer({ wine: { ...READ_WINE, notReadable: true, name: '' }, level: 'mitige', affinity: 5, reasons: [] }), new Set(), 2026);

    expect(result.wine.notReadable).toBe(true);
  });

  it.each([
    [null, 'objet attendu'],
    [answer({ level: 'adore' }), 'niveau inconnu'],
    [answer({ reasons: [] }), 'raisons manquantes'],
    [answer({ wine: { ...READ_WINE, color: 'orange' } }), 'couleur inconnue'],
  ])('parseStoreVerdict should reject an unusable answer (%#)', (raw, message) => {
    expect(() => parseStoreVerdict(raw, new Set(), 2026)).toThrow(new InvalidResponseError(message));
  });
});
