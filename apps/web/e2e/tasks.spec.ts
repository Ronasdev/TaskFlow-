import { expect, test } from '@playwright/test';
import { loginViaUi, registerViaUi, uniqueEmail } from './helpers';

test('inscription, création de tâche, changement de statut, session et déconnexion', async ({
  page,
}) => {
  const email = uniqueEmail('solo');
  await registerViaUi(page, 'Sam Solo', email);

  // Tableau de bord vide
  await expect(page.getByText('Aucune tâche ouverte ne vous est assignée.')).toBeVisible();

  // Création d'une tâche dans le projet personnel
  await page.getByRole('link', { name: 'Tâches' }).first().click();
  await page.getByRole('button', { name: 'Nouvelle tâche' }).first().click();
  const dialog = page.getByRole('dialog', { name: 'Nouvelle tâche' });
  await dialog.getByLabel('Titre').fill('Préparer la démo');
  await dialog.getByLabel('Priorité').selectOption('HIGH');
  await page.getByRole('button', { name: 'Créer la tâche' }).click();
  await expect(page.getByText('Tâche créée')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Préparer la démo' })).toBeVisible();

  // Terminer la tâche (case à cocher, mise à jour optimiste)
  await page.getByRole('checkbox', { name: 'Terminer « Préparer la démo »' }).click();
  await expect(page.getByRole('checkbox', { name: 'Rouvrir « Préparer la démo »' })).toBeChecked();

  // Le tableau de bord reflète le changement
  await page.getByRole('link', { name: 'Tableau de bord' }).first().click();
  await expect(page.getByText('Préparer la démo')).toBeVisible();

  // Rechargement : la session est restaurée via le cookie httpOnly
  await page.reload();
  await expect(page.getByRole('heading', { name: /Sam/ })).toBeVisible();

  // Le refresh token n'est jamais accessible en JavaScript
  expect(await page.evaluate(() => document.cookie)).not.toContain('refresh_token');
  expect(await page.evaluate(() => JSON.stringify(localStorage))).not.toMatch(/eyJ/);

  // Déconnexion
  await page.getByRole('button', { name: 'Menu utilisateur' }).click();
  await page.getByRole('menuitem', { name: 'Se déconnecter' }).click();
  await expect(page.getByRole('heading', { name: 'Connexion' })).toBeVisible();
  await page.goto('/tasks');
  await expect(page).toHaveURL(/\/login$/);

  // Reconnexion
  await loginViaUi(page, email);
});

test('une ressource d’un autre utilisateur affiche « introuvable »', async ({ page }) => {
  await registerViaUi(page, 'Eve Curieuse', uniqueEmail('eve'));
  await page.goto('/projects/00000000-0000-4000-8000-000000000000');
  await expect(page.getByRole('heading', { name: 'Page introuvable' })).toBeVisible();
});
