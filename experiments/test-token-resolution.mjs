#!/usr/bin/env node

/**
 * Test token resolution logic from rust-publish-crate.mjs
 * Verifies the fallback chain: CARGO_REGISTRY_TOKEN > CARGO_TOKEN > error
 *
 * Usage: node experiments/test-token-resolution.mjs
 */

function resolveToken(env) {
  return env.CARGO_REGISTRY_TOKEN || env.CARGO_TOKEN || '';
}

function getTokenSource(env) {
  if (env.CARGO_REGISTRY_TOKEN) return 'CARGO_REGISTRY_TOKEN';
  if (env.CARGO_TOKEN) return 'CARGO_TOKEN';
  return 'none';
}

const tests = [
  {
    name: 'Both tokens set — prefers CARGO_REGISTRY_TOKEN',
    env: { CARGO_REGISTRY_TOKEN: 'registry-tok', CARGO_TOKEN: 'cargo-tok' },
    expectedToken: 'registry-tok',
    expectedSource: 'CARGO_REGISTRY_TOKEN',
  },
  {
    name: 'Only CARGO_REGISTRY_TOKEN set',
    env: { CARGO_REGISTRY_TOKEN: 'registry-tok', CARGO_TOKEN: '' },
    expectedToken: 'registry-tok',
    expectedSource: 'CARGO_REGISTRY_TOKEN',
  },
  {
    name: 'Only CARGO_TOKEN set — fallback works',
    env: { CARGO_REGISTRY_TOKEN: '', CARGO_TOKEN: 'cargo-tok' },
    expectedToken: 'cargo-tok',
    expectedSource: 'CARGO_TOKEN',
  },
  {
    name: 'Neither token set — should fail',
    env: { CARGO_REGISTRY_TOKEN: '', CARGO_TOKEN: '' },
    expectedToken: '',
    expectedSource: 'none',
  },
  {
    name: 'CARGO_REGISTRY_TOKEN undefined, CARGO_TOKEN set',
    env: { CARGO_TOKEN: 'cargo-tok' },
    expectedToken: 'cargo-tok',
    expectedSource: 'CARGO_TOKEN',
  },
];

let passed = 0;
let failed = 0;

for (const test of tests) {
  const token = resolveToken(test.env);
  const source = getTokenSource(test.env);
  const tokenOk = token === test.expectedToken;
  const sourceOk = source === test.expectedSource;

  if (tokenOk && sourceOk) {
    console.log(`✅ PASS: ${test.name}`);
    passed++;
  } else {
    console.log(`❌ FAIL: ${test.name}`);
    if (!tokenOk)
      console.log(`   token: got "${token}", expected "${test.expectedToken}"`);
    if (!sourceOk)
      console.log(
        `   source: got "${source}", expected "${test.expectedSource}"`
      );
    failed++;
  }
}

console.log(`\n${passed} passed, ${failed} failed, ${tests.length} total`);
process.exit(failed > 0 ? 1 : 0);
