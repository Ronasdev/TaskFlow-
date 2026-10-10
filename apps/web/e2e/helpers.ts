import { expect, type APIRequestContext, type Page } from '@playwright/test';

export const PASSWORD = 'Password123!';

export const uniqueEmail = (prefix: string) =>
  `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}@e2e.test`;

/** Inscription via l'interface ; termine sur le tableau de bord. */
export async function registerViaUi(page: Page, name: string, email: string) {
  await page.goto('/register');
  await page.getByLabel('Nom').fill(name);
  await page.getByLabel('Email').fill(email);
  await page.getByLabel('Mot de passe', { exact: true }).fill(PASSWORD);
  await page.getByLabel('Confirmer le mot de passe').fill(PASSWORD);
  await page.getByRole('button', { name: 'Créer mon compte' }).click();
  await expect(page.getByRole('heading', { name: new RegExp(`${name.split(' ')[0]}`) })).toBeVisible();
}

export async function loginViaUi(page: Page, email: string) {
  await page.goto('/login');
  await page.getByLabel('Email').fill(email);
  await page.getByLabel('Mot de passe').fill(PASSWORD);
  await page.getByRole('button', { name: 'Se connecter' }).click();
  await expect(page.getByRole('navigation', { name: 'Navigation principale' }).first()).toBeVisible();
}

/** Inscription via l'API (mise en place rapide) ; renvoie le token d'accès. */
export async function registerViaApi(request: APIRequestContext, name: string, email: string) {
  const response = await request.post('/api/v1/auth/register', {
    data: { name, email, password: PASSWORD },
  });
  expect(response.status()).toBe(201);
  return ((await response.json()) as { accessToken: string }).accessToken;
}
