import { expect, Page, test } from '@playwright/test';
import { apiError, message, mockClaude, MODEL_OK } from './claude-mock';
import { importBackup, sampleTasting, sampleWine } from './helpers';

const SYNTHESIS = {
  summary: 'Des rouges de montagne au fruit mûr et aux tanins fins. Le bois, le moins possible.',
  axes: { fruit: 9, freshness: 7, spice: 6, power: 5, oak: 2 },
  favoriteGrapes: ['Cornalin', 'Merlot'],
  avoidPatterns: ['Chardonnay boisé', 'Rouges confiturés'],
};

const DATA = {
  wines: [sampleWine('w1', 'Cornalin', ['Cornalin']), sampleWine('w2', 'Humagne Rouge', ['Humagne Rouge'])],
  tastings: [sampleTasting('t1', 'w1', 5), sampleTasting('t2', 'w2', 4)],
  settings: [{ key: 'anthropicApiKey', value: 'ignorée' }],
};

async function saveKey(page: Page): Promise<void> {
  await page.goto('reglages');
  await page.getByLabel('Clé API Claude').fill('sk-ant-api03-test-0123456789abcdef');
  await page.getByRole('button', { name: 'Enregistrer et tester' }).tap();
  await expect(page.getByTestId('api-key')).toBeVisible();
}

test.describe('Itération 4 — profil de goûts', () => {
  test.use({ serviceWorkers: 'block' });

  test('sans dégustation, invite à noter et n’appelle pas Claude', async ({ page }) => {
    const mock = await mockClaude(page, { models: () => MODEL_OK, messages: () => message(SYNTHESIS) });
    await saveKey(page);
    await page.goto('gouts');

    await expect(page.getByText('Pas encore de profil.')).toBeVisible();
    expect(mock.messageBodies).toHaveLength(0);
  });

  test('calcule le profil une fois, puis seulement après un changement', async ({ page }) => {
    const mock = await mockClaude(page, { models: () => MODEL_OK, messages: () => message(SYNTHESIS) });
    await importBackup(page, DATA);
    await saveKey(page);
    await page.getByRole('link', { name: 'Cave' }).tap();
    await page.getByRole('link', { name: 'Goûts' }).tap();

    await expect(page.getByTestId('profile-summary')).toHaveText(SYNTHESIS.summary);
    await expect(page.getByText('Profil provisoire, basé sur 2 dégustations. Il se précise à partir de 5.')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Fruit 9/10, toucher pour corriger' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Retirer Cornalin des cépages favoris' })).toBeVisible();
    await expect(page.getByText('Chardonnay boisé')).toBeVisible();
    const body = mock.messageBodies[0];
    expect(body['output_config']).toMatchObject({ effort: 'medium', format: { type: 'json_schema' } });
    expect(JSON.stringify(body['messages'])).toContain('Dégustations (2)');

    await page.getByRole('link', { name: 'Cave' }).tap();
    await page.getByRole('link', { name: 'Goûts' }).tap();
    await expect(page.getByTestId('profile-summary')).toBeVisible();
    expect(mock.messageBodies).toHaveLength(1);
  });

  test('applique les corrections tout de suite et les transmet à Claude', async ({ page }) => {
    const mock = await mockClaude(page, { models: () => MODEL_OK, messages: () => message(SYNTHESIS) });
    await importBackup(page, DATA);
    await saveKey(page);
    await page.goto('gouts');
    await expect(page.getByTestId('profile-summary')).toBeVisible();

    await page.getByRole('button', { name: 'Fraîcheur 7/10, toucher pour corriger' }).tap();
    await page.getByLabel(/Fraîcheur · \d+\/10/).fill('9');
    await page.getByRole('button', { name: 'Corriger', exact: true }).tap();
    await expect(page.getByRole('button', { name: 'Fraîcheur 9/10, toucher pour corriger' })).toBeVisible();

    await page.getByRole('button', { name: 'Retirer Merlot des cépages favoris' }).tap();
    await expect(page.getByRole('button', { name: 'Retirer Merlot des cépages favoris' })).toHaveCount(0);

    await page.getByRole('textbox', { name: 'Ajouter une précision' }).fill("J'aime les rouges légers en été");
    await page.getByRole('button', { name: 'Ajouter', exact: true }).tap();

    const corrections = page.getByRole('region', { name: 'Vos corrections' });
    await expect(corrections).toContainText('Fraîcheur : 9/10');
    await expect(corrections).toContainText('Pas un favori : Merlot');
    await expect(corrections).toContainText("« J'aime les rouges légers en été »");

    await expect.poll(() => JSON.stringify(mock.messageBodies.at(-1)?.['messages'] ?? '')).toContain('rouges légers en été');
    const last = JSON.stringify(mock.messageBodies.at(-1)?.['messages']);
    expect(last).toContain('Axe fraîcheur : 9/10');
    expect(last).toContain('Ne pas citer comme cépage favori : Merlot');

    await corrections.getByRole('button', { name: 'Retirer' }).last().tap();
    await expect(page.getByRole('button', { name: 'Fraîcheur 7/10, toucher pour corriger' })).toBeVisible();
  });

  test('affiche l’erreur et permet de réessayer', async ({ page }) => {
    let fail = true;
    await mockClaude(page, { models: () => MODEL_OK, messages: () => (fail ? apiError(529, 'overloaded_error', 'Overloaded') : message(SYNTHESIS)) });
    await importBackup(page, DATA);
    await saveKey(page);
    await page.goto('gouts');

    await expect(page.getByRole('alert')).toContainText('Claude est momentanément indisponible.');
    fail = false;
    await page.getByRole('button', { name: 'Réessayer' }).tap();
    await expect(page.getByTestId('profile-summary')).toHaveText(SYNTHESIS.summary);
  });

  test('sans clé, explique comment activer le profil', async ({ page }) => {
    await importBackup(page, DATA);
    await page.goto('gouts');

    await expect(page.getByText('Pour calculer votre profil avec Claude, ajoutez votre clé API.')).toBeVisible();
  });
});
