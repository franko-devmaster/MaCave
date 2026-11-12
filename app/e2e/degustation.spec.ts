import { expect, Page, test } from '@playwright/test';
import { addWine } from './helpers';

/** Touche le cercle de la note, comme le ferait l'utilisateur. */
async function rate(page: Page, score: number): Promise<void> {
  await page.locator('label', { has: page.getByRole('radio', { name: `${score} / 5` }) }).tap();
}

async function wineWith(page: Page, name: string, quantity: number): Promise<void> {
  await page.goto('ajouter');
  await addWine(page, { name, producer: 'Germanier', vintage: '2019', quantity });
  await page.getByRole('link', { name: 'Voir la fiche' }).tap();
}

test.describe('Itération 3 — dégustations', () => {
  test('ouvre une bouteille, la note et retrouve la note sur la fiche', async ({ page }) => {
    await wineWith(page, 'Cornalin', 3);

    await page.getByRole('button', { name: 'Ouvrir une bouteille' }).tap();
    await expect(page.getByText('Bouteille ouverte · il en reste 2')).toBeVisible();
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Cornalin 2019');

    await page.getByRole('button', { name: 'Enregistrer' }).tap();
    await expect(page.getByRole('alert')).toHaveText('Choisissez une note de 1 à 5.');

    await rate(page, 4);
    await expect(page.getByRole('alert')).toHaveCount(0);
    await page.getByRole('button', { name: 'Fruité' }).tap();
    await page.getByRole('button', { name: 'Épicé' }).tap();
    await page.getByRole('group', { name: "Ce que j'ai aimé" }).getByRole('button', { name: '+ Autre' }).tap();
    await page.getByRole('textbox', { name: 'Autre' }).fill('Cassis');
    await page.getByRole('textbox', { name: 'Autre' }).press('Enter');
    await page.getByRole('button', { name: 'Finale courte' }).tap();
    await expect(page.getByRole('button', { name: 'Cassis' })).toHaveAttribute('aria-pressed', 'true');
    await page.getByLabel('En deux mots').fill('Tanins fins, finale un peu courte.');
    await page.getByLabel('Avec quoi, avec qui').fill('entrecôte');
    await page.getByRole('switch', { name: 'À racheter' }).check();
    await page.getByRole('button', { name: 'Enregistrer' }).tap();

    await expect(page.getByTestId('bottles')).toHaveText('2');
    const tasting = page.getByRole('link', { name: /4\/5/ });
    await expect(tasting).toContainText('Tanins fins, finale un peu courte.');
    await expect(tasting).toContainText('Fruité, Épicé, Cassis, Finale courte');
    await expect(tasting).toContainText(/entrecôte · à racheter/i);
  });

  test('modifie puis supprime une dégustation', async ({ page }) => {
    await wineWith(page, 'Humagne Rouge', 2);
    await page.getByRole('link', { name: 'Noter', exact: true }).tap();
    await expect(page.getByText('Bouteille ouverte')).toHaveCount(0);
    await rate(page, 3);
    await page.getByLabel('En deux mots').fill('Correct');
    await page.getByRole('button', { name: 'Enregistrer' }).tap();
    await expect(page.getByTestId('bottles')).toHaveText('2');

    await page.getByRole('link', { name: /3\/5/ }).tap();
    await expect(page.getByRole('radio', { name: '3 / 5' })).toBeChecked();
    await expect(page.getByLabel('En deux mots')).toHaveValue('Correct');
    await rate(page, 5);
    await page.getByRole('button', { name: 'Enregistrer' }).tap();
    await expect(page.getByRole('link', { name: /5\/5/ })).toBeVisible();
    await expect(page.getByRole('link', { name: /3\/5/ })).toHaveCount(0);

    await page.getByRole('link', { name: /5\/5/ }).tap();
    page.once('dialog', (dialog) => dialog.accept());
    await page.getByRole('button', { name: 'Supprimer cette dégustation' }).tap();
    await expect(page.getByText('Pas encore de dégustation notée.')).toBeVisible();
  });

  test('signale « à racheter » sur un vin épuisé', async ({ page }) => {
    await wineWith(page, 'Petite Arvine', 1);
    await page.getByRole('button', { name: 'Ouvrir une bouteille' }).tap();
    await rate(page, 5);
    await page.getByRole('switch', { name: 'À racheter' }).check();
    await page.getByRole('button', { name: 'Enregistrer' }).tap();
    await page.getByRole('link', { name: 'Cave' }).tap();

    await page.getByRole('button', { name: 'Voir les vins épuisés (1)' }).tap();
    await expect(page.getByRole('link', { name: /Petite Arvine.*à racheter/i })).toBeVisible();
  });
});
