import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  isAlreadyPublishedError,
  publishWithRetry,
  waitForVersionOnRegistry,
} from '../../scripts/publish-retry.mjs';

const staged =
  'npm error 409 Conflict - PUT https://registry.npmjs.org/@link-assistant%2fweb-capture - Cannot publish over previously staged version "2.0.0".';

// Simulated clock: npm makes the version visible `visibleAfter` ms after the
// accepted publish, like run 37750201175 (about four minutes).
function registry(visibleAfter) {
  let now = 0;
  let publishedAt = null;
  const calls = { publish: 0 };
  return {
    calls,
    sleepFn: async (ms) => {
      now += ms;
    },
    publish: async () => {
      calls.publish++;
      if (publishedAt !== null) {
        return { success: false, error: new Error('E409'), output: staged };
      }
      publishedAt = now;
      return {
        success: true,
        error: null,
        output: '+ @link-assistant/web-capture@2.0.0',
      };
    },
    verify: async () =>
      publishedAt !== null && now - publishedAt >= visibleAfter,
  };
}

test('a staged publish that becomes visible after 4 minutes succeeds without republishing', async () => {
  const npm = registry(4 * 60 * 1000);
  const result = await publishWithRetry(npm);
  assert.equal(result.success, true);
  assert.equal(npm.calls.publish, 1);
});

test('the old 12 x 5s verification window republished into E409', async () => {
  const npm = registry(4 * 60 * 1000);
  const result = await publishWithRetry({
    ...npm,
    verifyOptions: { attempts: 12, initialDelay: 5000, maxDelay: 5000 },
  });
  assert.equal(result.success, false);
  assert.match(result.error.message, /not republishing/);
  assert.equal(npm.calls.publish, 1);
});

test('an E409 previously staged error is verified instead of failing', async () => {
  let checks = 0;
  const result = await publishWithRetry({
    publish: async () => ({
      success: false,
      error: new Error('E409'),
      output: staged,
    }),
    verify: async () => ++checks === 3,
    sleepFn: async () => {},
  });
  assert.equal(result.success, true);
  assert.equal(result.publishAttempts, 1);
  assert.equal(isAlreadyPublishedError(staged), true);
});

test('real publish failures are retried, non-retryable ones stop', async () => {
  let attempts = 0;
  const retried = await publishWithRetry({
    publish: async () =>
      ++attempts < 2
        ? {
            success: false,
            error: new Error('ETIMEDOUT'),
            output: 'npm error code ETIMEDOUT',
          }
        : { success: true, error: null, output: '' },
    verify: async () => true,
    sleepFn: async () => {},
  });
  assert.equal(retried.success, true);
  assert.equal(retried.publishAttempts, 2);

  const fatal = Object.assign(new Error('E403'), { nonRetryable: true });
  const stopped = await publishWithRetry({
    publish: async () => ({
      success: false,
      error: fatal,
      output: 'npm error code E403',
    }),
    verify: async () => true,
    sleepFn: async () => {},
  });
  assert.deepEqual(
    [stopped.success, stopped.error, stopped.publishAttempts],
    [false, fatal, 1]
  );
});

test('verification backs off exponentially up to the cap', async () => {
  const delays = [];
  const found = await waitForVersionOnRegistry({
    verify: async () => false,
    attempts: 6,
    sleepFn: async (ms) => delays.push(ms),
  });
  assert.equal(found, false);
  assert.deepEqual(delays, [2000, 4000, 8000, 16000, 30000]);
});
