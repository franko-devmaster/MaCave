import { tastingInput, wine } from '../testing/fixtures';
import { InvalidResponseError } from './claude-errors';
import { currentInfoSummary, isAdviceFresh, parseWineAdvice, WINE_ADVICE_SCHEMA, wineAdviceContent, wineAdviceRequest, wineText } from './wine-advice';

const NOW = new Date('2026-11-10T12:00:00Z');

describe('wine-advice', () => {
  it('schema should be strict', () => {
    expect(WINE_ADVICE_SCHEMA['additionalProperties']).toBe(false);
    expect(WINE_ADVICE_SCHEMA['required']).toEqual(['status', 'text', 'infoSummary']);
  });

  it('wineText should describe the wine, stock and own tastings', () => {
    const text = wineText(wine('w1'), 3, [{ ...tastingInput('w1', { score: 5, comment: 'Superbe', context: 'raclette' }), id: 't', date: '2026-03-03T00:00:00Z' }]);

    expect(text).toBe(
      'Vin : Cornalin 2019 | Germanier | rouge | AOC Valais | Valais, Suisse | cépages : Cornalin | 13.5 % vol. | sec | garde 2024–2030 | 3 btl en cave\n' +
        'Ses dégustations de ce vin :\n- 2026-03-03 : 5/5 « Superbe », avec raclette',
    );
    expect(wineText(wine('w1'), 1, [])).toContain('Pas encore dégusté.');
  });

  it('system prompt should forbid repeating the status shown apart', () => {
    expect(wineAdviceRequest(wine('w1'), 1, [], null, NOW).system).toContain('ne le répète pas');
  });

  it('wineAdviceRequest should state the year, use the profile and low effort', () => {
    const request = wineAdviceRequest(wine('w1'), 2, [], null, NOW);

    expect(request.effort).toBe('low');
    expect(JSON.stringify(request.content)).toContain('Nous sommes en 2026.');
    expect(JSON.stringify(request.content)).toContain('Profil de goûts : pas encore établi.');
  });

  it('parseWineAdvice should trim the text and fall back to an unknown status', () => {
    expect(parseWineAdvice({ status: 'apogee', text: ' Ouvrez-le ce soir. ', infoSummary: null })).toEqual({ status: 'apogee', text: 'Ouvrez-le ce soir.', infoSummary: null });
    expect(parseWineAdvice({ status: 'pret', text: 'x', infoSummary: ' Élevé 12 mois en fût. ' }).infoSummary).toBe('Élevé 12 mois en fût.');
    expect(parseWineAdvice({ status: 'parfait', text: 'x' }).status).toBe('inconnu');
    expect(() => parseWineAdvice({ status: 'pret', text: ' ' })).toThrow(new InvalidResponseError('conseil manquant'));
  });

  it('isAdviceFresh should expire after an edit or a new year', () => {
    const advice = { status: 'pret' as const, text: 'x', generatedAt: '2026-11-01T00:00:00Z' };

    expect(isAdviceFresh(wine('w1', { advice, updatedAt: '2026-10-01T00:00:00Z' }), NOW)).toBe(true);
    expect(isAdviceFresh(wine('w1', { advice, updatedAt: '2026-11-05T00:00:00Z' }), NOW)).toBe(false);
    expect(isAdviceFresh(wine('w1', { advice, updatedAt: '2026-10-01T00:00:00Z' }), new Date('2027-01-02T00:00:00Z'))).toBe(false);
    expect(isAdviceFresh(wine('w1'), NOW)).toBe(false);
  });

  it('wineAdviceContent should attach a PDF as a document and a photo as an image', () => {
    const pdf = wineAdviceContent(wine('w1'), 1, [], null, NOW, { mediaType: 'application/pdf', base64: 'JVBE' });
    expect(pdf.map((b) => b.type)).toEqual(['text', 'document', 'text']);
    expect(pdf[1]).toMatchObject({ source: { type: 'base64', media_type: 'application/pdf', data: 'JVBE' } });

    const photo = wineAdviceContent(wine('w1'), 1, [], null, NOW, { mediaType: 'image/jpeg', base64: '/9j/' });
    expect(photo.map((b) => b.type)).toEqual(['text', 'image', 'text']);

    expect(wineAdviceContent(wine('w1'), 1, [], null, NOW, null).map((b) => b.type)).toEqual(['text', 'text']);
  });

  it('isAdviceFresh should expire when the info file changes, but not for older advice without info', () => {
    const advice = { status: 'pret' as const, text: 'x', generatedAt: '2026-11-01T00:00:00Z' };
    const updatedAt = '2026-10-01T00:00:00Z';

    expect(isAdviceFresh(wine('w1', { advice, updatedAt }), NOW)).toBe(true);
    expect(isAdviceFresh(wine('w1', { advice, updatedAt, infoAttachmentId: 'f1' }), NOW)).toBe(false);
    expect(isAdviceFresh(wine('w1', { advice: { ...advice, infoAttachmentId: 'f1' }, updatedAt, infoAttachmentId: 'f1' }), NOW)).toBe(true);
    expect(isAdviceFresh(wine('w1', { advice: { ...advice, infoAttachmentId: 'f1' }, updatedAt, infoAttachmentId: 'f2' }), NOW)).toBe(false);
  });

  it('currentInfoSummary should ignore a summary of a replaced or removed info file', () => {
    const advice = { status: 'pret' as const, text: 'x', generatedAt: '', infoAttachmentId: 'f1', infoSummary: 'Élevé en fût.' };

    expect(currentInfoSummary(wine('w1', { advice, infoAttachmentId: 'f1' }))).toBe('Élevé en fût.');
    expect(currentInfoSummary(wine('w1', { advice, infoAttachmentId: 'f2' }))).toBeNull();
    expect(currentInfoSummary(wine('w1', { advice, infoAttachmentId: null }))).toBeNull();
  });
});
