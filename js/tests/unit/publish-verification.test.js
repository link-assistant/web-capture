import { jest } from '@jest/globals';

jest.unstable_mockModule('execa', () => ({
  $: () => async () => ({ exitCode: 0, stdout: '', stderr: '' }),
}));
jest.unstable_mockModule('lino-arguments', () => ({
  makeConfig: () => ({ shouldPull: false, jsRoot: 'js' }),
}));

beforeAll(() => {
  jest
    .spyOn(global, 'fetch')
    .mockRejectedValue(new Error('unexpected remote code download'));
});

afterAll(() => {
  global.fetch.mockRestore();
});

describe('publish verification', () => {
  test('keeps polling verification through transient npm 404s', async () => {
    const { verifyPublishedVersionWithRunner } =
      await import('../../../scripts/publish-to-npm.mjs');

    const runVerify = jest
      .fn()
      .mockResolvedValueOnce({
        exitCode: 1,
        stdout: '',
        stderr: 'npm error code E404',
      })
      .mockResolvedValueOnce({
        exitCode: 1,
        stdout: '',
        stderr: 'npm error code E404',
      })
      .mockResolvedValueOnce({
        exitCode: 0,
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
