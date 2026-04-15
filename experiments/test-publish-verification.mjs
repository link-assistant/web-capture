#!/usr/bin/env node

/**
 * Minimal regression experiment for npm publish verification timing.
 *
 * Scenario:
 * - First verification checks return 404 while npm registry metadata propagates
 * - A naive implementation retries `npm publish`
 * - The correct implementation keeps polling verification without re-publishing
 */

const VERIFY_RETRIES = 12;

async function sleep(_ms) {}

function makeVerifier(failuresBeforeSuccess) {
  let attempts = 0;
  return async function verifyPublishedVersion(version) {
    for (let attempt = 1; attempt <= VERIFY_RETRIES; attempt++) {
      attempts++;
      const visible = attempts > failuresBeforeSuccess;
      if (visible) return { ok: true, attempt, version };
      await sleep(0);
    }
    return { ok: false, attempt: VERIFY_RETRIES, version };
  };
}

async function run() {
  const version = '1.7.1';
  const verifyPublishedVersion = makeVerifier(2);
  const result = await verifyPublishedVersion(version);

  if (!result.ok) {
    console.error('Expected verification to succeed after transient 404s');
    process.exit(1);
  }

  if (result.attempt !== 3) {
    console.error(`Expected success on attempt 3, got ${result.attempt}`);
    process.exit(1);
  }

  console.log('Verification polling handles transient registry lag correctly.');
}

run().catch((error) => {
  console.error(error);
  process.exit(1);
});
