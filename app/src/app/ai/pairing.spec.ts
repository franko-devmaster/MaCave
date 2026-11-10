import { TasteProfile } from '../models/tasting';
import { tastingInput, wine } from '../testing/fixtures';
import { CellarEntry } from '../utils/cellar';
import { InvalidResponseError } from './claude-errors';
import { cellarText, PAIRING_SCHEMA, pairingContent, pairingRequest, parsePairing, profileText } from './pairing';

const PROFILE: TasteProfile = {
  id: 'current',
  summary: 'Des rouges de montagne.',
  axes: { fruit: 9, freshness: 8, spice: 7, power: 5, oak: 2 },
  favoriteGrapes: ['Cornalin'],
  avoidPatterns: ['Chardonnay boisé'],
  basedOnTastings: 6,
  generatedAt: '',
  sourceSignature: '',
};

const ENTRIES: CellarEntry[] = [
  { wine: wine('w1', { drinkFrom: 2024, drinkUntil: 2030 }), bottles: 3, drinkNow: false },
  { wine: wine('w2', { name: 'Barolo Bussia', producer: 'Prunotto', vintage: 2016, region: 'Piémont', country: 'Italie', grapes: ['Nebbiolo'], drinkFrom: 2022, drinkUntil: 2026 }), bottles: 1, drinkNow: true },
  { wine: wine('w3', { name: 'Sociando-Mallet', drinkFrom: 2028, drinkUntil: 2040 }), bottles: 2, drinkNow: false },
  { wine: wine('w4', { name: 'Épuisé' }), bottles: 0, drinkNow: false },
];

function answer(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    notADish: false,
    dish: 'Risotto aux bolets',
    topPick: { wineId: 'w1', reason: 'Le fruit répond aux bolets.', service: '16 °C, ouvrir 30 min avant' },
    alternatives: [{ wineId: 'w2', reason: 'Plus puissant.' }],
    rejected: [{ wineId: 'w3', reason: 'Encore fermé.' }],
    buyAdvice: null,
    ...overrides,
  };
}

describe('pairing', () => {
  it('schema should require every property and forbid others', () => {
    const properties = Object.keys(PAIRING_SCHEMA['properties'] as object);

    expect([...(PAIRING_SCHEMA['required'] as string[])].sort()).toEqual(properties.sort());
    expect(PAIRING_SCHEMA['additionalProperties']).toBe(false);
  });

  it('profileText should summarise the profile, or say it is missing', () => {
    expect(profileText(PROFILE)).toBe(
      'Profil de goûts : « Des rouges de montagne. »\n' +
        'Axes recherchés sur 10 : fruit 9, fraîcheur 8, épices 7, puissance 5, boisé 2.\n' +
        'Cépages qui lui réussissent : Cornalin.\n' +
        'À éviter : Chardonnay boisé.',
    );
    expect(profileText(null)).toBe('Profil de goûts : pas encore établi.');
  });

  it('cellarText should list only wines in stock with keeping status, scores and past dishes', () => {
    const tastings = [
      { ...tastingInput('w1', { score: 5, context: 'raclette' }), id: 't1', date: '1' },
      { ...tastingInput('w1', { score: 4, context: 'raclette' }), id: 't2', date: '2' },
    ];

    const text = cellarText(ENTRIES, tastings, 2026);

    expect(text.split('\n')).toEqual([
      'Cave (3 vins en stock) :',
      '- id=w1 | Cornalin 2019 | Germanier | rouge | Valais, Suisse | cépages : Cornalin | 3 btl | garde 2024–2030 | ses notes : 5/5, 4/5 | déjà bu avec : raclette',
      '- id=w2 | Barolo Bussia 2016 | Prunotto | rouge | Piémont, Italie | cépages : Nebbiolo | 1 btl | à boire maintenant',
      '- id=w3 | Sociando-Mallet 2019 | Germanier | rouge | Valais, Suisse | cépages : Cornalin | 2 btl | trop jeune, à boire dès 2028',
    ]);
    expect(cellarText([], [], 2026)).toBe('Cave : aucune bouteille en stock.');
  });

  it('pairingContent should send the dish as text, or the photo with an optional detail', () => {
    expect(pairingContent({ text: ' Risotto ', photoBase64: null }, null, [], [], 2026).at(-1)).toEqual({ type: 'text', text: 'Plat : « Risotto »' });

    const withPhoto = pairingContent({ text: 'sauce au vin', photoBase64: 'QUJD' }, null, [], [], 2026);
    expect(withPhoto.map((b) => b.type)).toEqual(['text', 'image', 'text']);
    expect(withPhoto[2]).toEqual({ type: 'text', text: 'Le plat est sur la photo. Précision : « sauce au vin »' });
  });

  it('pairingRequest should use medium effort and accept only wines in stock', () => {
    const request = pairingRequest({ text: 'Risotto', photoBase64: null }, PROFILE, ENTRIES, [], 2026);

    expect(request.effort).toBe('medium');
    expect(() => request.parse(answer({ topPick: { wineId: 'w4', reason: 'x', service: '' }, buyAdvice: null }))).toThrow(
      new InvalidResponseError('aucune proposition'),
    );
  });

  it('parsePairing should accept a complete answer', () => {
    const result = parsePairing(answer(), new Set(['w1', 'w2', 'w3']));

    expect(result).toEqual({
      notADish: false,
      dish: 'Risotto aux bolets',
      topPick: { wineId: 'w1', reason: 'Le fruit répond aux bolets.', service: '16 °C, ouvrir 30 min avant' },
      alternatives: [{ wineId: 'w2', reason: 'Plus puissant.' }],
      rejected: [{ wineId: 'w3', reason: 'Encore fermé.' }],
      buyAdvice: null,
    });
  });

  it('parsePairing should drop invented wines, repeats and extras', () => {
    const result = parsePairing(
      answer({
        alternatives: [
          { wineId: 'w1', reason: 'déjà choisi' },
          { wineId: 'invente', reason: 'x' },
          { wineId: 'w2', reason: 'ok' },
          { wineId: 'w3', reason: 'ok' },
          { wineId: 'w5', reason: 'trop' },
        ],
        rejected: [{ wineId: 'w2', reason: 'déjà proposé' }],
      }),
      new Set(['w1', 'w2', 'w3', 'w5']),
    );

    expect(result.alternatives.map((a) => a.wineId)).toEqual(['w2', 'w3']);
    expect(result.rejected).toEqual([]);
  });

  it('parsePairing when nothing fits should keep the buying advice', () => {
    const result = parsePairing(answer({ topPick: null, alternatives: [], rejected: [], buyAdvice: ' Un blanc sec et salin. ' }), new Set(['w1']));

    expect(result.topPick).toBeNull();
    expect(result.buyAdvice).toBe('Un blanc sec et salin.');
  });

  it('parsePairing should flag a photo that is not a dish', () => {
    const result = parsePairing({ notADish: true, dish: '', topPick: null, alternatives: [], rejected: [], buyAdvice: null }, new Set());

    expect(result.notADish).toBe(true);
  });

  it.each([
    [null, 'objet attendu'],
    [answer({ topPick: null, buyAdvice: null }), 'aucune proposition'],
  ])('parsePairing should reject an unusable answer (%#)', (raw, message) => {
    expect(() => parsePairing(raw, new Set(['w1']))).toThrow(new InvalidResponseError(message));
  });
});
