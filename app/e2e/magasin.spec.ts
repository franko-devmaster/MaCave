import { expect, Page, test } from '@playwright/test';
import { LABEL_PNG, message, mockClaude, MODEL_OK, reading } from './claude-mock';
import { importBackup, sampleTasting, sampleWine } from './helpers';

const DATA = {
  wines: [sampleWine('w1', 'Cornalin', ['Cornalin'])],
  stockMovements: [{ id: 'm1', wineId: 'w1', delta: 3, reason: 'achat', pricePaid: null, date: new Date().toISOString() }],
  tastings: [sampleTasting('t1', 'w1', 5)],
};

function verdict(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    wine: reading({ name: 'Syrah Cayas', vintage: 2020, grapes: ['Syrah'], pricePaid: 39 }),
    level: 'plaira',
    affinity: 8,
    reasons: [
      { sign: '+', text: 'Même domaine que votre Cornalin noté 5/5.' },
      { sign: '-', text: 'Plus puissant que vos habitudes.' },
      { sign: 'i', text: 'Pas de doublon dans votre cave.' },
    ],
    ...overrides,
  };
}

async function saveKey(page: Page): Promise<void> {
  await page.goto('reglages');
  await page.getByLabel('Clé API Claude').fill('sk-ant-api03-test-0123456789abcdef');
  await page.getByRole('button', { name: 'Enregistrer et tester' }).tap();
  await expect(page.getByTestId('api-key')).toBeVisible();
}

test.describe('Itération 6 — en magasin', () => {
  test.use({ serviceWorkers: 'block' });

  test('bascule entre « Je l’ai acheté » et « Je suis en magasin » dans l’onglet Ajouter', async ({ page }) => {
    await page.goto('cave');
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Ma cave');
    await page.getByRole('navigation', { name: 'Navigation principale' }).getByRole('link', { name: 'Ajouter' }).tap();
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Ajouter un vin');
    const modes = page.getByRole('navigation', { name: "Type d'ajout" });
    await expect(modes.getByRole('link', { name: "Je l'ai acheté" })).toHaveAttribute('aria-current', 'page');

    await modes.getByRole('link', { name: 'Je suis en magasin' }).tap();
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('En magasin');
    await expect(page.getByText('Pour obtenir un verdict de Claude, ajoutez votre clé API.')).toBeVisible();

    await page.getByRole('navigation', { name: "Type d'ajout" }).getByRole('link', { name: "Je l'ai acheté" }).tap();
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Ajouter un vin');
  });

  test('donne un verdict argumenté, puis « Je passe »', async ({ page }) => {
    const mock = await mockClaude(page, { models: () => MODEL_OK, messages: () => message(verdict()) });
    await importBackup(page, DATA);
    await saveKey(page);
    await page.goto('magasin');

    await page.getByLabel("Photographier l'étiquette").setInputFiles({ name: 'etiquette.png', mimeType: 'image/png', buffer: LABEL_PNG });

    const card = page.getByTestId('verdict');
    await expect(card).toContainText('Devrait vous plaire');
    await expect(card).toContainText('8 / 10');
    await expect(page.getByRole('heading', { name: 'Syrah Cayas 2020' })).toBeVisible();
    await expect(page.getByText(/étiquette CHF 39\.–/)).toBeVisible();
    await expect(page.getByRole('listitem').filter({ hasText: 'Même domaine que votre Cornalin noté 5/5.' }).getByLabel('Point positif')).toBeVisible();
    await expect(page.getByRole('listitem').filter({ hasText: 'Plus puissant' }).getByLabel('Réserve')).toBeVisible();

    const body = mock.messageBodies[0];
    expect(body['output_config']).toMatchObject({ effort: 'medium' });
    const sent = JSON.stringify(body['messages']);
    expect(sent).toContain('Vins dégustés :');
    expect(sent).toContain('Cornalin 2019, Germanier (Valais, Cornalin) : 5/5, à racheter');
    expect(sent).toContain('"type":"image"');

    await page.getByRole('button', { name: 'Je passe' }).tap();
    await expect(page.getByText("Photographier l'étiquette")).toBeVisible();
  });

  test('« J’achète » préremplit l’ajout, puis la note nourrit le verdict suivant', async ({ page }) => {
    const mock = await mockClaude(page, { models: () => MODEL_OK, messages: () => message(verdict()) });
    await importBackup(page, DATA);
    await saveKey(page);
    await page.goto('magasin');
    await page.getByLabel("Photographier l'étiquette").setInputFiles({ name: 'etiquette.png', mimeType: 'image/png', buffer: LABEL_PNG });
    await page.getByRole('button', { name: "Je l'achète" }).tap();

    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Ajouter un vin');
    await expect(page.getByLabel('Nom du vin')).toHaveValue('Syrah Cayas');
    await expect(page.getByLabel('Prix par bouteille (CHF)')).toHaveValue('39');
    await expect(page.getByLabel('Quantité')).toHaveValue('1');
    await page.getByRole('button', { name: 'Ajouter à ma cave' }).tap();
    await page.getByRole('link', { name: 'Voir la fiche' }).tap();
    await expect(page.getByRole('img', { name: 'Photo de la bouteille' })).toBeVisible();

    await page.getByRole('button', { name: 'Ouvrir une bouteille' }).tap();
    await page.locator('label', { has: page.getByRole('radio', { name: '2 / 5' }) }).tap();
    await page.getByRole('button', { name: 'Enregistrer' }).tap();
    await expect(page.getByRole('link', { name: /2\/5/ })).toBeVisible();

    await page.goto('magasin');
    await page.getByLabel('Ou décrivez le vin').fill('Autre syrah du Valais');
    await page.getByRole('button', { name: 'Demander le verdict' }).tap();
    await expect(page.getByTestId('verdict')).toBeVisible();
    expect(JSON.stringify(mock.messageBodies.at(-1)?.['messages'])).toContain('Syrah Cayas 2020 (Germanier) : prédit 8/10 (plaira), noté 2/5 après achat');
  });

  test('signale un vin déjà en cave', async ({ page }) => {
    await mockClaude(page, { models: () => MODEL_OK, messages: () => message(verdict({ wine: reading({ possibleDuplicateId: 'w1' }) })) });
    await importBackup(page, DATA);
    await saveKey(page);
    await page.goto('magasin');
    await page.getByLabel('Ou décrivez le vin').fill('Cornalin Germanier 2019');
    await page.getByRole('button', { name: 'Demander le verdict' }).tap();

    await page.getByRole('link', { name: /Déjà dans votre cave : 3 bouteille\(s\)/ }).tap();
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Cornalin');
  });

  test('signale une étiquette illisible', async ({ page }) => {
    await mockClaude(page, {
      models: () => MODEL_OK,
      messages: () => message(verdict({ wine: reading({ notReadable: true, name: '' }), level: 'mitige', affinity: 5, reasons: [] })),
    });
    await saveKey(page);
    await page.goto('magasin');
    await page.getByLabel("Photographier l'étiquette").setInputFiles({ name: 'flou.png', mimeType: 'image/png', buffer: LABEL_PNG });

    await expect(page.getByRole('alert')).toContainText('Étiquette illisible.');
  });
});
