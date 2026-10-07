import { jest } from '@jest/globals';
import path from 'node:path';
import { withTemporaryDirectory } from '../helpers/temporary-directory.js';

const initialPage = { close: jest.fn(), bringToFront: jest.fn() };
const browser = { pages: jest.fn(() => [initialPage]), close: jest.fn() };
const launch = jest.fn(async () => browser);
const launchPersistentContext = jest.fn(async () => browser);
jest.unstable_mockModule('puppeteer', () => ({ default: { launch } }));
jest.unstable_mockModule('playwright', () => ({
  chromium: { launchPersistentContext },
}));
const { createBrowser } = await import('../../src/browser.js');

beforeEach(() => {
  jest.clearAllMocks();
});

test.each(['puppeteer', 'playwright'])(
  '%s forwards packaged executablePath and channel to the engine',
  (engine) =>
    withTemporaryDirectory('launch-options-', async (directory) => {
      const options = {
        executablePath: path.join(directory, 'packaged-chromium'),
        channel: 'chrome',
        userDataDir: directory,
      };
      const handle = await createBrowser(engine, options);
      try {
        const observed =
          engine === 'puppeteer'
            ? launch.mock.calls[0][0]
            : launchPersistentContext.mock.calls[0][1];
        expect(observed).toMatchObject({
          executablePath: options.executablePath,
          channel: options.channel,
        });
      } finally {
        await handle.close();
      }
    })
);
