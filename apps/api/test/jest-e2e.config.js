/** Tests d'intégration : API complète contre une vraie base PostgreSQL (docker-compose.test.yml). */
module.exports = {
  moduleFileExtensions: ['js', 'json', 'ts'],
  rootDir: '..',
  testRegex: 'test/e2e/.*\\.e2e-spec\\.ts$',
  transform: { '^.+\\.ts$': 'ts-jest' },
  testEnvironment: 'node',
  globalSetup: '<rootDir>/test/global-setup.ts',
  setupFiles: ['<rootDir>/test/setup-env.ts'],
  testTimeout: 30_000,
  collectCoverageFrom: ['src/**/*.ts', '!src/main.ts', '!src/**/*.module.ts'],
  coverageDirectory: 'coverage/e2e',
  coverageThreshold: {
    global: { lines: 80 },
    './src/projects/project-access.ts': { lines: 100, branches: 100 },
    './src/tasks/task-access.ts': { lines: 100, branches: 100 },
    './src/auth/auth.service.ts': { lines: 100 },
  },
};
