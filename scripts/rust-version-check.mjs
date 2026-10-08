#!/usr/bin/env node

/**
 * Check if Rust version needs to be released
 * Usage: node scripts/rust-version-check.mjs
 *
 * Outputs:
 *   should_release: true if tag doesn't exist
 *   version: Current version from Cargo.toml
 *
 * Uses locked libraries:
 * - execa: Process execution with safe tagged argument interpolation
 */

import { readFileSync, appendFileSync } from 'fs';

// Import execa for shell command execution
import { $ } from 'execa';

/**
 * Append to GitHub Actions output file
 * @param {string} key
 * @param {string} value
 */
function setOutput(key, value) {
  const outputFile = process.env.GITHUB_OUTPUT;
  if (outputFile) {
    appendFileSync(outputFile, `${key}=${value}\n`);
  }
  console.log(`Output: ${key}=${value}`);
}

/**
 * Extract version from Cargo.toml
 */
function getCargoVersion() {
  const cargoToml = readFileSync('./Cargo.toml', 'utf8');
  const match = cargoToml.match(/^version\s*=\s*"([^"]+)"/m);
  if (!match) {
    throw new Error('Could not find version in Cargo.toml');
  }
  return match[1];
}

try {
  // Get current version from Cargo.toml
  const currentVersion = getCargoVersion();
  console.log(`Current version: ${currentVersion}`);

  // Check if tag exists using `git tag -l` which is more reliable than `git rev-parse`
  // (git rev-parse without --verify can give false positives for ambiguous arguments)
  const tagName = `rust-v${currentVersion}`;
  const tagResult = await $({ reject: false })`git tag -l ${tagName}`;
  const tagExists = tagResult.stdout.trim().length > 0;

  if (tagExists) {
    console.log(`Tag ${tagName} already exists`);
    setOutput('should_release', 'false');
  } else {
    console.log(`Tag ${tagName} does not exist, will release`);
    setOutput('should_release', 'true');
    setOutput('version', currentVersion);
  }
} catch (error) {
  console.error('Error checking version:', error.message);
  if (process.env.DEBUG) {
    console.error('Stack trace:', error.stack);
  }
  process.exit(1);
}
