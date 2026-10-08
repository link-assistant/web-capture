#!/usr/bin/env node

/**
 * Custom changeset version script that ensures package-lock.json is synchronized
 * with package.json after version bumps.
 *
 * This script:
 * 1. Runs `changeset version` to update package versions
 * 2. Uses `npm version` to synchronize release metadata without re-resolving dependencies
 *
 * Uses locked libraries:
 * - execa: Process execution with safe tagged argument interpolation
 */

// Import execa for shell command execution
import { $ } from 'execa';
import { readFileSync } from 'node:fs';

try {
  console.log('Running changeset version...');
  await $`npx changeset version`;

  console.log('\nSynchronizing package-lock.json...');
  const version = JSON.parse(readFileSync('package.json', 'utf8')).version;
  await $`npm version ${version} --allow-same-version --no-git-tag-version`;

  console.log('\n✅ Version bump complete with synchronized package-lock.json');
} catch (error) {
  console.error('Error during version bump:', error.message);
  if (process.env.DEBUG) {
    console.error('Stack trace:', error.stack);
  }
  process.exit(1);
}
