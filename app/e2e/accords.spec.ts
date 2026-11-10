import { expect, Page, test } from '@playwright/test';
import { LABEL_PNG, message, mockClaude, MODEL_OK } from './claude-mock';
import { importBackup, sampleTasting, sampleWine } from './helpers';

function stock(id: string, wineId: string, delta: number): Record<string, unknown> {
  return { id, wineId, delta, reason: 'achat', pricePaid: null, date: new Date().toISOString() };
}

const DATA = {
  wines: [
    sampleWine('w1', 'Pinot Noir Réserve', ['Pinot Noir']),
    sampleWine('w2', 'Barolo Bussia', ['Nebbiolo']),
    sampleWine('w3', 'Cornalin', ['Cornalin']),
  ],
  stockMovements: [stock('m1', 'w1', 4), stock('m2', 'w2', 1), stock('m3', 'w3', 3)],
  tastings: [sampleTasting('t1', 'w1', 4)],
};

function pairing(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    notADish: false,
    dish: 'Risotto aux bolets et parmesan',
    topPick: { wineId: 'w1', reason: 'Le sous-bois du pinot répond aux bolets. Vous l’avez noté 4/5.', service: '15 °C, ouvrir 30 min avant' },
    alternatives: [{ wineId: 'w2', reason: 'Plus puissant, parfait avec de la truffe.' }],
    rejected: [{ wineId: 'w3', reason: 'trop épicé pour les bolets.' }],
    buyAdvice: null,
    ...overrides,
  };
}

async function saveKey(page: Page): Promise<void> {
  await page.goto('reglages');
  await page.getByLabel('Clé API Claude').fill('sk-ant-api03-test-0123456789abcdef');
  await page.getByRole('button', { name: 'Enregistrer et tester' }).tap();
  await expect(page.getByTestId('api-key')).toBeVisible();
}

