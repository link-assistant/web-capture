#!/usr/bin/env node
// Restore npm's placeholders for optional dependencies that cannot be resolved.
//
// npm 12 drops `{ "optional": true }` placeholders when it writes a lock for an
// optional dependency whose requested version was never published (for example
// @kreuzberg/html-to-markdown-node@3.7.2 requests the unpublished
// html-to-markdown-node-linux-*-musl@3.7.2), but `npm ci` still requires them:
//
//   npm error Missing: @kreuzberg/html-to-markdown-node-linux-x64-musl@ from lock file
//
// Any lock regeneration (a Dependabot update, `npm install`) therefore produces
// a lock that the same npm refuses to install. See
// dev/log/issues/177/pulls/178/ANALYSIS.md.
//
// Usage:
//   node scripts/repair-npm-lock.mjs [--check] [lockfile...]
// Default lockfile: js/package-lock.json. Set DEBUG_NPM_LOCK=1 for tracing.
import { readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const debug = (...args) => {
  if (process.env.DEBUG_NPM_LOCK) {
    console.error('[repair-npm-lock]', ...args);
  }
};

// Node module resolution over lock locations: walk from the dependent's
// directory up to the project root.
function resolveInLock(packages, from, name) {
  let dir = from;
  for (;;) {
    const candidate = `${dir ? `${dir}/` : ''}node_modules/${name}`;
    if (candidate in packages) {
      return candidate;
    }
    if (!dir) {
      return null;
    }
    const index = dir.lastIndexOf('/node_modules/');
    dir = index === -1 ? '' : dir.slice(0, index);
  }
}

export function findMissingOptionalPlaceholders(lock) {
  const packages = lock.packages || {};
  const missing = [];
  for (const [location, entry] of Object.entries(packages)) {
    for (const name of Object.keys(entry.optionalDependencies || {})) {
      const resolved = resolveInLock(packages, location, name);
      debug(`${location || '(root)'} -> ${name}: ${resolved ?? 'missing'}`);
      if (!resolved) {
        missing.push(`${location ? `${location}/` : ''}node_modules/${name}`);
      }
    }
  }
  return [...new Set(missing)].sort((a, b) => a.localeCompare(b, 'en'));
}

// Insert placeholders in npm's sorted position so the diff stays minimal.
export function addOptionalPlaceholders(lock, locations) {
  const pending = [...locations];
  const packages = {};
  for (const [location, entry] of Object.entries(lock.packages)) {
    while (
      location !== '' &&
      pending.length &&
      pending[0].localeCompare(location, 'en') < 0
    ) {
      packages[pending.shift()] = { optional: true };
    }
    packages[location] = entry;
  }
  for (const location of pending) {
    packages[location] = { optional: true };
  }
  return { ...lock, packages };
}

export function repairLockText(text) {
  const lock = JSON.parse(text);
  const missing = findMissingOptionalPlaceholders(lock);
  if (!missing.length) {
    return { missing, text };
  }
  const repaired = addOptionalPlaceholders(lock, missing);
  return { missing, text: `${JSON.stringify(repaired, null, 2)}\n` };
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  const args = process.argv.slice(2);
  const check = args.includes('--check');
  const files = args.filter((arg) => arg !== '--check');
  if (!files.length) {
    files.push(path.join(root, 'js/package-lock.json'));
  }
  let failed = false;
  for (const file of files) {
    const { missing, text } = repairLockText(readFileSync(file, 'utf8'));
    if (!missing.length) {
      console.log(`${file}: every optional dependency is resolvable.`);
      continue;
    }
    if (check) {
      failed = true;
      console.error(
        `::error file=${path.relative(root, file)}::Missing optional placeholders that \`npm ci\` requires:\n  ${missing.join('\n  ')}\nRun: node scripts/repair-npm-lock.mjs ${path.relative(process.cwd(), file)}`
      );
    } else {
      writeFileSync(file, text);
      console.log(`${file}: restored ${missing.join(', ')}`);
    }
  }
  if (failed) {
    process.exitCode = 1;
  }
}
