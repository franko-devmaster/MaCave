import { expect, test } from '@playwright/test';
import { message, mockClaude, MODEL_OK } from './claude-mock';
import { importBackup, sampleTasting, sampleWine } from './helpers';

function stock(id: string, wineId: string, delta: number): Record<string, unknown> {
  return { id, wineId, delta, reason: 'achat', pricePaid: null, date: new Date().toISOString() };
}

const DATA = {
  wines: [sampleWine('w1', 'Cornalin', ['Cornalin']), sampleWine('w2', 'Humagne Rouge', ['Humagne Rouge'])],
  stockMovements: [stock('m1', 'w1', 1), stock('m2', 'w2', 2)],
  tastings: [sampleTasting('t1', 'w1', 2)],
};

const PROFILE = {
  summary: 'Des rouges de montagne.',
  axes: { fruit: 8, freshness: 7, spice: 6, power: 5, oak: 2 },
  favoriteGrapes: ['Humagne Rouge'],
  avoidPatterns: [],
};

test.describe('Réévaluer ma cave', () => {
  test.use({ serviceWorkers: 'block' });

  test('recalcule l’étoile et la couronne de chaque vin en cave depuis Mes goûts', async ({ page }) => {
    const mock = await mockClaude(page, {
      models: () => MODEL_OK,
      messages: (body) =>
        JSON.stringify(body).includes('bouteille de sa propre cave')
          ? message({ status: 'pret', text: 'Réévalué.', infoSummary: null, affinity: 9, grandCru: true })
          : message(PROFILE),
    });
    await importBackup(page, DATA);
    await page.getByLabel('Clé API Claude').fill('sk-ant-api03-test-0123456789abcdef');
    await page.getByRole('button', { name: 'Enregistrer et tester' }).tap();
    await expect(page.getByTestId('api-key')).toBeVisible();

    await page.getByRole('link', { name: 'Cave' }).tap();
    await expect(page.getByRole('link', { name: /Humagne/ }).getByRole('img', { name: 'Grand cru' })).toHaveCount(0);

    await page.getByRole('navigation', { name: 'Navigation principale' }).getByRole('link', { name: 'Goûts' }).tap();
    await expect(page.getByTestId('profile-summary')).toBeVisible();
    page.once('dialog', (dialog) => {
      expect(dialog.message()).toContain('Réévaluer 2 vins ?');
      void dialog.accept();
    });
    await page.getByRole('button', { name: 'Réévaluer ma cave (2 vins)' }).tap();
    await expect(page.getByText('Cave réévaluée : 2 vins.')).toBeVisible();
    const adviceCalls = mock.messageBodies.filter((body) => JSON.stringify(body).includes('bouteille de sa propre cave'));
    expect(adviceCalls).toHaveLength(2);

    await page.getByRole('navigation', { name: 'Navigation principale' }).getByRole('link', { name: 'Cave' }).tap();
    const humagne = page.getByRole('link', { name: /Humagne/ });
    await expect(humagne.getByRole('img', { name: 'Grand cru' })).toBeVisible();
    await expect(humagne.getByRole('img', { name: 'Selon vos goûts' })).toBeVisible();
    // Cornalin a été noté 2/5 : sa note prime sur l’affinité de Claude.
    await expect(page.getByRole('link', { name: /Cornalin/ }).getByRole('img', { name: 'Selon vos goûts' })).toHaveCount(0);
  });
});
