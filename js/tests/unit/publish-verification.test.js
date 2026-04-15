import { jest } from '@jest/globals';

const originalFetch = global.fetch;

beforeAll(() => {
  global.fetch = jest.fn().mockResolvedValue({
    text: async () => `
      ({
        use: async (name) => {
          if (name === 'command-stream') return { $: () => ({ run: async () => ({ code: 0, stdout: '', stderr: '' }) }) };
          if (name === 'lino-arguments') return { makeConfig: () => ({ shouldPull: false, jsRoot: 'js' }) };
          throw new Error('Unexpected dynamic import: ' + name);
        }
      })
    `,
  });
});

afterAll(() => {
  global.fetch = originalFetch;
});

describe('publish verification', () => {
  test('keeps polling verification through transient npm 404s', async () => {
    const { verifyPublishedVersionWithRunner } =
      await import('../../../scripts/publish-to-npm.mjs');

    const runVerify = jest
      .fn()
      .mockResolvedValueOnce({
        code: 1,
        stdout: '',
        stderr: 'npm error code E404',
      })
      .mockResolvedValueOnce({
        code: 1,
        stdout: '',
        stderr: 'npm error code E404',
      })
      .mockResolvedValueOnce({
        code: 0,
        stdout: '1.7.1\n',
        stderr: '',
      });
    const sleepFn = jest.fn().mockResolvedValue(undefined);

    const published = await verifyPublishedVersionWithRunner(
      '1.7.1',
      runVerify,
      sleepFn
    );

    expect(published).toBe(true);
    expect(runVerify).toHaveBeenCalledTimes(3);
    expect(sleepFn).toHaveBeenCalledTimes(2);
  });
});
