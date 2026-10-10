import { defineConfig, devices } from '@playwright/test';

/**
 * Parcours critiques de bout en bout (docs/TESTING.md §8), contre une stack démarrée :
 * - dev : `npm run dev` à la racine → http://localhost:5173 (défaut)
 * - prod locale : docker-compose.prod.yml → E2E_BASE_URL=http://localhost:8088
 */
export default defineConfig({
  testDir: './e2e',
  fullyParallel: false,
  workers: 1,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [['github'], ['html', { open: 'never' }]] : 'list',
  use: {
    baseURL: process.env.E2E_BASE_URL ?? 'http://localhost:5173',
    locale: 'fr-FR',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  projects: [
    { name: 'desktop', use: { ...devices['Desktop Chrome'] }, testIgnore: /mobile\.spec\.ts/ },
    { name: 'mobile', use: { ...devices['Pixel 7'] }, testMatch: /mobile\.spec\.ts/ },
  ],
});
