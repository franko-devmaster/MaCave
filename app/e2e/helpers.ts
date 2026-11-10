import { expect, Page } from '@playwright/test';

export interface NewWine {
  name: string;
  producer?: string;
  vintage?: string;
  color?: 'Rouge' | 'Blanc' | 'Rosé' | 'Bulles';
  quantity?: number;
  price?: string;
  country?: string;
  region?: string;
  grapes?: string;
  drinkUntil?: string;
}

/** Remplit et enregistre le formulaire d'ajout ; la page Ajouter doit être ouverte. */
export async function addWine(page: Page, wine: NewWine): Promise<void> {
  await page.getByLabel('Nom du vin').fill(wine.name);
  if (wine.producer) await page.getByLabel('Domaine · producteur').fill(wine.producer);
  if (wine.vintage) await page.getByLabel('Millésime').fill(wine.vintage);
  if (wine.color) await page.getByText(wine.color, { exact: true }).tap();
  if (wine.quantity) await page.getByLabel('Quantité').fill(String(wine.quantity));
  if (wine.price) await page.getByLabel('Prix par bouteille (CHF)').fill(wine.price);
  if (wine.country || wine.region || wine.grapes || wine.drinkUntil) {
    const details = page.locator('details');
    if (!(await details.evaluate((el) => (el as HTMLDetailsElement).open))) {
      await page.getByText('Plus de détails').tap();
    }
    if (wine.country) await page.getByLabel('Pays').fill(wine.country);
    if (wine.region) await page.getByLabel('Région').fill(wine.region);
    if (wine.grapes) await page.getByLabel('Cépages').fill(wine.grapes);
    if (wine.drinkUntil) await page.getByLabel("À boire jusqu'en").fill(wine.drinkUntil);
  }
  await page.getByRole('button', { name: 'Ajouter à ma cave' }).tap();
  // Attendre la confirmation de CE vin : celle du vin précédent peut encore être affichée.
  const label = [wine.name, wine.vintage].filter(Boolean).join(' ');
  await expect(page.getByRole('status')).toContainText(`${label} ajouté à la cave`);
}

/** Charge un jeu de données par l'import des Réglages (mode remplacement). */
export async function importBackup(page: Page, data: Record<string, unknown[]>): Promise<void> {
  await page.goto('reglages');
  const backup = { app: 'ma-cave', schemaVersion: 1, exportedAt: new Date().toISOString(), data };
  await page.getByLabel('Importer une sauvegarde').setInputFiles({
    name: 'jeu.json',
    mimeType: 'application/json',
    buffer: Buffer.from(JSON.stringify(backup)),
  });
  await page.getByRole('button', { name: 'Remplacer toutes mes données' }).tap();
  await expect(page.getByRole('status')).toContainText('Import terminé');
}

export function sampleWine(id: string, name: string, grapes: string[]): Record<string, unknown> {
  const now = new Date().toISOString();
  return {
    id, name, producer: 'Germanier', vintage: 2019, color: 'rouge', country: 'Suisse', region: 'Valais',
    appellation: '', grapes, alcohol: null, sweetness: null, drinkFrom: null, drinkUntil: null,
    labelPhotoId: null, location: '', notes: '', createdAt: now, updatedAt: now,
  };
}

export function sampleTasting(id: string, wineId: string, score: number): Record<string, unknown> {
  return {
    id, wineId, score, likedDescriptors: ['fruite'], dislikedDescriptors: [], comment: 'Très bon.',
    context: 'raclette', rebuy: score >= 4, date: new Date().toISOString(),
  };
}
