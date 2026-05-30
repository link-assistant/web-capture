#!/usr/bin/env node

/**
 * Publish Rust crate to crates.io
 * Usage: node scripts/rust-publish-crate.mjs
 *
 * Environment variables:
 *   CARGO_REGISTRY_TOKEN: Token for crates.io authentication (preferred)
 *   CARGO_TOKEN: Fallback token for backwards compatibility
 *
 * Outputs:
 *   published: true if publish succeeded
 *   published_version: The published version
 *   publish_result: success, already_exists, or failed
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

function sleep(ms) {
  return new Promise((resolve) => globalThis.setTimeout(resolve, ms));
}

function setOutput(key, value) {
  const outputFile = process.env.GITHUB_OUTPUT;
  if (outputFile) {
    appendFileSync(outputFile, `${key}=${value}\n`);
  }
  console.log(`Output: ${key}=${value}`);
}

function getCargoVersion() {
  const cargoToml = readFileSync('./Cargo.toml', 'utf8');
  const match = cargoToml.match(/^version\s*=\s*"([^"]+)"/m);
  if (!match) {
    throw new Error('Could not find version in Cargo.toml');
  }
  return match[1];
}

function getCrateName() {
  const cargoToml = readFileSync('./Cargo.toml', 'utf8');
  const match = cargoToml.match(/^name\s*=\s*"([^"]+)"/m);
  if (!match) {
    throw new Error('Could not find name in Cargo.toml');
  }
  return match[1];
}

async function checkCratesIo(crateName, version) {
  try {
    const response = await fetch(
      `https://crates.io/api/v1/crates/${crateName}/${version}`
    );
    if (response.ok) {
      return { exists: true };
    }
    return { exists: false };
  } catch {
    return { exists: false };
  }
}

try {
  const crateName = getCrateName();
  const currentVersion = getCargoVersion();
  console.log(`Crate: ${crateName}`);
  console.log(`Current version to publish: ${currentVersion}`);

  // Resolve token: CARGO_REGISTRY_TOKEN (cargo's native env var) > CARGO_TOKEN (backwards compat)
  const token =
    process.env.CARGO_REGISTRY_TOKEN || process.env.CARGO_TOKEN || '';

  if (!token) {
    console.error(
      '::error::Neither CARGO_REGISTRY_TOKEN nor CARGO_TOKEN is set.'
    );
    console.error(
      'Publishing requires a crates.io API token. Configure one of these secrets:'
    );
    console.error(
      '  - CARGO_REGISTRY_TOKEN (preferred, cargo\'s native env var)'
    );
    console.error('  - CARGO_TOKEN (backwards compatibility)');
    setOutput('published', 'false');
    setOutput('publish_result', 'failed');
    process.exit(1);
  }

  console.log(
    `Token source: ${process.env.CARGO_REGISTRY_TOKEN ? 'CARGO_REGISTRY_TOKEN' : 'CARGO_TOKEN'}`
  );

  // Pre-check crates.io to see if this version is already published
  console.log(`Checking crates.io for ${crateName}@${currentVersion}...`);
  const cratesCheck = await checkCratesIo(crateName, currentVersion);
  if (cratesCheck.exists) {
    console.log(
      `Version ${currentVersion} is already published on crates.io`
    );
    setOutput('published', 'true');
    setOutput('published_version', currentVersion);
    setOutput('publish_result', 'already_exists');
    setOutput('already_published', 'true');
    process.exit(0);
  }

  // Publish to crates.io with retry logic, passing token explicitly via --token
  for (let i = 1; i <= MAX_RETRIES; i++) {
    console.log(`Publish attempt ${i} of ${MAX_RETRIES}...`);
    try {
      await $`cargo publish --allow-dirty --token ${token}`;
      setOutput('published', 'true');
      setOutput('published_version', currentVersion);
      setOutput('publish_result', 'success');
      console.log(`Published ${crateName}@${currentVersion} to crates.io`);
      process.exit(0);
    } catch (error) {
      const msg = error.message || '';

      if (msg.includes('already uploaded') || msg.includes('already exists')) {
        console.log(`Version ${currentVersion} is already published`);
        setOutput('published', 'true');
        setOutput('published_version', currentVersion);
        setOutput('publish_result', 'already_exists');
        setOutput('already_published', 'true');
        process.exit(0);
      }

      if (
        msg.includes('non-empty token') ||
        msg.includes('unauthorized') ||
        msg.includes('authentication')
      ) {
        console.error('::error::AUTHENTICATION FAILURE');
        console.error(
          'The provided token was rejected by crates.io. Verify:'
        );
        console.error(
          '  1. The token is valid and not expired'
        );
        console.error(
          '  2. The token has publish scope for this crate'
        );
        console.error(
          '  3. The correct secret (CARGO_REGISTRY_TOKEN or CARGO_TOKEN) is configured'
        );
        setOutput('published', 'false');
        setOutput('publish_result', 'failed');
        process.exit(1);
      }

      if (i < MAX_RETRIES) {
        console.log(
          `Publish failed: ${msg}, waiting ${RETRY_DELAY / 1000}s before retry...`
        );
        await sleep(RETRY_DELAY);
      }
    }
  }

  console.error(`Failed to publish after ${MAX_RETRIES} attempts`);
  setOutput('published', 'false');
  setOutput('publish_result', 'failed');
  process.exit(1);
} catch (error) {
  console.error('Error:', error.message);
  process.exit(1);
}
