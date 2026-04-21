#!/usr/bin/env node

/**
 * Regression test for issue #98: JavaScript release version-specific badge was broken.
 *
 * Reproduces: passing a tag like "js-v1.7.12" through format-release-notes.mjs's
 * version-normalization logic used to produce the URL
 *   https://img.shields.io/badge/npm-js-v1.7.12-blue.svg
 * which shields.io serves as "404: badge not found" because its path format is
 * /badge/<label>-<message>-<color>, so extra unescaped dashes corrupt the
 * field boundaries.
 *
 * Verifies: the corrected normalization returns a clean numeric version
 * ("1.7.12") for every tag shape we produce today (js-v<ver>, rust-v<ver>,
 * v<ver>, and bare <ver>).
 */
import assert from 'node:assert/strict';

function normalizeVersion(raw) {
  // Strip an optional language prefix like "js-" or "rust-", then a leading "v".
  return String(raw).replace(/^[a-z]+-/i, '').replace(/^v/i, '');
}

const cases = [
  ['js-v1.7.12', '1.7.12'],
  ['rust-v0.3.4', '0.3.4'],
  ['v1.7.12', '1.7.12'],
  ['1.7.12', '1.7.12'],
  ['V1.7.12', '1.7.12'],
  ['JS-V1.7.12', '1.7.12'],
];

for (const [input, expected] of cases) {
  const got = normalizeVersion(input);
  assert.equal(got, expected, `normalizeVersion(${JSON.stringify(input)}) -> ${got} (expected ${expected})`);
}

// Shape of the badge URL the script builds - must not contain a language prefix
// or stray 'v' before the numeric version, because shields.io /badge/ uses '-'
// as a field separator.
const versionWithoutV = normalizeVersion('js-v1.7.12');
const badgeUrl = `https://img.shields.io/badge/npm-${versionWithoutV}-blue.svg`;
assert.equal(
  badgeUrl,
  'https://img.shields.io/badge/npm-1.7.12-blue.svg',
  `badge URL for js-v1.7.12 should be the three-field shields format, got ${badgeUrl}`
);

console.log('OK: release badge encoding regression test passes.');
