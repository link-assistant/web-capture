#!/usr/bin/env node
// Install the registry-verified npm version locked with the release tooling.
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { readFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';

const execute = promisify(execFile);
const manifest = JSON.parse(
  readFileSync(new URL('../package.json', import.meta.url))
);
const expected = manifest.packageManager.split('@')[1];

export async function ensureNpm(run = (args) => execute('npm', args)) {
  const current = (await run(['--version'])).stdout.trim();
  if (current !== expected) {
    await run(['install', '--global', `npm@${expected}`]);
    const installed = (await run(['--version'])).stdout.trim();
    if (installed !== expected) {
      throw new Error(`Expected npm ${expected}, received ${installed}`);
    }
  }
  return expected;
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  console.log(`Release npm: ${await ensureNpm()}`);
}
