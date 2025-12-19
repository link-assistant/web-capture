export default {
  transform: {
    '^.+\\.js$': ['babel-jest', { configFile: './babel.config.cjs' }],
  },
  transformIgnorePatterns: ['node_modules/(?!(turndown)/)'],
  moduleNameMapper: {
    '^(\\.{1,2}/.*)\\.js$': '$1',
  },
  testEnvironment: 'node',
  verbose: true,
  testMatch: [
    '**/tests/unit/**/*.test.js',
    '**/tests/mock/**/*.test.js',
    // E2E tests excluded from CI (they require running servers)
    // '**/tests/e2e/**/*.test.js',
    // '**/tests/integration/**/*.test.js',
  ],
  setupFiles: ['./tests/jest.setup.mjs'],
};
