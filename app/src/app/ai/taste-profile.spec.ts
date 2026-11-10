import { ProfileOverride } from '../models/tasting';
import { tastingInput, wine } from '../testing/fixtures';
import { InvalidResponseError } from './claude-errors';
import { overridesText, parseProfileSynthesis, TASTE_PROFILE_SCHEMA, tasteProfileRequest, tastingsText } from './taste-profile';

function answer(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    summary: ' Des rouges de montagne au fruit mûr. ',
    axes: { fruit: 9, freshness: 8, spice: 7, power: 5, oak: 2 },
    favoriteGrapes: ['Cornalin', 'Pinot Noir'],
    avoidPatterns: ['Chardonnay boisé'],
    ...overrides,
  };
}

describe('taste-profile', () => {
  it('schema should be strict at every level', () => {
    const axes = (TASTE_PROFILE_SCHEMA['properties'] as Record<string, Record<string, unknown>>)['axes'];

    expect(TASTE_PROFILE_SCHEMA['additionalProperties']).toBe(false);
    expect(axes['additionalProperties']).toBe(false);
    expect(axes['required']).toEqual(['fruit', 'freshness', 'spice', 'power', 'oak']);
  });

  it('tastingsText should describe each tasting with its wine, oldest first', () => {
    const tastings = [
      { ...tastingInput('w1', { dislikedDescriptors: ['finale-courte', 'cassis amer'] }), id: 't2', date: '2026-10-12T20:00:00Z' },
      { ...tastingInput('w1', { score: 5, rebuy: false, context: '' }), id: 't1', date: '2026-03-03T20:00:00Z' },
    ];

    const text = tastingsText(tastings, [wine('w1')]);

    expect(text).toBe(
      'Dégustations (2) :\n' +
        '- 2026-03-03 | Cornalin 2019, Germanier | rouge | Suisse, Valais | cépages : Cornalin | note 5/5 | aimé : fruité | « Très fruité. »\n' +
        '- 2026-10-12 | Cornalin 2019, Germanier | rouge | Suisse, Valais | cépages : Cornalin | note 4/5 | aimé : fruité | gêné : finale courte, cassis amer | « Très fruité. » | avec : entrecôte | à racheter',
    );
  });

  it('overridesText should phrase each correction', () => {
    const overrides: ProfileOverride[] = [
      { id: '1', field: 'axis:freshness', userValue: '9', reason: '', date: '1' },
      { id: '2', field: 'remove-grape', userValue: 'Merlot', reason: '', date: '2' },
      { id: '3', field: 'remove-avoid', userValue: 'Rouges confiturés', reason: '', date: '3' },
      { id: '4', field: 'note', userValue: "J'aime les rouges légers en été", reason: '', date: '4' },
    ];

    expect(overridesText(overrides)).toBe(
      'Corrections de l’utilisateur (prioritaires) :\n' +
        '- Axe fraîcheur : 9/10\n' +
        '- Ne pas citer comme cépage favori : Merlot\n' +
        '- Ne pas citer comme profil à éviter : Rouges confiturés\n' +
        "- Précision : « J'aime les rouges légers en été »",
    );
    expect(overridesText([])).toBe('Corrections de l’utilisateur : aucune.');
  });

  it('tasteProfileRequest should use medium effort and the strict schema', () => {
    const request = tasteProfileRequest([], [], []);

    expect(request.effort).toBe('medium');
    expect(request.schema).toBe(TASTE_PROFILE_SCHEMA);
    expect(request.content).toHaveLength(2);
  });

  it('parseProfileSynthesis should trim, clamp axes and cap lists', () => {
    const synthesis = parseProfileSynthesis(
      answer({
        axes: { fruit: 12, freshness: -1, spice: 6.6, power: 5, oak: 2 },
        favoriteGrapes: ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'A', ''],
        avoidPatterns: ['x', 'y', 'z', 'w', 'v'],
      }),
    );

    expect(synthesis.summary).toBe('Des rouges de montagne au fruit mûr.');
    expect(synthesis.axes).toEqual({ fruit: 10, freshness: 0, spice: 7, power: 5, oak: 2 });
    expect(synthesis.favoriteGrapes).toEqual(['A', 'B', 'C', 'D', 'E', 'F']);
    expect(synthesis.avoidPatterns).toHaveLength(4);
  });

  it.each([
    [null, 'objet attendu'],
    [answer({ summary: '  ' }), 'synthèse manquante'],
    [answer({ axes: { fruit: 1, freshness: 1, spice: 1, power: 1 } }), 'axe oak manquant'],
  ])('parseProfileSynthesis should reject an invalid answer (%#)', (raw, message) => {
    expect(() => parseProfileSynthesis(raw)).toThrow(new InvalidResponseError(message));
  });
});
