import { expect, test } from '@playwright/test';
import { message, mockClaude, MODEL_OK } from './claude-mock';
import { importBackup, sampleTasting, sampleWine } from './helpers';

const YEAR = new Date().getFullYear();

function stock(id: string, wineId: string, delta: number): Record<string, unknown> {
  return { id, wineId, delta, reason: 'achat', pricePaid: null, date: new Date().toISOString() };
}

const DATA = {
  wines: [
    { ...sampleWine('w1', 'Cornalin', ['Cornalin']), drinkFrom: YEAR - 6, drinkUntil: YEAR },
    { ...sampleWine('w2', 'Pinot Noir Réserve', ['Pinot Noir']), drinkFrom: YEAR - 2, drinkUntil: YEAR + 5 },
    {
      ...sampleWine('w3', 'Dézaley', ['Chasselas']),
      color: 'blanc',
      appellation: 'Dézaley Grand Cru',
      advice: { status: 'pret', text: 'Servez-le à 10 °C.', generatedAt: new Date().toISOString(), affinity: 5, grandCru: true },
    },
    { ...sampleWine('w4', 'Humagne Rouge Grand Cru', ['Humagne Rouge']), drinkFrom: YEAR + 3, drinkUntil: YEAR + 10 },
  ],
  stockMovements: [stock('m1', 'w1', 2), stock('m2', 'w2', 3), stock('m3', 'w3', 6), stock('m4', 'w4', 1)],
  tastings: [sampleTasting('t1', 'w2', 5)],
};

test.describe('Indicateurs et filtres de la cave', () => {
  test.beforeEach(async ({ page }) => {
    await importBackup(page, DATA);
    await page.getByRole('link', { name: 'Cave' }).tap();
  });

  test('signale à boire rapidement ou prêt sous le nombre, vos goûts et les grands crus à côté', async ({ page }) => {
    const row = (name: RegExp) => page.getByRole('link', { name });
    await expect(row(/Cornalin/).getByRole('img', { name: 'À boire rapidement' })).toBeVisible();
    await expect(row(/Cornalin/).getByRole('img', { name: 'Prêt à boire' })).toHaveCount(0);

    await expect(row(/Pinot Noir/).getByRole('img', { name: 'Prêt à boire' })).toBeVisible();
    await expect(row(/Pinot Noir/).getByRole('img', { name: 'Selon vos goûts' })).toBeVisible();

    await expect(row(/Dézaley/).getByRole('img', { name: 'Grand cru' })).toBeVisible();
    await expect(row(/Humagne/).getByRole('img')).toHaveCount(0);
  });

  test('la mention « Grand Cru » dans le nom ne suffit pas : seule l’évaluation de Claude compte', async ({ page }) => {
    await expect(page.getByRole('link', { name: /Humagne/ }).getByRole('img', { name: 'Grand cru' })).toHaveCount(0);
  });

  test('combine les filtres : ou dans un groupe, et entre groupes', async ({ page }) => {
    const row = (name: RegExp) => page.getByRole('link', { name });
    const tap = (name: string) => page.getByRole('button', { name, exact: true }).tap();

    await tap('À boire vite');
    await tap('Prêt à boire');
    await expect(row(/Cornalin/)).toBeVisible();
    await expect(row(/Pinot Noir/)).toBeVisible();
    await expect(row(/Humagne/)).toHaveCount(0);

    await tap('Mes goûts');
    await expect(row(/Pinot Noir/)).toBeVisible();
    await expect(row(/Cornalin/)).toHaveCount(0);

    await tap('Tous');
    await tap('Blancs');
    await tap('Grands crus');
    await expect(row(/Dézaley/)).toBeVisible();
    await expect(page.getByRole('link', { name: /Cornalin|Pinot|Humagne/ })).toHaveCount(0);

    await tap('Tous');
    await expect(row(/Humagne/)).toBeVisible();
    await expect(page.getByRole('button', { name: 'Blancs' })).toHaveAttribute('aria-pressed', 'false');
  });

  test.describe('avec Claude', () => {
    test.use({ serviceWorkers: 'block' });

    test('le conseil de la fiche donne l’étoile et la couronne à un vin pas encore dégusté', async ({ page }) => {
      await mockClaude(page, {
        models: () => MODEL_OK,
        messages: () => message({ status: 'trop-jeune', text: 'Attendez encore.', infoSummary: null, affinity: 9, grandCru: true }),
      });
      await page.goto('reglages');
      await page.getByLabel('Clé API Claude').fill('sk-ant-api03-test-0123456789abcdef');
      await page.getByRole('button', { name: 'Enregistrer et tester' }).tap();
      await expect(page.getByTestId('api-key')).toBeVisible();
      await page.getByRole('link', { name: 'Cave' }).tap();
      const humagne = page.getByRole('link', { name: /Humagne/ });
      await expect(humagne.getByRole('img')).toHaveCount(0);

      await humagne.tap();
      await expect(page.getByTestId('wine-advice')).toContainText('Attendez encore.');
      await page.getByRole('link', { name: 'Cave' }).tap();

      await expect(humagne.getByRole('img', { name: 'Selon vos goûts' })).toBeVisible();
      await expect(humagne.getByRole('img', { name: 'Grand cru' })).toBeVisible();
    });
  });
});
