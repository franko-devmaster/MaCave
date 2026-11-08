import { InvalidResponseError } from './claude-errors';
import { wine } from '../testing/fixtures';
import { inventoryText, LABEL_READING_SCHEMA, labelReadingContent, parseLabelReading } from './label-reading';

function answer(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    notReadable: false,
    name: 'Petite Arvine',
    producer: 'Marie-Thérèse Chappaz',
    vintage: 2022,
    color: 'blanc',
    country: 'Suisse',
    region: 'Valais',
    appellation: 'AOC Valais',
    grapes: ['Petite Arvine'],
    alcohol: 13.5,
    sweetness: 'sec',
    drinkFrom: 2024,
    drinkUntil: 2032,
    quantity: null,
    pricePaid: null,
    uncertainFields: ['drinkFrom', 'drinkUntil'],
    possibleDuplicateId: null,
    ...overrides,
  };
}

describe('label-reading', () => {
  it('schema should require every property and forbid others, as strict outputs demand', () => {
    const properties = Object.keys(LABEL_READING_SCHEMA['properties'] as object);

    expect([...(LABEL_READING_SCHEMA['required'] as string[])].sort()).toEqual(properties.sort());
    expect(LABEL_READING_SCHEMA['additionalProperties']).toBe(false);
  });

  it('inventoryText should list wines with their id', () => {
    expect(inventoryText([wine('w1')])).toContain('id=w1 | Cornalin | Germanier | 2019 | rouge');
    expect(inventoryText([])).toBe('Vins déjà en cave : aucun.');
  });

  it('labelReadingContent for a photo should send inventory, image then instruction', () => {
    const content = labelReadingContent({ kind: 'photo', base64: 'QUJD' }, []);

    expect(content.map((block) => block.type)).toEqual(['text', 'image', 'text']);
    expect(content[1]).toEqual({ type: 'image', source: { type: 'base64', media_type: 'image/jpeg', data: 'QUJD' } });
  });

  it('labelReadingContent for a description should quote the text', () => {
    const content = labelReadingContent({ kind: 'text', description: '  Cornalin Germanier 2019 ' }, []);

    expect(content[1]).toEqual({ type: 'text', text: 'Description du vin : « Cornalin Germanier 2019 »' });
  });

  it('parseLabelReading should accept a complete answer', () => {
    const reading = parseLabelReading(answer(), new Set(), 2026);

    expect(reading).toMatchObject({ name: 'Petite Arvine', vintage: 2022, color: 'blanc', grapes: ['Petite Arvine'], notReadable: false });
    expect(reading.uncertainFields).toEqual(['drinkFrom', 'drinkUntil']);
  });

  it('parseLabelReading should turn nulls into empty strings for text fields', () => {
    const reading = parseLabelReading(answer({ producer: null, region: null, appellation: null }), new Set(), 2026);

    expect(reading.producer).toBe('');
    expect(reading.region).toBe('');
  });

  it('parseLabelReading should drop out-of-range values instead of failing', () => {
    const reading = parseLabelReading(
      answer({ vintage: 2031, alcohol: 45, quantity: 0, pricePaid: -1, drinkFrom: 2024.5 }),
      new Set(),
      2026,
    );

    expect(reading).toMatchObject({ vintage: null, alcohol: null, quantity: null, pricePaid: null, drinkFrom: null });
  });

  it('parseLabelReading should swap an inverted drinking window', () => {
    const reading = parseLabelReading(answer({ drinkFrom: 2032, drinkUntil: 2024 }), new Set(), 2026);

    expect([reading.drinkFrom, reading.drinkUntil]).toEqual([2024, 2032]);
  });

  it('parseLabelReading should keep a duplicate id only if the wine exists', () => {
    expect(parseLabelReading(answer({ possibleDuplicateId: 'w1' }), new Set(['w1']), 2026).possibleDuplicateId).toBe('w1');
    expect(parseLabelReading(answer({ possibleDuplicateId: 'invente' }), new Set(['w1']), 2026).possibleDuplicateId).toBeNull();
  });

  it('parseLabelReading should clean grapes and ignore unknown uncertain fields', () => {
    const reading = parseLabelReading(answer({ grapes: [' Merlot ', '', 'Merlot'], uncertainFields: ['region', 'bidon'] }), new Set(), 2026);

    expect(reading.grapes).toEqual(['Merlot']);
    expect(reading.uncertainFields).toEqual(['region']);
  });

  it('parseLabelReading should accept an unreadable label without a name', () => {
    expect(parseLabelReading(answer({ notReadable: true, name: '' }), new Set(), 2026).notReadable).toBe(true);
  });

  it.each([
    [null, 'objet attendu'],
    [answer({ name: '' }), 'nom manquant'],
    [answer({ color: 'orange' }), 'couleur inconnue'],
  ])('parseLabelReading should reject an invalid answer (%#)', (raw, message) => {
    expect(() => parseLabelReading(raw, new Set(), 2026)).toThrow(new InvalidResponseError(message));
  });
});
