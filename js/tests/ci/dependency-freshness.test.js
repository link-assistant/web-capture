import { jest } from '@jest/globals';
import { checkVersions } from '../../../scripts/check-dependency-freshness.mjs';

const latest = async () => '2.0.0';
const dependencies = [{ name: 'example', current: '1.0.0' }];
const blockers = {
  example: {
    issue: 'https://github.com/example/repo/issues/1',
    reason: 'Upstream API breaks packaged consumers',
  },
};

test('freshness rejects old releases, missing packages and undocumented exceptions', async () => {
  for (const current of ['1.0.0', '(missing)']) {
    await expect(
      checkVersions([{ name: 'example', current }], {}, latest, jest.fn())
    ).rejects.toThrow('behind 2.0.0');
  }
});
test('freshness permits only documented open issues', async () => {
  await expect(
    checkVersions(dependencies, blockers, latest, async () => ({
      state: 'open',
    }))
  ).resolves.toBeUndefined();
  await expect(
    checkVersions(dependencies, blockers, latest, async () => ({
      state: 'closed',
    }))
  ).rejects.toThrow('is closed');
  await expect(
    checkVersions(
      dependencies,
      { example: { ...blockers.example, reason: '' } },
      latest,
      jest.fn()
    )
  ).rejects.toThrow('document an open issue');
  await expect(
    checkVersions(
      dependencies,
      { example: { ...blockers.example, reason: '   ' } },
      latest,
      jest.fn()
    )
  ).rejects.toThrow('document an open issue');
});
test('registry and issue failures fail the check rather than treating dependencies as fresh', async () => {
  await expect(
    checkVersions(
      dependencies,
      {},
      async () => {
        throw new Error('registry down');
      },
      jest.fn()
    )
  ).rejects.toThrow('registry down');
  await expect(
    checkVersions(dependencies, blockers, latest, async () => {
      throw new Error('issue unavailable');
    })
  ).rejects.toThrow('issue unavailable');
});
test('current releases need no exception', async () => {
  const getIssue = jest.fn();
  await checkVersions(
    [{ name: 'example', current: '2.0.0' }],
    {},
    latest,
    getIssue
  );
  expect(getIssue).not.toHaveBeenCalled();
});
