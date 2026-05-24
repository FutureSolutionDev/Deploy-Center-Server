/**
 * Jest config for Deploy Center server — F-002.
 * ts-jest + path aliases mirrored from tsconfig.json + ratcheted coverage gate.
 * Ratchet schedule (research D-10): wk1=0, wk2=20, wk3=30, wk4=40 (GA).
 */

/** @type {import('jest').Config} */
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',

  // Test discovery — v3.0 moves tests under server/__tests__/ mirroring src/.
  roots: ['<rootDir>/__tests__'],
  testMatch: ['**/__tests__/**/*.test.ts'],
  testPathIgnorePatterns: ['/node_modules/', '/dist/'],

  // Path aliases — keep in lockstep with tsconfig.json compilerOptions.paths.
  moduleNameMapper: {
    '^@Config/(.*)$': '<rootDir>/src/Config/$1',
    '^@Models/(.*)$': '<rootDir>/src/Models/$1',
    '^@Controllers/(.*)$': '<rootDir>/src/Controllers/$1',
    '^@Services/(.*)$': '<rootDir>/src/Services/$1',
    '^@Middleware/(.*)$': '<rootDir>/src/Middleware/$1',
    '^@Routes/(.*)$': '<rootDir>/src/Routes/$1',
    '^@Utils/(.*)$': '<rootDir>/src/Utils/$1',
    '^@Database/(.*)$': '<rootDir>/src/Database/$1',
    '^@Types/(.*)$': '<rootDir>/src/Types/$1',
    '^@Migrations/(.*)$': '<rootDir>/src/Migrations/$1',
  },

  // ts-jest options.
  transform: {
    '^.+\\.ts$': ['ts-jest', { tsconfig: 'tsconfig.json' }],
  },

  // Coverage
  collectCoverage: false, // CI passes --coverage explicitly
  coverageDirectory: 'coverage',
  coverageReporters: ['text-summary', 'lcov', 'json-summary'],
  collectCoverageFrom: [
    'src/**/*.ts',
    '!src/**/*.d.ts',
    '!src/index.ts',
    '!src/**/index.ts',
    '!src/Types/**',       // type-only files; coverage not meaningful
    '!src/Migrations/**',  // covered by integration tests, not unit-tracked
  ],
  coverageThreshold: {
    // Ratcheted across the v3.0 implementation timeline (research D-10).
    // wk1=0  ✓ (T008)
    // wk2=20 ✓ (T046)
    // wk3=30 ✓ (T077)
    // wk4=40 ✓ (T094, GA gate — this raise) ← current
    global: {
      lines: 40,
      statements: 40,
      branches: 25,
      functions: 35,
    },
  },

  // Solo-dev stability + single shared isolated test DB.
  maxWorkers: 1,
  testTimeout: 20000,
  bail: 0,
  verbose: false,

  clearMocks: true,
  restoreMocks: true,
};
