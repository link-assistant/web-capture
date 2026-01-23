#!/usr/bin/env node

/**
 * Publish Rust crate to crates.io
 * Usage: node scripts/rust-publish-crate.mjs
 *
 * Environment variables:
 *   CARGO_REGISTRY_TOKEN: Token for crates.io authentication
 *
 * Outputs:
 *   published: true if publish succeeded
 *   published_version: The published version
 *
 * Uses link-foundation libraries:
 * - use-m: Dynamic package loading without package.json dependencies
 * - command-stream: Modern shell command execution with streaming support
 */

import { readFileSync, appendFileSync } from 'fs';

// Load use-m dynamically
const { use } = eval(
  await (await fetch('https://unpkg.com/use-m/use.js')).text()
);

// Import command-stream for shell command execution
const { $ } = await use('command-stream');

const MAX_RETRIES = 3;
const RETRY_DELAY = 10000; // 10 seconds

/**
 * Sleep for specified milliseconds
 * @param {number} ms
 */
function sleep(ms) {
  return new Promise((resolve) => globalThis.setTimeout(resolve, ms));
}

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
  // Get current version
  const currentVersion = getCargoVersion();
  console.log(`Current version to publish: ${currentVersion}`);

  // Check if CARGO_REGISTRY_TOKEN is set
  if (!process.env.CARGO_REGISTRY_TOKEN) {
    console.log('CARGO_REGISTRY_TOKEN not set, skipping publish');
    setOutput('published', 'false');
    setOutput('skipped', 'true');
    process.exit(0);
  }

  // Publish to crates.io with retry logic
  for (let i = 1; i <= MAX_RETRIES; i++) {
    console.log(`Publish attempt ${i} of ${MAX_RETRIES}...`);
    try {
      await $`cargo publish --allow-dirty`;
      setOutput('published', 'true');
      setOutput('published_version', currentVersion);
      console.log(`Published web-capture@${currentVersion} to crates.io`);
      process.exit(0);
    } catch (error) {
      // Check if the error is because it's already published
      if (
        error.message &&
        error.message.includes('already uploaded')
      ) {
        console.log(`Version ${currentVersion} is already published`);
        setOutput('published', 'true');
        setOutput('published_version', currentVersion);
        setOutput('already_published', 'true');
        process.exit(0);
      }

      if (i < MAX_RETRIES) {
        console.log(
          `Publish failed: ${error.message}, waiting ${RETRY_DELAY / 1000}s before retry...`
        );
        await sleep(RETRY_DELAY);
      }
    }
  }

  console.error(`Failed to publish after ${MAX_RETRIES} attempts`);
  process.exit(1);
} catch (error) {
  console.error('Error:', error.message);
  process.exit(1);
}
