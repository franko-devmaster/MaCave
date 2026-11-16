import { devices, expect, test } from '@playwright/test';

// Profil Android (Chromium) : seul le type de navigateur reste celui du projet.
// eslint-disable-next-line @typescript-eslint/no-unused-vars
const { defaultBrowserType, ...pixel } = devices['Pixel 7'];

test.describe('Export sur Android', () => {
  test.use(pixel);

  test('Chrome refuse de partager un .json : l’export est téléchargé', async ({ page }) => {
    await page.addInitScript(() => {
      Object.defineProperty(navigator, 'canShare', { value: () => false, configurable: true });
    });
    await page.goto('reglages');

    const downloadPromise = page.waitForEvent('download');
    await page.getByRole('button', { name: 'Exporter mes données' }).tap();
    const download = await downloadPromise;

    expect(download.suggestedFilename()).toMatch(/^ma-cave-\d{4}-\d{2}-\d{2}\.json$/);
    await expect(page.getByText(/Export téléchargé : ma-cave-.*\.json\. Il se trouve dans le dossier Téléchargements\./)).toBeVisible();
  });

  test('la feuille de partage échoue : l’export est quand même téléchargé', async ({ page }) => {
    await page.addInitScript(() => {
      Object.defineProperty(navigator, 'canShare', { value: () => true, configurable: true });
      Object.defineProperty(navigator, 'share', {
        value: () => Promise.reject(new DOMException('Must be handling a user gesture', 'NotAllowedError')),
        configurable: true,
      });
    });
    await page.goto('reglages');

    const downloadPromise = page.waitForEvent('download');
    await page.getByRole('button', { name: 'Exporter mes données' }).tap();
    await downloadPromise;

    await expect(page.getByText(/Export téléchargé/)).toBeVisible();
    await expect(page.getByText(/Dernier export : /)).toBeVisible();
  });
});
