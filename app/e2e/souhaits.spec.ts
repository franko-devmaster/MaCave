import { expect, Page, test } from '@playwright/test';
import { LABEL_PNG, message, mockClaude, MODEL_OK, reading } from './claude-mock';

async function rate(page: Page, score: number): Promise<void> {
  await page.locator('label', { has: page.getByRole('radio', { name: `${score} / 5` }) }).tap();
}

test.describe('Liste de souhaits', () => {
  test('un vin goûté rejoint les souhaits sans bouteille, se note, puis entre en cave à l’achat', async ({ page }) => {
    await page.goto('ajouter');
    await page.getByRole('navigation', { name: "Type d'ajout" }).getByRole('link', { name: "Je l'ai goûté" }).tap();
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Ajouter un souhait');
    await expect(page.getByLabel('Quantité')).toHaveCount(0);
    await expect(page.getByLabel('Prix par bouteille (CHF)')).toHaveCount(0);

    await page.getByLabel('Nom du vin').fill('Humagne Rouge');
    await page.getByLabel('Millésime').fill('2021');
    await page.getByRole('button', { name: 'Ajouter à mes souhaits' }).tap();
    await expect(page.getByRole('status')).toContainText('Humagne Rouge 2021 ajouté à vos souhaits.');

    await page.getByRole('link', { name: 'Noter ce vin' }).tap();
    await rate(page, 5);
    await page.getByRole('button', { name: 'Enregistrer' }).tap();
    await expect(page.getByRole('status')).toContainText('Dégustation enregistrée.');
    await expect(page.getByTestId('wish-state')).toContainText('Sur votre liste de souhaits');
    await expect(page.getByRole('button', { name: 'Ouvrir une bouteille' })).toHaveCount(0);

    // Le retour depuis la fiche d'un souhait ramène sur la liste de souhaits.
    await page.getByRole('link', { name: 'Cave' }).tap();
    await expect(page).toHaveURL(/vue=souhaits/);
    await expect(page.getByRole('button', { name: 'Souhaits (1)' })).toHaveAttribute('aria-pressed', 'true');
    const wish = page.getByRole('link', { name: /Humagne Rouge/ });
    await expect(wish).toBeVisible();

    await page.getByRole('button', { name: 'En cave' }).tap();
    await expect(page.getByText('0 bouteille')).toBeVisible();
    await expect(page.getByRole('link', { name: /Humagne/ })).toHaveCount(0);
    await expect(page.getByRole('button', { name: /Voir les vins épuisés/ })).toHaveCount(0);
    await page.getByRole('button', { name: 'Souhaits (1)' }).tap();
    await expect(wish.getByRole('img', { name: 'Selon vos goûts' })).toBeVisible();

    await wish.tap();
    await page.getByRole('button', { name: "Je l'ai acheté" }).tap();
    await expect(page.getByRole('status')).toContainText('Ajouté à votre cave.');
    await expect(page.getByTestId('bottles')).toHaveText('1');

    await page.getByRole('button', { name: 'Annuler' }).tap();
    await expect(page.getByTestId('wish-state')).toBeVisible();

    await page.getByRole('link', { name: 'Cave' }).tap();
    await expect(page.getByRole('button', { name: 'Souhaits (1)' })).toHaveAttribute('aria-pressed', 'true');
  });

  test('un vin épuisé peut être remis sur la liste, puis en être retiré', async ({ page }) => {
    await page.goto('ajouter');
    await page.getByLabel('Nom du vin').fill('Dézaley');
    await page.getByRole('button', { name: 'Ajouter à ma cave' }).tap();
    await page.getByRole('link', { name: 'Voir la fiche' }).tap();
    await page.getByRole('button', { name: 'Ouvrir une bouteille' }).tap();
    await page.getByRole('link', { name: 'Fiche' }).tap();

    await page.getByRole('button', { name: 'Mettre sur ma liste de souhaits' }).tap();
    await expect(page.getByTestId('wish-state')).toBeVisible();
    await page.getByRole('button', { name: 'Retirer de mes souhaits' }).tap();
    await expect(page.getByTestId('wish-state')).toHaveCount(0);
    await expect(page.getByTestId('bottles')).toHaveText('0');
  });

  test.describe('avec Claude', () => {
    test.use({ serviceWorkers: 'block' });

    test('en magasin, « Liste de souhaits » garde le vin pour plus tard, sans bouteille', async ({ page }) => {
      await mockClaude(page, {
        models: () => MODEL_OK,
        messages: () =>
          message({
            wine: reading({ name: 'Syrah Cayas', vintage: 2020, grapes: ['Syrah'], pricePaid: 39 }),
            level: 'plaira',
            affinity: 8,
            reasons: [{ sign: '+', text: 'Proche de vos goûts.' }],
          }),
      });
      await page.goto('reglages');
      await page.getByLabel('Clé API Claude').fill('sk-ant-api03-test-0123456789abcdef');
      await page.getByRole('button', { name: 'Enregistrer et tester' }).tap();
      await expect(page.getByTestId('api-key')).toBeVisible();

      await page.goto('magasin');
      await page.getByLabel("Photographier l'étiquette").setInputFiles({ name: 'e.png', mimeType: 'image/png', buffer: LABEL_PNG });
      await expect(page.getByText('Devrait vous plaire')).toBeVisible();
      await expect(page.getByRole('button', { name: "Je l'achète" })).toBeInViewport();
      await page.getByRole('button', { name: 'Liste de souhaits' }).tap();

      await expect(page.getByRole('heading', { level: 1 })).toHaveText('Ajouter un souhait');
      await expect(page.getByLabel('Nom du vin')).toHaveValue('Syrah Cayas');
      await page.getByRole('button', { name: 'Ajouter à mes souhaits' }).tap();
      await expect(page.getByRole('status')).toContainText('Syrah Cayas 2020 ajouté à vos souhaits.');

      await page.goto('cave?vue=souhaits');
      await expect(page.getByRole('link', { name: /Syrah Cayas/ })).toBeVisible();
    });
  });
});