test.describe('Itération 5 — accords', () => {
  test.use({ serviceWorkers: 'block' });

  test('propose un vin de la cave, des alternatives et les vins écartés', async ({ page }) => {
    const mock = await mockClaude(page, { models: () => MODEL_OK, messages: () => message(pairing()) });
    await importBackup(page, DATA);
    await saveKey(page);
    await page.getByRole('link', { name: 'Cave' }).tap();
    await page.getByRole('link', { name: 'Accords' }).tap();

    await page.getByLabel('Le plat', { exact: true }).fill('Risotto aux bolets');
    await page.getByRole('button', { name: 'Trouver le vin' }).tap();

    const pick = page.getByTestId('top-pick');
    await expect(pick).toContainText('Pinot Noir Réserve 2019');
    await expect(pick).toContainText('Le sous-bois du pinot répond aux bolets.');
    await expect(pick).toContainText('15 °C, ouvrir 30 min avant');
    await expect(pick).toContainText('4 btl');
    await expect(page.getByText('Pour : Risotto aux bolets et parmesan')).toBeVisible();
    await expect(page.getByRole('link', { name: /Barolo Bussia.*truffe/ })).toBeVisible();
    await expect(page.getByText(/Écarté : Cornalin 2019, trop épicé pour les bolets\./)).toBeVisible();

    const body = mock.messageBodies[0];
    expect(body['output_config']).toMatchObject({ effort: 'medium' });
    const sent = JSON.stringify(body['messages']);
    expect(sent).toContain('Plat : « Risotto aux bolets »');
    expect(sent).toContain('id=w1 | Pinot Noir Réserve 2019');
    expect(sent).toContain('ses notes : 4/5');
  });

  test('du choix à la fiche puis à la note, le plat suit', async ({ page }) => {
    await mockClaude(page, { models: () => MODEL_OK, messages: () => message(pairing()) });
    await importBackup(page, DATA);
    await saveKey(page);
    await page.goto('accords');
    await page.getByLabel('Le plat', { exact: true }).fill('Risotto aux bolets');
    await page.getByRole('button', { name: 'Trouver le vin' }).tap();

    await page.getByTestId('top-pick').tap();
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Pinot Noir Réserve');
    await page.getByRole('button', { name: "J'en ouvre une" }).tap();
    await expect(page.getByLabel('Avec quoi, avec qui')).toHaveValue('Risotto aux bolets et parmesan');
    await page.locator('label', { has: page.getByRole('radio', { name: '5 / 5' }) }).tap();
    await page.getByRole('button', { name: 'Enregistrer' }).tap();

    await expect(page.getByTestId('bottles')).toHaveText('3');
    await expect(page.getByRole('link', { name: /5\/5/ })).toContainText(/risotto aux bolets et parmesan/i);
  });

  test('dit quand rien ne convient et quoi acheter', async ({ page }) => {
    await mockClaude(page, {
      models: () => MODEL_OK,
      messages: () => message(pairing({ topPick: null, alternatives: [], rejected: [], buyAdvice: 'Un blanc sec et salin, comme un Chablis ou une Petite Arvine.' })),
    });
    await importBackup(page, DATA);
    await saveKey(page);
    await page.goto('accords');
    await page.getByLabel('Le plat', { exact: true }).fill('Huîtres');
    await page.getByRole('button', { name: 'Trouver le vin' }).tap();

    await expect(page.getByText("Rien d'idéal dans votre cave")).toBeVisible();
    await expect(page.getByText('Un blanc sec et salin, comme un Chablis ou une Petite Arvine.')).toBeVisible();
    await expect(page.getByTestId('top-pick')).toHaveCount(0);
  });

  test('accepte une photo du plat et signale une photo hors sujet', async ({ page }) => {
    let reply = pairing();
    const mock = await mockClaude(page, { models: () => MODEL_OK, messages: () => message(reply) });
    await importBackup(page, DATA);
    await saveKey(page);
    await page.goto('accords');

    await page.getByLabel('Photographier le plat ou la recette').setInputFiles({ name: 'plat.png', mimeType: 'image/png', buffer: LABEL_PNG });
    await expect(page.getByTestId('top-pick')).toBeVisible();
    const content = (mock.messageBodies[0]['messages'] as { content: { type: string }[] }[])[0].content;
    expect(content.map((b) => b.type)).toEqual(['text', 'image', 'text']);

    reply = { notADish: true, dish: '', topPick: null, alternatives: [], rejected: [], buyAdvice: null };
    await page.getByRole('button', { name: 'Nouveau plat' }).tap();
    await page.getByLabel('Photographier le plat ou la recette').setInputFiles({ name: 'chat.png', mimeType: 'image/png', buffer: LABEL_PNG });
    await expect(page.getByRole('alert')).toHaveText('La photo ne montre ni un plat ni une recette. Décrivez le plat en quelques mots.');
  });

  test('réaffiche un accord précédent sans rappeler Claude', async ({ page }) => {
    let dish = 'Fondue moitié-moitié';
    const mock = await mockClaude(page, { models: () => MODEL_OK, messages: () => message(pairing({ dish })) });
    await importBackup(page, DATA);
    await saveKey(page);
    await page.goto('accords');
    await page.getByLabel('Le plat', { exact: true }).fill('Fondue');
    await page.getByRole('button', { name: 'Trouver le vin' }).tap();
    await expect(page.getByTestId('top-pick')).toBeVisible();
    dish = 'Filets de perche';
    await page.getByRole('button', { name: 'Nouveau plat' }).tap();
    await page.getByLabel('Le plat', { exact: true }).fill('Perche');
    await page.getByRole('button', { name: 'Trouver le vin' }).tap();
    await expect(page.getByText('Pour : Filets de perche')).toBeVisible();

    await page.getByRole('region', { name: 'Accords précédents' }).getByRole('button', { name: /Fondue moitié-moitié/ }).tap();

    await expect(page.getByText('Pour : Fondue moitié-moitié')).toBeVisible();
    expect(mock.messageBodies).toHaveLength(2);
  });

  test('sans clé, explique comment activer les accords', async ({ page }) => {
    await page.goto('accords');

    await expect(page.getByText('Pour trouver le bon vin avec Claude, ajoutez votre clé API.')).toBeVisible();
  });
});
