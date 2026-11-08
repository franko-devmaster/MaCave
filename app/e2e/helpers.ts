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
  await expect(page.getByRole('status')).toContainText('ajouté à la cave');
}
