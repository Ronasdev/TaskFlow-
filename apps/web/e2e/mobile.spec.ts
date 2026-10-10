import { expect, test } from '@playwright/test';
import { registerViaUi, uniqueEmail } from './helpers';

test('mobile : navigation basse et création de tâche', async ({ page }) => {
  await registerViaUi(page, 'Mia Mobile', uniqueEmail('mobile'));

  const bottomNav = page.getByRole('navigation', { name: 'Navigation principale' }).last();
  await expect(bottomNav).toBeVisible();
  await bottomNav.getByRole('link', { name: 'Tâches' }).click();

  await page.getByRole('button', { name: 'Nouvelle tâche' }).first().click();
  await page.getByRole('dialog').getByLabel('Titre').fill('Acheter du pain');
  await page.getByRole('button', { name: 'Créer la tâche' }).click();
  await expect(page.getByRole('button', { name: 'Acheter du pain' })).toBeVisible();

  // Pas de défilement horizontal de la page
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth > document.documentElement.clientWidth,
  );
  expect(overflow).toBe(false);
});
