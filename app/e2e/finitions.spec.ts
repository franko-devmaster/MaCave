import { expect, Page, test } from '@playwright/test';
import { message, mockClaude, MODEL_OK } from './claude-mock';
import { addWine } from './helpers';

/** Position de défilement du conteneur principal de l'application. */
function scrollTop(page: Page): Promise<number> {
  return page.locator('main').evaluate((main) => main.scrollTop);
}

test.describe('Itération 7 — finitions', () => {
  test('après un ajout, revient en haut sur la confirmation, clavier fermé', async ({ page }) => {
    await page.goto('ajouter');
    await page.getByLabel('Nom du vin').fill('Cornalin');
    await page.getByText('Plus de détails').tap();
    await page.getByLabel('Notes').fill('Acheté au domaine.');
    await page.getByRole('button', { name: 'Ajouter à ma cave' }).scrollIntoViewIfNeeded();
    expect(await scrollTop(page)).toBeGreaterThan(300);

    await page.getByRole('button', { name: 'Ajouter à ma cave' }).tap();

    await expect(page.getByRole('status')).toHaveText(/Cornalin ajouté à la cave\./);
    await expect.poll(() => scrollTop(page)).toBe(0);
    await expect(page.getByRole('status')).toBeInViewport();
    expect(await page.evaluate(() => document.activeElement?.tagName)).toBe('BODY');
  });
});

test.describe('Itération 7 — défilement entre écrans', () => {
  test('ouvre une fiche en haut et rend la position de la liste au retour', async ({ page }) => {
    await page.goto('ajouter');
    for (let i = 1; i <= 12; i++) {
      await addWine(page, { name: `Vin ${String(i).padStart(2, '0')}`, quantity: 1 });
    }
    await page.goto('cave');
    await page.getByRole('link', { name: /Vin 12/ }).scrollIntoViewIfNeeded();
    const listTop = await scrollTop(page);
    expect(listTop).toBeGreaterThan(200);

    await page.getByRole('link', { name: /Vin 12/ }).tap();
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Vin 12');
    await expect.poll(() => scrollTop(page)).toBe(0);

    await page.goBack();
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Ma cave');
    await expect.poll(() => scrollTop(page)).toBe(listTop);
  });
});

test.describe('Itération 7 — conseil sur la fiche', () => {
  test.use({ serviceWorkers: 'block' });

  test('affiche le conseil, ne le redemande pas, le renouvelle après modification', async ({ page }) => {
    const mock = await mockClaude(page, {
      models: () => MODEL_OK,
      messages: () => message({ status: 'apogee', text: 'À son apogée. Ouvrez-le une heure avant, à 16 °C. Parfait avec une raclette.' }),
    });
    await page.goto('reglages');
    await page.getByLabel('Clé API Claude').fill('sk-ant-api03-test-0123456789abcdef');
    await page.getByRole('button', { name: 'Enregistrer et tester' }).tap();
    await expect(page.getByTestId('api-key')).toBeVisible();
    await page.goto('ajouter');
    await addWine(page, { name: 'Cornalin', vintage: '2019', quantity: 2 });
    await page.getByRole('link', { name: 'Voir la fiche' }).tap();

    const advice = page.getByTestId('wine-advice');
    await expect(advice).toContainText('À son apogée');
    await expect(advice).toContainText('Parfait avec une raclette.');
    expect(mock.messageBodies).toHaveLength(1);
    expect(String(mock.messageBodies[0]['system'])).toContain('Tu conseilles une personne sur une bouteille');

    await page.getByRole('link', { name: 'Cave' }).tap();
    await page.getByRole('link', { name: /Cornalin/ }).tap();
    await expect(advice).toContainText('À son apogée');
    expect(mock.messageBodies).toHaveLength(1);

    await page.getByRole('link', { name: 'Modifier la fiche' }).tap();
    await page.getByLabel('Millésime').fill('2020');
    await page.getByRole('button', { name: 'Enregistrer' }).tap();
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Cornalin');
    await expect.poll(() => mock.messageBodies.length).toBe(2);
  });
});

test.describe('Itération 7 — hors ligne et lancement', () => {
  test('signale la perte de réseau et garde la cave consultable', async ({ page, context }) => {
    await page.goto('ajouter');
    await addWine(page, { name: 'Cornalin', quantity: 1 });
    await page.goto('cave');

    await context.setOffline(true);
    await expect(page.getByText('Hors ligne : votre cave reste consultable, Claude est indisponible.')).toBeVisible();
    await page.getByRole('link', { name: /Cornalin/ }).tap();
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Cornalin');

    await context.setOffline(false);
    await expect(page.getByText(/Hors ligne/)).toHaveCount(0);
  });

  test('déclare l’écran de lancement de l’iPhone 16 Pro', async ({ page, request }) => {
    await page.goto('./');
    const link = page.locator('link[rel="apple-touch-startup-image"]');
    await expect(link).toHaveAttribute('media', /device-width: 402px\) and \(device-height: 874px\)/);
    const response = await request.get(`icons/splash-1206x2622.png`);
    expect(response.status()).toBe(200);
  });
});
