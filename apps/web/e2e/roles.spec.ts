import { expect, test } from '@playwright/test';
import { loginViaUi, registerViaApi, uniqueEmail } from './helpers';

test('rôles : un MEMBER ne supprime pas une tâche DONE, un VIEWER est en lecture seule', async ({
  page,
  request,
}) => {
  const owner = { name: 'Alice Owner', email: uniqueEmail('owner') };
  const member = { name: 'Bob Member', email: uniqueEmail('member') };
  const viewer = { name: 'Carol Viewer', email: uniqueEmail('viewer') };
  await registerViaApi(request, member.name, member.email);
  await registerViaApi(request, viewer.name, viewer.email);

  // Alice crée un projet, ajoute Bob (MEMBER) et Carol (VIEWER) via l'interface
  await page.goto('/register');
  await page.getByLabel('Nom').fill(owner.name);
  await page.getByLabel('Email').fill(owner.email);
  await page.getByLabel('Mot de passe', { exact: true }).fill('Password123!');
  await page.getByLabel('Confirmer le mot de passe').fill('Password123!');
  await page.getByRole('button', { name: 'Créer mon compte' }).click();

  await page.getByRole('link', { name: 'Projets' }).first().click();
  await page.getByRole('button', { name: 'Nouveau projet' }).first().click();
  await page.getByRole('dialog').getByLabel('Nom').fill('Projet partagé');
  await page.getByRole('button', { name: 'Créer le projet' }).click();
  await expect(page.getByRole('heading', { name: 'Projet partagé' })).toBeVisible();

  await page.getByRole('button', { name: 'Nouvelle tâche' }).first().click();
  await page.getByRole('dialog').getByLabel('Titre').fill('Tâche terminée');
  await page.getByRole('dialog').getByLabel('Statut').selectOption('DONE');
  await page.getByRole('button', { name: 'Créer la tâche' }).click();
  await expect(page.getByRole('button', { name: 'Tâche terminée' })).toBeVisible();

  await page.getByRole('link', { name: 'Paramètres du projet' }).click();
  for (const [person, role] of [
    [member, 'MEMBER'],
    [viewer, 'VIEWER'],
  ] as const) {
    await page.getByLabel('Email').fill(person.email);
    await page.getByLabel('Rôle', { exact: true }).selectOption(role);
    await page.getByRole('button', { name: 'Ajouter' }).click();
    await expect(page.getByText(person.name)).toBeVisible();
  }
  const projectUrl = page.url().replace(/\/settings$/, '');
  await page.getByRole('button', { name: 'Menu utilisateur' }).click();
  await page.getByRole('menuitem', { name: 'Se déconnecter' }).click();

  // Bob (MEMBER) : peut éditer, mais pas supprimer ni rouvrir une tâche DONE
  await loginViaUi(page, member.email);
  await page.goto(projectUrl);
  await page.getByRole('button', { name: 'Actions pour « Tâche terminée »' }).click();
  await expect(page.getByRole('menuitem', { name: /Supprimer \(réservé aux admins\)/ })).toBeDisabled();
  await expect(page.getByRole('menuitem', { name: 'À faire' })).toBeDisabled();
  await page.keyboard.press('Escape');
  await page.getByRole('button', { name: 'Menu utilisateur' }).click();
  await page.getByRole('menuitem', { name: 'Se déconnecter' }).click();

  // Carol (VIEWER) : lecture seule, aucune action
  await loginViaUi(page, viewer.email);
  await page.goto(projectUrl);
  await expect(page.getByText('Lecture seule')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Nouvelle tâche' })).toHaveCount(0);
  await expect(page.getByRole('button', { name: /Actions pour/ })).toHaveCount(0);
  await page.getByRole('button', { name: 'Tâche terminée' }).click();
  await expect(page.getByText('Vous avez un accès en lecture seule à ce projet.')).toBeVisible();
});
