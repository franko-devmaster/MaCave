import { expect, Page, test } from '@playwright/test';
import { importBackup, sampleTasting, sampleWine } from './helpers';

const DATA = {
  wines: [sampleWine('w1', 'Cornalin', ['Cornalin']), { ...sampleWine('w2', 'Syrah Cayas', ['Syrah']), wishlist: true }],
  stockMovements: [{ id: 'm1', wineId: 'w1', delta: 3, reason: 'achat', pricePaid: 34, date: new Date().toISOString() }],
  tastings: [sampleTasting('t1', 'w1', 4)],
};

/** Rien ne doit dépasser la largeur de l'écran : sinon iOS décale ou dézoome la page. */
async function expectNoHorizontalOverflow(page: Page, route: string): Promise<void> {
  await page.goto(route);
  await expect(page.locator('main.content')).toBeVisible();
  await page.waitForTimeout(200);
  const screenWidth = page.viewportSize()?.width ?? 0;
  // Quand un élément déborde, le navigateur mobile élargit la page entière (innerWidth grandit).
  const layout = await page.evaluate(() => {
    const main = document.querySelector('main.content') as HTMLElement;
    return { width: window.innerWidth, mainOverflow: main.scrollWidth - main.clientWidth };
  });
  expect(layout, route).toEqual({ width: screenWidth, mainOverflow: 0 });
}

test.describe('Mise en page', () => {
  test('aucun écran ne déborde de la largeur du téléphone', async ({ page }) => {
    await importBackup(page, DATA);
    for (const route of [
      'cave',
      'cave?vue=souhaits',
      'cave/w1',
      'cave/w1/modifier',
      'cave/w1/noter',
      'cave/w2',
      'ajouter',
      'ajouter/souhait',
      'magasin',
      'accords',
      'gouts',
      'reglages',
    ]) {
      await expectNoHorizontalOverflow(page, route);
    }
  });
});
