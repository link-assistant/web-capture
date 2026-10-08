/**
 * Publish orchestration that keeps two failure domains apart (ported from
 * link-foundation/js-ai-driven-development-pipeline-template
 * scripts/publish-retry.mjs):
 *
 * - `npm publish` itself failing: retryable, publish again;
 * - the published version not being visible yet: npm stages new versions and
 *   exposes them minutes later, so the only correct response is to keep
 *   polling. Republishing fails with E409 "Cannot publish over previously
 *   staged version" and turns a successful release into a failed job (see
 *   dev/log/issues/177/pulls/178/ANALYSIS.md).
 */

// 34 checks with the backoff below span about 15.5 minutes. The 1.12.0 and
// 2.0.0 releases became visible about 4 minutes after `npm publish` exited 0.
export const DEFAULT_VERIFY_ATTEMPTS = 34;
export const DEFAULT_VERIFY_INITIAL_DELAY = 2000;
export const DEFAULT_VERIFY_MAX_DELAY = 30000;

export function sleep(ms) {
  return new Promise((resolve) => globalThis.setTimeout(resolve, ms));
}

// A match only decides whether to poll the registry; the poll is the proof.
const ALREADY_PUBLISHED_PATTERNS = [
  'epublishconflict',
  'cannot publish over the previously published version',
  'cannot publish over previously published version',
  'previously staged version',
  'already published',
];

export function isAlreadyPublishedError(output) {
  const lower = String(output || '').toLowerCase();
  return ALREADY_PUBLISHED_PATTERNS.some((pattern) => lower.includes(pattern));
}

/**
 * Poll `verify` with exponential backoff until it returns true.
 * @returns {Promise<boolean>}
 */
export async function waitForVersionOnRegistry({
  verify,
  attempts = DEFAULT_VERIFY_ATTEMPTS,
  initialDelay = DEFAULT_VERIFY_INITIAL_DELAY,
  maxDelay = DEFAULT_VERIFY_MAX_DELAY,
  sleepFn = sleep,
  log = () => {},
}) {
  let delay = initialDelay;
  let lastError = null;
  for (let attempt = 1; attempt <= attempts; attempt++) {
    log(`Verifying publish (attempt ${attempt} of ${attempts})...`);
    let found = false;
    try {
      found = await verify();
      lastError = null;
    } catch (error) {
      lastError = error;
      log(`Verification attempt ${attempt} errored: ${error.message}`);
    }
    if (found) {
      return true;
    }
    if (attempt < attempts) {
      log(`Version not visible on npm yet, checking again in ${delay / 1000}s`);
      await sleepFn(delay);
      delay = Math.min(delay * 2, maxDelay);
    }
  }
  if (lastError) {
    throw new Error(
      `Registry verification ended in an unknown state: ${lastError.message}`,
      { cause: lastError }
    );
  }
  return false;
}

/**
 * Run `publish` with retries, then verify with bounded polling. Once a publish
 * succeeds (or reports the version as already published/staged) the flow
 * never re-enters the publish path.
 *
 * @param {object} options
 * @param {Function} options.publish - async () => ({ success, error, output })
 * @param {Function} options.verify - async () => boolean
 * @returns {Promise<{success: boolean, error: Error|null, publishAttempts: number}>}
 */
export async function publishWithRetry({
  publish,
  verify,
  maxRetries = 3,
  retryDelay = 10000,
  sleepFn = sleep,
  log = () => {},
  verifyOptions = {},
}) {
  let lastError = null;
  let publishAttempts = 0;
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    publishAttempts = attempt;
    log(`Publish attempt ${attempt} of ${maxRetries}...`);
    const { success, error, output } = await publish();
    const alreadyPublished =
      !success && isAlreadyPublishedError(output || error?.message);
    if (success || alreadyPublished) {
      if (alreadyPublished) {
        log('npm reports the version as already published or staged.');
      }
      const verified = await waitForVersionOnRegistry({
        verify,
        sleepFn,
        log,
        ...verifyOptions,
      });
      if (verified) {
        return { success: true, error: null, publishAttempts };
      }
      return {
        success: false,
        error: new Error(
          'npm accepted the publish but the version never became visible; not republishing'
        ),
        publishAttempts,
      };
    }
    lastError = error;
    if (error?.nonRetryable) {
      break;
    }
    if (attempt < maxRetries) {
      log(
        `Publish failed: ${error?.message}, waiting ${retryDelay / 1000}s before retry...`
      );
      await sleepFn(retryDelay);
    }
  }
  return {
    success: false,
    error:
      lastError || new Error(`Failed to publish after ${maxRetries} attempts`),
    publishAttempts,
  };
}
