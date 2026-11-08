import { expect, test } from '@playwright/test';
import { readFile } from 'node:fs/promises';

test.describe('Itération 0 — socle', () => {
  test('ouvre la cave et navigue entre les quatre onglets', async ({ page }) => {
    await page.goto('./');

    await expect(page).toHaveURL(/\/MaCave\/cave$/);
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Ma cave');
    const nav = page.getByRole('navigation', { name: 'Navigation principale' });
    await expect(nav.getByRole('link', { name: 'Cave' })).toHaveAttribute('aria-current', 'page');

    for (const [tab, heading, path] of [
      ['Ajouter', 'Ajouter', 'ajouter'],
      ['Accords', 'Accords', 'accords'],
      ['Goûts', 'Mes goûts', 'gouts'],
      ['Cave', 'Ma cave', 'cave'],
    ]) {
      await nav.getByRole('link', { name: tab }).tap();
      await expect(page).toHaveURL(new RegExp(`/MaCave/${path}$`));
      await expect(page.getByRole('heading', { level: 1 })).toHaveText(heading);
      await expect(nav.getByRole('link', { name: tab })).toHaveAttribute('aria-current', 'page');
    }
  });

  test('ouvre directement une route profonde', async ({ page }) => {
    await page.goto('gouts');

    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Mes goûts');
  });

  test('expose un manifeste installable et enregistre le service worker', async ({ page, request }) => {
    test.setTimeout(60_000);
    await page.goto('./');

    const manifestHref = await page.locator('link[rel="manifest"]').getAttribute('href');
    const manifest = await (await request.get(manifestHref ?? '')).json();
    expect(manifest).toMatchObject({ name: 'Ma Cave', short_name: 'Ma Cave', display: 'standalone', lang: 'fr' });
    expect(manifest.icons.map((icon: { sizes: string }) => icon.sizes)).toEqual(['192x192', '512x512', '512x512']);
    await expect(page.locator('link[rel="apple-touch-icon"]')).toHaveAttribute('href', 'icons/apple-touch-icon.png');
    await expect(page.locator('meta[name="apple-mobile-web-app-capable"]')).toHaveAttribute('content', 'yes');

    const scriptUrl = await page.evaluate(async () => (await navigator.serviceWorker.ready).active?.scriptURL);
    expect(scriptUrl).toMatch(/\/MaCave\/ngsw-worker\.js$/);
  });

  test('exporte puis réimporte une sauvegarde depuis les réglages', async ({ page }) => {
    await page.goto('./');
    await page.getByRole('link', { name: 'Réglages' }).tap();
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Réglages');
    await expect(page.getByRole('navigation', { name: 'Navigation principale' })).toHaveCount(0);
    await expect(page.getByText("Aucun export pour l'instant.")).toBeVisible();

    const downloadPromise = page.waitForEvent('download');
    await page.getByRole('button', { name: 'Exporter mes données' }).tap();
    const download = await downloadPromise;
    expect(download.suggestedFilename()).toMatch(/^ma-cave-\d{4}-\d{2}-\d{2}\.json$/);
    const backup = JSON.parse(await readFile(await download.path(), 'utf8'));
    expect(backup).toMatchObject({ app: 'ma-cave', schemaVersion: 1 });
    expect(backup.data.wines).toEqual([]);
    await expect(page.getByText(/Dernier export : \d{2}\.\d{2}\.\d{4}, \d{2}:\d{2}/)).toBeVisible();

    page.once('dialog', (dialog) => dialog.accept());
    await page.getByLabel('Importer une sauvegarde').setInputFiles({
      name: 'sauvegarde.json',
      mimeType: 'application/json',
      buffer: Buffer.from(JSON.stringify(backup)),
    });
    await expect(page.getByRole('status')).toHaveText(/^Import terminé : \d+ enregistrement\(s\)\.$/);

    page.once('dialog', (dialog) => dialog.accept());
    await page.getByLabel('Importer une sauvegarde').setInputFiles({
      name: 'autre.json',
      mimeType: 'application/json',
      buffer: Buffer.from('{"app":"autre"}'),
    });
    await expect(page.getByRole('status')).toHaveText("Import impossible : ce fichier n'est pas une sauvegarde Ma Cave");

    await page.getByRole('link', { name: 'Cave' }).tap();
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Ma cave');
  });

  test('affiche la version de l’application', async ({ page }) => {
    await page.goto('reglages');

    await expect(page.getByTestId('app-version')).toHaveText(/v\d+\.\d+\.\d+ · \S+/);
  });
});
