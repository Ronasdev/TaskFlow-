import { execSync } from 'node:child_process';

/**
 * Applique les migrations sur la base de test (valide aussi les migrations).
 * Les données sont vidées avant chaque test par resetDatabase().
 */
export default function globalSetup(): void {
  process.loadEnvFile('.env.test');
  execSync('npx prisma migrate deploy', {
    stdio: 'inherit',
    env: { ...process.env, NODE_ENV: 'test' },
  });
}
