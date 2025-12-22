import { jest } from '@jest/globals';

// Increase timeout for tests that might take longer
jest.setTimeout(10000);

// Suppress console.error during tests
global.console.error = jest.fn();
