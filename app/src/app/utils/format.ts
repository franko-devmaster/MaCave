/** Prix en francs suisses : « CHF 34.– » pour un montant rond, « CHF 34.50 » sinon. */
export function formatChf(value: number | null): string {
  if (value === null) {
    return '';
  }
  const rounded = Math.round(value * 100) / 100;
  return Number.isInteger(rounded) ? `CHF ${rounded}.–` : `CHF ${rounded.toFixed(2)}`;
}

/** Nombre saisi au clavier : accepte la virgule ou le point, renvoie null si vide ou invalide. */
export function parseNumber(text: string): number | null {
  const cleaned = text.trim().replace(/\s/g, '').replace(',', '.');
  if (!cleaned) {
    return null;
  }
  const value = Number(cleaned);
  return Number.isFinite(value) ? value : null;
}

/** Liste saisie avec des virgules ou des points-virgules, sans doublons ni éléments vides. */
export function parseList(text: string): string[] {
  const items = text.split(/[,;]/).map((item) => item.trim()).filter(Boolean);
  return [...new Set(items)];
}

/** Clé de traduction au singulier ou au pluriel selon le nombre (règle française : 0 et 1 au singulier). */
export function pluralKey(baseKey: string, count: number): string {
  return `${baseKey}.${count <= 1 ? 'one' : 'other'}`;
}

/** Fenêtre de garde lisible : « 2024 – 2030 », « dès 2024 », « jusqu'en 2030 », ou null. */
export function formatDrinkWindow(from: number | null, until: number | null): string | null {
  if (from !== null && until !== null) {
    return from === until ? `${from}` : `${from} – ${until}`;
  }
  if (from !== null) {
    return `dès ${from}`;
  }
  if (until !== null) {
    return `jusqu'en ${until}`;
  }
  return null;
}
