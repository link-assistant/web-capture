import assert from 'node:assert/strict';
import { test } from 'node:test';
import { ensureNpm } from '../../scripts/setup-npm.mjs';

test('an old npm major or patch is updated to the locked current release', async () => {
  for (const initial of ['10.9.7', '11.4.2', '12.0.0']) {
    const calls = [];
    const run = async (args) => {
      calls.push(args);
      return {
        stdout:
          args[0] === '--version'
            ? calls.length === 1
              ? initial
              : '12.2.0'
            : '',
      };
    };
    assert.equal(await ensureNpm(run), '12.2.0');
    assert.deepEqual(calls, [
      ['--version'],
      ['install', '--global', 'npm@12.2.0'],
      ['--version'],
    ]);
  }
});

test('a current npm installation needs no mutation', async () => {
  const calls = [];
  assert.equal(
    await ensureNpm(async (args) => {
      calls.push(args);
      return { stdout: '12.2.0\n' };
    }),
    '12.2.0'
  );
  assert.deepEqual(calls, [['--version']]);
});

test('installation failures and unsuccessful version updates fail the release gate', async () => {
  await assert.rejects(
    ensureNpm(async (args) => {
      if (args[0] === 'install') throw new Error('registry unavailable');
      return { stdout: '11.4.2' };
    }),
    /registry unavailable/
  );
  await assert.rejects(
    ensureNpm(async () => ({ stdout: '11.4.2' })),
    /Expected npm 12.2.0/
  );
});
