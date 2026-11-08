import { expect, Page, test } from '@playwright/test';
import { addWine } from './helpers';
import { apiError, LABEL_PNG, message, mockClaude, MODEL_OK, reading } from './claude-mock';

const KEY = 'sk-ant-api03-test-0123456789abcdef';

async function saveKey(page: Page): Promise<void> {
  await page.goto('reglages');
  await page.getByLabel('Clé API Claude').fill(KEY);
  await page.getByRole('button', { name: 'Enregistrer et tester' }).tap();
  await expect(page.getByText('Clé valide. Les fonctions Claude sont actives.')).toBeVisible();
}

test.describe('Itération 2 — connecteur Claude et lecture d’étiquette', () => {
  // Les requêtes relayées par le service worker échappent à l'interception de Playwright.
  test.use({ serviceWorkers: 'block' });

  test('sans clé, l’ajout reste manuel et renvoie vers les réglages', async ({ page }) => {
    await page.goto('ajouter');

    await expect(page.getByText('Pour lire une étiquette avec Claude, ajoutez votre clé API.')).toBeVisible();
    await expect(page.getByText("Photographier l'étiquette")).toHaveCount(0);
    await page.getByRole('link', { name: 'Ouvrir les Réglages' }).tap();
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Réglages');
  });

  test('vérifie la clé avant de l’enregistrer, puis la masque', async ({ page }) => {
    let valid = false;
    await mockClaude(page, { models: () => (valid ? MODEL_OK : apiError(401, 'authentication_error', 'invalid x-api-key')) });
    await page.goto('reglages');
    const input = page.getByLabel('Clé API Claude');

    await input.fill('mauvaise-cle');
    await page.getByRole('button', { name: 'Enregistrer et tester' }).tap();
    await expect(page.getByText('Une clé Claude commence par sk-ant-.')).toBeVisible();

    await input.fill(KEY);
    await page.getByRole('button', { name: 'Enregistrer et tester' }).tap();
    await expect(page.getByText('Clé API refusée. Vérifiez-la dans les Réglages.')).toBeVisible();
    await expect(page.getByTestId('api-key')).toHaveCount(0);

    valid = true;
    await page.getByRole('button', { name: 'Enregistrer et tester' }).tap();
    await expect(page.getByTestId('api-key')).toHaveText('sk-ant-…cdef');

    page.once('dialog', (dialog) => dialog.accept());
    await page.getByRole('button', { name: 'Supprimer la clé' }).tap();
    await expect(page.getByLabel('Clé API Claude')).toBeVisible();
  });

  test('lit une photo d’étiquette, préremplit la fiche et garde la photo', async ({ page }) => {
    const mock = await mockClaude(page, { models: () => MODEL_OK, messages: () => message(reading()) });
    await saveKey(page);
    await page.getByRole('link', { name: 'Cave' }).tap();
    await page.goto('ajouter');

    await page.getByLabel("Photographier l'étiquette").setInputFiles({ name: 'etiquette.png', mimeType: 'image/png', buffer: LABEL_PNG });

    await expect(page.getByText("Fiche remplie par Claude. Relisez les champs marqués d'un point.")).toBeVisible();
    await expect(page.getByLabel('Nom du vin')).toHaveValue('Cornalin');
    await expect(page.getByLabel('Domaine · producteur')).toHaveValue('Germanier');
    await expect(page.getByLabel('Millésime')).toHaveValue('2019');
    await expect(page.getByLabel('Cépages')).toHaveValue('Cornalin');
    await expect(page.getByLabel(/^À boire dès.*à vérifier$/)).toHaveValue('2024');
    await expect(page.getByLabel('Nom du vin', { exact: true })).toBeVisible();

    const body = mock.messageBodies[0];
    expect(body).toMatchObject({ model: 'claude-opus-5-5', fallbacks: 'default', output_config: { effort: 'low', format: { type: 'json_schema' } } });
    const content = (body['messages'] as { content: { type: string; source?: { media_type: string; data: string } }[] }[])[0].content;
    expect(content[1].type).toBe('image');
    expect(content[1].source?.media_type).toBe('image/jpeg');
    expect(Buffer.from(content[1].source?.data ?? '', 'base64').subarray(0, 2)).toEqual(Buffer.from([0xff, 0xd8]));

    await page.getByRole('button', { name: 'Ajouter à ma cave' }).tap();
    await expect(page.getByText('Cornalin 2019 ajouté à la cave.')).toBeVisible();
    await page.getByRole('link', { name: 'Voir la fiche' }).tap();
    await expect(page.getByRole('img', { name: "Photo de l'étiquette" })).toBeVisible();
  });

  test('complète une description et propose d’ajouter les bouteilles au vin existant', async ({ page }) => {
    await mockClaude(page, { models: () => MODEL_OK, messages: () => message(reading({ quantity: 6, pricePaid: 34 })) });
    await saveKey(page);
    await page.goto('ajouter');
    await addWine(page, { name: 'Cornalin', producer: 'Germanier', vintage: '2019', quantity: 1 });

    await page.getByLabel('Ou décrivez le vin').fill('Cornalin Germanier 2019, 6 bouteilles à 34 francs');
    await page.getByRole('button', { name: 'Compléter avec Claude' }).tap();
    await expect(page.getByLabel('Quantité')).toHaveValue('6');
    await expect(page.getByLabel('Prix par bouteille (CHF)')).toHaveValue('34');

    await page.getByRole('button', { name: 'Ajouter à ma cave' }).tap();
    await expect(page.getByText('Ce vin est déjà dans votre cave.')).toBeVisible();
    await page.getByRole('button', { name: 'Ajouter 6 bouteille(s) à ce vin' }).tap();
    await expect(page.getByText('6 bouteille(s) ajoutée(s) à Cornalin 2019.')).toBeVisible();

    await page.getByRole('link', { name: 'Voir la fiche' }).tap();
    await expect(page.getByTestId('bottles')).toHaveText('7');
    await page.getByRole('link', { name: 'Cave' }).tap();
    await expect(page.getByText('1 vin', { exact: true })).toBeVisible();
  });

  test('affiche une erreur claire et laisse la saisie manuelle possible', async ({ page }) => {
    let reply = apiError(429, 'rate_limit_error', 'Rate limited');
    await mockClaude(page, { models: () => MODEL_OK, messages: () => reply });
    await saveKey(page);
    await page.goto('ajouter');

    await page.getByLabel('Ou décrivez le vin').fill('Un rouge du Valais');
    await page.getByRole('button', { name: 'Compléter avec Claude' }).tap();
    await expect(page.getByRole('alert')).toHaveText('Limite de requêtes ou de dépense atteinte. Réessayez dans un moment.');

    reply = message(reading({ notReadable: true, name: '' }));
    await page.getByLabel("Photographier l'étiquette").setInputFiles({ name: 'flou.png', mimeType: 'image/png', buffer: LABEL_PNG });
    await expect(page.getByRole('alert')).toContainText('Étiquette illisible.');

    await addWine(page, { name: 'Saisi à la main', quantity: 1 });
  });
});
