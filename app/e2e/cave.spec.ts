import { expect, test } from '@playwright/test';
import { addWine } from './helpers';

const year = new Date().getFullYear();

test.describe('Itération 1 — cave', () => {
  test('saisit deux vins en série puis les retrouve, filtrés et recherchés', async ({ page }) => {
    await page.goto('cave');
    await expect(page.getByText('Votre cave est vide.')).toBeVisible();
    await page.getByRole('link', { name: 'Ajouter un vin' }).tap();

    await page.getByRole('button', { name: 'Ajouter à ma cave' }).tap();
    await expect(page.getByText('Indiquez le nom du vin.')).toBeVisible();

    await addWine(page, {
      name: 'Cornalin',
      producer: 'Germanier',
      vintage: '2019',
      quantity: 3,
      price: '34',
      country: 'Suisse',
      region: 'Valais',
      grapes: 'Cornalin',
      drinkUntil: String(year),
    });
    await expect(page.getByRole('status')).toHaveText(/Cornalin 2019 ajouté à la cave\./);
    await expect(page.getByLabel('Nom du vin')).toHaveValue('');

    await addWine(page, { name: 'Petite Arvine', producer: 'Chappaz', vintage: '2022', color: 'Blanc', quantity: 2 });
    await page.getByRole('link', { name: 'Fermer' }).tap();

    await expect(page.getByText('5 bouteilles')).toBeVisible();
    await expect(page.getByText('2 vins')).toBeVisible();
    await expect(page.getByText('1 à boire')).toBeVisible();
    await expect(page.getByRole('heading', { name: /Rouges/ })).toBeVisible();
    await expect(page.getByRole('heading', { name: /Blancs/ })).toBeVisible();
    await expect(page.getByRole('link', { name: /Cornalin.*Germanier · Valais.*À boire rapidement/ })).toBeVisible();

    await page.getByLabel('Rechercher un vin').fill('arvine');
    await expect(page.getByRole('link', { name: /Petite Arvine/ })).toBeVisible();
    await expect(page.getByRole('link', { name: /Cornalin/ })).toHaveCount(0);

    await page.getByLabel('Rechercher un vin').fill('');
    await page.getByRole('button', { name: 'À boire' }).tap();
    await expect(page.getByRole('link', { name: /Cornalin/ })).toBeVisible();
    await expect(page.getByRole('link', { name: /Petite Arvine/ })).toHaveCount(0);

    await page.getByRole('button', { name: 'Blancs' }).tap();
    await expect(page.getByRole('link', { name: /Petite Arvine/ })).toBeVisible();
    await expect(page.getByRole('link', { name: /Cornalin/ })).toHaveCount(0);
  });

  test('ouvre, rachète, annule, modifie puis supprime un vin depuis sa fiche', async ({ page }) => {
    await page.goto('ajouter');
    await addWine(page, { name: 'Cornalin', producer: 'Germanier', vintage: '2019', quantity: 3, price: '34' });
    await page.getByRole('link', { name: 'Voir la fiche' }).tap();

    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Cornalin');
    await expect(page.getByTestId('bottles')).toHaveText('3');
    await expect(page.getByText('CHF 34.–')).toBeVisible();

    await page.getByRole('button', { name: 'Ouvrir une bouteille' }).tap();
    await expect(page.getByText('Bouteille ouverte · il en reste 2')).toBeVisible();
    await page.getByRole('button', { name: /Annuler l'ouverture/ }).tap();
    await expect(page.getByTestId('bottles')).toHaveText('3');

    await page.getByRole('button', { name: 'Ajouter une bouteille' }).tap();
    await expect(page.getByTestId('bottles')).toHaveText('4');

    await page.getByRole('link', { name: 'Modifier le vin' }).tap();
    await expect(page.getByLabel('Nom du vin')).toHaveValue('Cornalin');
    await expect(page.getByLabel('Bouteilles en cave')).toHaveValue('4');
    await expect(page.getByLabel('Prix payé par bouteille (CHF)')).toHaveValue('34');
    await page.getByLabel('Nom du vin').fill('Cornalin Réserve');
    await page.getByLabel('Bouteilles en cave').fill('6');
    await page.getByLabel('Prix payé par bouteille (CHF)').fill('36');
    await page.getByRole('button', { name: 'Enregistrer' }).tap();
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Cornalin Réserve');
    await expect(page.getByTestId('bottles')).toHaveText('6');
    await expect(page.getByText('CHF 36.–')).toBeVisible();

    await page.getByRole('link', { name: 'Modifier le vin' }).tap();
    page.once('dialog', (dialog) => dialog.accept());
    await page.getByRole('button', { name: 'Supprimer ce vin' }).tap();
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Ma cave');
    await expect(page.getByText('Votre cave est vide.')).toBeVisible();
  });

  test('range les vins épuisés à part', async ({ page }) => {
    await page.goto('ajouter');
    await addWine(page, { name: 'Dézaley', color: 'Blanc', quantity: 1 });
    await page.getByRole('link', { name: 'Voir la fiche' }).tap();
    await page.getByRole('button', { name: 'Ouvrir une bouteille' }).tap();
    await page.getByRole('link', { name: 'Fiche' }).tap();
    await expect(page.getByRole('button', { name: 'Ouvrir une bouteille' })).toBeDisabled();
    await page.getByRole('link', { name: 'Cave' }).tap();

    await expect(page.getByText('0 bouteille')).toBeVisible();
    await expect(page.getByRole('link', { name: /Dézaley/ })).toHaveCount(0);
    await page.getByRole('button', { name: 'Voir les vins épuisés (1)' }).tap();
    await expect(page.getByRole('link', { name: /Dézaley/ })).toBeVisible();
  });

  test('rappelle de sauvegarder après 30 jours et fusionne un import', async ({ page }) => {
    const longAgo = new Date(Date.now() - 60 * 86_400_000).toISOString();
    const backup = {
      app: 'ma-cave',
      schemaVersion: 1,
      exportedAt: longAgo,
      data: {
        wines: [
          {
            id: 'w-ancien', name: 'Humagne Rouge', producer: 'La Rodeline', vintage: 2020, color: 'rouge',
            country: 'Suisse', region: 'Valais', appellation: '', grapes: ['Humagne Rouge'], alcohol: null,
            sweetness: null, drinkFrom: null, drinkUntil: null, labelPhotoId: null, location: '', notes: '',
            createdAt: longAgo, updatedAt: longAgo,
          },
        ],
        stockMovements: [{ id: 'm-ancien', wineId: 'w-ancien', delta: 2, reason: 'achat', pricePaid: null, date: longAgo }],
      },
    };

    await page.goto('ajouter');
    await addWine(page, { name: 'Pinot Noir', quantity: 1 });
    await page.goto('reglages');
    await page.getByLabel('Importer une sauvegarde').setInputFiles({
      name: 'ancienne.json',
      mimeType: 'application/json',
      buffer: Buffer.from(JSON.stringify(backup)),
    });
    await expect(page.getByText('ancienne.json contient 1 vin(s). Que voulez-vous faire ?')).toBeVisible();
    await page.getByRole('button', { name: 'Fusionner avec mes données' }).tap();
    await expect(page.getByRole('status')).toContainText('Import terminé');

    await page.getByRole('link', { name: 'Cave' }).tap();
    await expect(page.getByRole('link', { name: /Humagne Rouge/ })).toBeVisible();
    await expect(page.getByRole('link', { name: /Pinot Noir/ })).toBeVisible();
    await expect(page.getByRole('status')).toHaveText(/Aucune sauvegarde depuis 60 jours\./);

    await page.getByRole('link', { name: 'Exporter' }).tap();
    const download = page.waitForEvent('download');
    await page.getByRole('button', { name: 'Exporter mes données' }).tap();
    await download;
    await page.getByRole('link', { name: 'Cave' }).tap();
    await expect(page.getByText(/sauvegarde/)).toHaveCount(0);
  });
});
