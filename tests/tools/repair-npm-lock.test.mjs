import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  findMissingOptionalPlaceholders,
  repairLockText,
} from '../../scripts/repair-npm-lock.mjs';

// Shape of js/package-lock.json after npm 12 (or Dependabot) regenerated it:
// the unpublished musl binaries have no placeholder, so `npm ci` fails.
const parent = 'node_modules/@kreuzberg/html-to-markdown-node';
const brokenLock = {
  name: 'fixture',
  lockfileVersion: 3,
  packages: {
    '': { dependencies: { '@kreuzberg/html-to-markdown-node': '^3.7.2' } },
    [parent]: {
      version: '3.7.2',
      optionalDependencies: {
        '@kreuzberg/html-to-markdown-node-linux-x64-gnu': '3.7.2',
        '@kreuzberg/html-to-markdown-node-linux-x64-musl': '3.7.2',
      },
    },
    'node_modules/@kreuzberg/html-to-markdown-node-linux-x64-gnu': {
      version: '3.7.2',
      optional: true,
    },
    'node_modules/@manypkg/find-root': { version: '3.1.0' },
  },
};
const placeholder = `${parent}/node_modules/@kreuzberg/html-to-markdown-node-linux-x64-musl`;

test('unresolvable optional dependencies are reported at npm nested location', () => {
  assert.deepEqual(findMissingOptionalPlaceholders(brokenLock), [placeholder]);
});

test('hoisted and nested optional dependencies are resolvable', () => {
  const lock = structuredClone(brokenLock);
  lock.packages[placeholder] = { optional: true };
  assert.deepEqual(findMissingOptionalPlaceholders(lock), []);
  lock.packages[`${parent}/node_modules/nested`] = {
    optionalDependencies: {
      '@kreuzberg/html-to-markdown-node-linux-x64-gnu': '3.7.2',
    },
  };
  assert.deepEqual(findMissingOptionalPlaceholders(lock), []);
});

test('repair inserts placeholders in sorted position and is idempotent', () => {
  const { missing, text } = repairLockText(JSON.stringify(brokenLock));
  assert.deepEqual(missing, [placeholder]);
  const keys = Object.keys(JSON.parse(text).packages);
  assert.deepEqual(keys, [
    '',
    parent,
    'node_modules/@kreuzberg/html-to-markdown-node-linux-x64-gnu',
    placeholder,
    'node_modules/@manypkg/find-root',
  ]);
  assert.deepEqual(JSON.parse(text).packages[placeholder], { optional: true });
  assert.equal(repairLockText(text).text, text);
});
