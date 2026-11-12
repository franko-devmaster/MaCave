import { wineInput } from '../testing/fixtures';
import { emptyWineForm, readingToFormValue, toFormValue, toWineFormResult, uncertainFormFields, validateWineForm, WineFormValue } from './wine-form';

function form(overrides: Partial<WineFormValue>): WineFormValue {
  return { ...emptyWineForm(), name: 'Cornalin', ...overrides };
}

describe('wine-form', () => {
  it('validateWineForm when only the name is given should accept the defaults', () => {
    expect(validateWineForm(form({}), 'create', 2026)).toEqual({});
  });

  it('validateWineForm should require a name', () => {
    expect(validateWineForm(form({ name: '  ' }), 'create', 2026).name?.key).toBe('form.errors.nameRequired');
  });

  it.each([
    ['1899', true],
    ['2027', false],
    ['2028', true],
    ['20a9', true],
    ['', false],
  ])('validateWineForm with vintage "%s" should report an error: %s', (vintage, hasError) => {
    expect(validateWineForm(form({ vintage }), 'create', 2026).vintage !== undefined).toBe(hasError);
  });

  it.each([['0'], ['1000'], ['2.5'], ['']])('validateWineForm with quantity "%s" should be rejected in create mode', (quantity) => {
    expect(validateWineForm(form({ quantity }), 'create', 2026).quantity?.key).toBe('form.errors.quantity');
  });

  it('validateWineForm in edit mode should accept an empty cellar', () => {
    expect(validateWineForm(form({ quantity: '0' }), 'edit', 2026)).toEqual({});
  });

  it('validateWineForm in edit mode should still check bottles and price', () => {
    const errors = validateWineForm(form({ quantity: '-1', price: 'abc' }), 'edit', 2026);

    expect(errors.quantity?.key).toBe('form.errors.bottles');
    expect(errors.price?.key).toBe('form.errors.price');
  });

  it('toFormValue with a stock should fill bottles and the price paid', () => {
    const value = toFormValue(wineInput(), { bottles: 0, pricePaid: 31.5 });

    expect(value.quantity).toBe('0');
    expect(value.price).toBe('31.5');
  });

  it('validateWineForm should reject a negative price and accept a decimal comma', () => {
    expect(validateWineForm(form({ price: '-3' }), 'create', 2026).price?.key).toBe('form.errors.price');
    expect(validateWineForm(form({ price: '34,50' }), 'create', 2026).price).toBeUndefined();
  });

  it('validateWineForm should reject a drinking window in the wrong order', () => {
    expect(validateWineForm(form({ drinkFrom: '2030', drinkUntil: '2024' }), 'create', 2026).drinkUntil?.key).toBe('form.errors.yearsOrder');
  });

  it('validateWineForm should reject an alcohol degree out of range', () => {
    expect(validateWineForm(form({ alcohol: '40' }), 'create', 2026).alcohol?.key).toBe('form.errors.alcohol');
  });

  it('toWineFormResult should trim, parse numbers and split grapes', () => {
    const result = toWineFormResult(
      form({
        name: '  Petite Arvine ',
        vintage: '2022',
        color: 'blanc',
        quantity: '6',
        price: '42,50',
        grapes: 'Petite Arvine, ',
        alcohol: '13,5',
        sweetness: 'doux',
      }),
    );

    expect(result.quantity).toBe(6);
    expect(result.pricePaid).toBe(42.5);
    expect(result.input).toMatchObject({
      name: 'Petite Arvine',
      vintage: 2022,
      color: 'blanc',
      grapes: ['Petite Arvine'],
      alcohol: 13.5,
      sweetness: 'doux',
      drinkFrom: null,
    });
  });

  it('toFormValue then toWineFormResult should round-trip a wine', () => {
    const input = wineInput();

    expect(toWineFormResult(toFormValue(input)).input).toEqual(input);
  });
});

describe('readingToFormValue', () => {
  const reading = {
    name: 'Petite Arvine', producer: 'Chappaz', vintage: 2022, color: 'blanc' as const, country: 'Suisse',
    region: 'Valais', appellation: '', grapes: ['Petite Arvine'], alcohol: 13.5, sweetness: null,
    drinkFrom: 2024, drinkUntil: 2032, quantity: null, pricePaid: null,
    uncertainFields: ['drinkFrom' as const, 'price' as const], possibleDuplicateId: null, notReadable: false,
  };

  it('readingToFormValue should fill the form without touching quantity and price when unknown', () => {
    const patch = readingToFormValue(reading);

    expect(patch).toMatchObject({ name: 'Petite Arvine', vintage: '2022', color: 'blanc', grapes: 'Petite Arvine', alcohol: '13.5', sweetness: '' });
    expect('quantity' in patch).toBe(false);
    expect('price' in patch).toBe(false);
  });

  it('readingToFormValue should fill quantity and price found in a description', () => {
    expect(readingToFormValue({ ...reading, quantity: 6, pricePaid: 34.5 })).toMatchObject({ quantity: '6', price: '34.5' });
  });

  it('uncertainFormFields should keep the field names', () => {
    expect(uncertainFormFields(reading)).toEqual(['drinkFrom', 'price']);
  });
});
