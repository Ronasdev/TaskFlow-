/** Tests unitaires : fichiers *.spec.ts dans src/ */
module.exports = {
  moduleFileExtensions: ['js', 'json', 'ts'],
  rootDir: 'src',
  testRegex: '.*\\.spec\\.ts$',
  transform: { '^.+\\.ts$': 'ts-jest' },
  testEnvironment: 'node',
  collectCoverageFrom: ['**/*.ts', '!main.ts', '!**/*.module.ts', '!**/dto/**'],
  coverageDirectory: '../coverage/unit',
  coverageThreshold: {
    './projects/project-access.ts': { lines: 100, branches: 100 },
    './tasks/task-access.ts': { lines: 100, branches: 100 },
  },
};
