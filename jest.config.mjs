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
    '**/tests/e2e/**/*.test.js',
  ],
  setupFiles: ['./tests/jest.setup.mjs'],
};
