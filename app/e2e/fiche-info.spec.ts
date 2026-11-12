import { expect, Page, test } from '@playwright/test';
import { LABEL_PNG, message, mockClaude, MODEL_OK } from './claude-mock';
import { addWine } from './helpers';

const PDF = Buffer.from(
  '%PDF-1.4\n1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj 2 0 obj<</Type/Pages/Kids[3 0 R]/Count 1>>endobj ' +
    '3 0 obj<</Type/Page/Parent 2 0 R/MediaBox[0 0 200 200]>>endobj\ntrailer<</Root 1 0 R>>\n%%EOF',
);

async function wineWithBottlePhoto(page: Page): Promise<void> {
  await page.goto('ajouter');
  await addWine(page, { name: 'Cornalin', vintage: '2019', quantity: 2 });
  await page.getByRole('link', { name: 'Voir la fiche' }).tap();
  await page.getByLabel('Ajouter une photo').setInputFiles({ name: 'infos.png', mimeType: 'image/png', buffer: LABEL_PNG });
  await expect(page.getByRole('button', { name: 'Photo de la bouteille' })).toBeVisible();
}

/** Ouvre la photo Bouteille en grand et la remplace depuis la visionneuse. */
async function replaceBottlePhoto(page: Page): Promise<void> {
  await page.getByRole('button', { name: 'Photo de la bouteille' }).tap();
  const viewer = page.getByRole('dialog', { name: 'Photo de la bouteille' });
  await expect(viewer).toBeVisible();
  await viewer.getByLabel('Remplacer la photo').setInputFiles({ name: 'face.png', mimeType: 'image/png', buffer: LABEL_PNG });
  await expect(viewer).toBeHidden();
}

test.describe('Fiche info et photo bouteille', () => {
  test('toucher la photo bouteille l’affiche en plein écran', async ({ page }) => {
    await wineWithBottlePhoto(page);

    await page.getByRole('button', { name: 'Photo de la bouteille' }).tap();
    const viewer = page.getByRole('dialog', { name: 'Photo de la bouteille' });
    await expect(viewer).toBeVisible();
    await expect(viewer.getByRole('img', { name: 'Photo de la bouteille' })).toHaveAttribute('src', /^blob:/);
    const box = await viewer.boundingBox();
    expect(box?.width).toBe(page.viewportSize()?.width);

    await viewer.getByRole('button', { name: 'Fermer' }).tap();
    await expect(viewer).toBeHidden();
  });

  test('ajoute un PDF, l’affiche, le remplace par une photo puis le supprime', async ({ page }) => {
    await wineWithBottlePhoto(page);
    const info = page.getByRole('region', { name: 'Fiche info' });

    await info.getByLabel(/Ajouter une fiche info/).setInputFiles({ name: 'qoqa.pdf', mimeType: 'application/pdf', buffer: PDF });
    await expect(page.getByTestId('info-tile')).toContainText('PDF · 1 Ko');

    await page.getByTestId('info-tile').tap();
    const viewer = page.getByRole('dialog', { name: 'Fiche info' });
    await expect(viewer).toBeVisible();
    await expect(viewer.locator('object[type="application/pdf"]')).toHaveAttribute('data', /^blob:/);
    await viewer.getByRole('button', { name: 'Fermer' }).tap();
    await expect(viewer).toBeHidden();

    await info.getByLabel('Remplacer la fiche').setInputFiles({ name: 'fiche.png', mimeType: 'image/png', buffer: LABEL_PNG });
    await expect(page.getByTestId('info-tile')).toContainText(/Photo · \d+ Ko/);

    page.once('dialog', (dialog) => dialog.accept());
    await info.getByRole('button', { name: 'Supprimer la fiche' }).tap();
    await expect(info.getByText(/Ajouter une fiche info/)).toBeVisible();
  });

  test('remplacer la photo bouteille peut garder l’ancienne comme fiche info', async ({ page }) => {
    await wineWithBottlePhoto(page);

    page.once('dialog', (dialog) => {
      expect(dialog.message()).toContain("Garder l'ancienne photo comme fiche info ?");
      void dialog.accept();
    });
    await replaceBottlePhoto(page);

    await expect(page.getByTestId('info-tile')).toContainText(/Photo · \d+ Ko/);
  });

  test('sans garder l’ancienne photo, la fiche info reste vide', async ({ page }) => {
    await wineWithBottlePhoto(page);

    page.once('dialog', (dialog) => void dialog.dismiss());
    await replaceBottlePhoto(page);

    await expect(page.getByRole('region', { name: 'Fiche info' }).getByText(/Ajouter une fiche info/)).toBeVisible();
  });

  test.describe('sans appel à Claude', () => {
    test.use({ serviceWorkers: 'block' });

    test('changer la photo bouteille ne relance pas le conseil, ajouter la fiche info le relance', async ({ page }) => {
      const replies = [
        message({ status: 'pret', text: 'Servez-le à 16 °C.', infoSummary: null }),
        message({ status: 'garde', text: 'Attendez 2027, comme le conseille le producteur.', infoSummary: 'Garde 2027-2035 selon le producteur' }),
      ];
      const mock = await mockClaude(page, { models: () => MODEL_OK, messages: () => replies[Math.min(mock.messageBodies.length, replies.length) - 1] });
      await page.goto('reglages');
      await page.getByLabel('Clé API Claude').fill('sk-ant-api03-test-0123456789abcdef');
      await page.getByRole('button', { name: 'Enregistrer et tester' }).tap();
      await expect(page.getByTestId('api-key')).toBeVisible();
      await wineWithBottlePhoto(page);
      await expect(page.getByTestId('wine-advice')).toContainText('Servez-le à 16 °C.');
      expect(mock.messageBodies).toHaveLength(1);

      page.once('dialog', (dialog) => void dialog.dismiss());
      await replaceBottlePhoto(page);
      await page.getByRole('link', { name: 'Cave' }).tap();
      await page.getByRole('link', { name: /Cornalin/ }).tap();
      await expect(page.getByTestId('wine-advice')).toContainText('Servez-le à 16 °C.');
      expect(mock.messageBodies).toHaveLength(1);

      await page.getByRole('region', { name: 'Fiche info' }).getByLabel(/Ajouter une fiche info/).setInputFiles({ name: 'qoqa.pdf', mimeType: 'application/pdf', buffer: PDF });
      await expect(page.getByTestId('wine-advice')).toContainText('Attendez 2027');
      await expect(page.getByTestId('wine-advice')).toContainText("D'après la fiche info : Garde 2027-2035 selon le producteur");
      expect(mock.messageBodies).toHaveLength(2);
      expect(JSON.stringify(mock.messageBodies[1])).toContain('"type":"document"');
    });
  });
});
