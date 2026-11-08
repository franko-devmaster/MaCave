import { LabelReading } from '../ai/label-reading';
import { Sweetness, WineColor, WineInput } from '../models/wine';
import { parseList, parseNumber } from './format';

export interface WineFormValue {
  name: string;
  producer: string;
  vintage: string;
  color: WineColor;
  quantity: string;
  price: string;
  country: string;
  region: string;
  appellation: string;
  grapes: string;
  drinkFrom: string;
  drinkUntil: string;
  alcohol: string;
  sweetness: Sweetness | '';
  location: string;
  notes: string;
}

export type WineFormField = keyof WineFormValue;

export interface FieldError {
  key: string;
  params?: Record<string, number>;
}

export type WineFormErrors = Partial<Record<WineFormField, FieldError>>;

export interface WineFormResult {
  input: WineInput;
  quantity: number;
  pricePaid: number | null;
}

export function emptyWineForm(): WineFormValue {
  return {
    name: '', producer: '', vintage: '', color: 'rouge', quantity: '1', price: '',
    country: '', region: '', appellation: '', grapes: '', drinkFrom: '', drinkUntil: '',
    alcohol: '', sweetness: '', location: '', notes: '',
  };
}

export function toFormValue(wine: WineInput): WineFormValue {
  return {
    ...emptyWineForm(),
    name: wine.name,
    producer: wine.producer,
    vintage: numberText(wine.vintage),
    color: wine.color,
    country: wine.country,
    region: wine.region,
    appellation: wine.appellation,
    grapes: wine.grapes.join(', '),
    drinkFrom: numberText(wine.drinkFrom),
    drinkUntil: numberText(wine.drinkUntil),
    alcohol: numberText(wine.alcohol),
    sweetness: wine.sweetness ?? '',
    location: wine.location,
    notes: wine.notes,
  };
}

/** Contrôle la saisie. En modification, quantité et prix ne sont pas saisis. */
export function validateWineForm(value: WineFormValue, mode: 'create' | 'edit', currentYear: number): WineFormErrors {
  const errors: WineFormErrors = {};
  if (!value.name.trim()) {
    errors.name = { key: 'form.errors.nameRequired' };
  }
  const vintage = parseNumber(value.vintage);
  if (value.vintage.trim() && !isYear(vintage, 1900, currentYear + 1)) {
    errors.vintage = { key: 'form.errors.vintage', params: { max: currentYear + 1 } };
  }
  if (mode === 'create') {
    const quantity = parseNumber(value.quantity);
    if (quantity === null || !Number.isInteger(quantity) || quantity < 1 || quantity > 999) {
      errors.quantity = { key: 'form.errors.quantity' };
    }
    const price = parseNumber(value.price);
    if (value.price.trim() && (price === null || price < 0 || price > 100_000)) {
      errors.price = { key: 'form.errors.price' };
    }
  }
  const from = parseNumber(value.drinkFrom);
  const until = parseNumber(value.drinkUntil);
  if (value.drinkFrom.trim() && !isYear(from, 1900, 2100)) {
    errors.drinkFrom = { key: 'form.errors.years' };
  }
  if (value.drinkUntil.trim() && !isYear(until, 1900, 2100)) {
    errors.drinkUntil = { key: 'form.errors.years' };
  } else if (from !== null && until !== null && from > until) {
    errors.drinkUntil = { key: 'form.errors.yearsOrder' };
  }
  const alcohol = parseNumber(value.alcohol);
  if (value.alcohol.trim() && (alcohol === null || alcohol < 0 || alcohol > 25)) {
    errors.alcohol = { key: 'form.errors.alcohol' };
  }
  return errors;
}

/** Convertit une saisie valide. À n'appeler qu'après validateWineForm sans erreur. */
export function toWineFormResult(value: WineFormValue): WineFormResult {
  const input: WineInput = {
    name: value.name.trim(),
    producer: value.producer.trim(),
    vintage: parseNumber(value.vintage),
    color: value.color,
    country: value.country.trim(),
    region: value.region.trim(),
    appellation: value.appellation.trim(),
    grapes: parseList(value.grapes),
    alcohol: parseNumber(value.alcohol),
    sweetness: value.sweetness || null,
    drinkFrom: parseNumber(value.drinkFrom),
    drinkUntil: parseNumber(value.drinkUntil),
    location: value.location.trim(),
    notes: value.notes.trim(),
  };
  return { input, quantity: parseNumber(value.quantity) ?? 1, pricePaid: parseNumber(value.price) };
}

function isYear(value: number | null, min: number, max: number): boolean {
  return value !== null && Number.isInteger(value) && value >= min && value <= max;
}

function numberText(value: number | null): string {
  return value === null ? '' : String(value);
}

/** Champs du formulaire préremplis par une lecture d'étiquette ou une description. */
export function readingToFormValue(reading: LabelReading): Partial<WineFormValue> {
  const patch: Partial<WineFormValue> = {
    name: reading.name,
    producer: reading.producer,
    vintage: numberText(reading.vintage),
    color: reading.color,
    country: reading.country,
    region: reading.region,
    appellation: reading.appellation,
    grapes: reading.grapes.join(', '),
    drinkFrom: numberText(reading.drinkFrom),
    drinkUntil: numberText(reading.drinkUntil),
    alcohol: numberText(reading.alcohol),
    sweetness: reading.sweetness ?? '',
  };
  if (reading.quantity !== null) {
    patch.quantity = String(reading.quantity);
  }
  if (reading.pricePaid !== null) {
    patch.price = String(reading.pricePaid);
  }
  return patch;
}

/** Champs signalés comme incertains par Claude, dans le vocabulaire du formulaire. */
export function uncertainFormFields(reading: LabelReading): WineFormField[] {
  return reading.uncertainFields.map((field) => field);
}
