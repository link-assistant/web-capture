#!/usr/bin/env node

/**
 * Check if a Rust release is needed by comparing against crates.io
 *
 * This script checks crates.io (the source of truth for Rust packages),
 * NOT git tags. This is critical because:
 * - Git tags can exist without the package being published
 * - GitHub releases create tags but don't publish to crates.io
 * - Only crates.io publication means users can actually install the package
 *
 * Additionally, this script detects unreleased commits on main by comparing
 * HEAD against the latest release tag. If publishable paths changed since the
 * last release, it signals that an auto-bump is needed.
 *
 * Usage: node scripts/rust-check-release-needed.mjs
 *
 * Outputs (written to GITHUB_OUTPUT):
 *   should_release: 'true' if a release should be created
 *   needs_auto_bump: 'true' if version needs auto-bumping (no manual bump present)
 *   version: current version from Cargo.toml
 *   max_published_version: highest non-yanked version on crates.io
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

const { $ } = await use('command-stream');

const RUST_PUBLISHABLE_PATHS = [
  'rust/src/',
  'rust/Cargo.toml',
  'rust/Cargo.lock',
  'rust/build.rs',
];

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
      `https://crates.io/api/v1/crates/${crateName}/${version}`,
      { headers: { 'User-Agent': 'web-capture-ci-release-check' } }
    );
    if (response.ok) {
      const data = await response.json();
      return data.version != null;
    }
    return false;
  } catch {
    console.warn('Warning: Could not check crates.io, assuming not published');
    return false;
  }
}

async function getMaxPublishedVersion(crateName) {
  try {
    const response = await fetch(
      `https://crates.io/api/v1/crates/${crateName}`,
      { headers: { 'User-Agent': 'web-capture-ci-release-check' } }
    );
    if (!response.ok) return null;
    const data = await response.json();
    if (!data.versions || data.versions.length === 0) return null;

    let maxVersion = null;
    let maxParts = [0, 0, 0];

    for (const v of data.versions) {
      if (v.yanked) continue;
      const parts = v.num.split('.').map(Number);
      if (parts.length !== 3) continue;
      if (
        parts[0] > maxParts[0] ||
        (parts[0] === maxParts[0] && parts[1] > maxParts[1]) ||
        (parts[0] === maxParts[0] && parts[1] === maxParts[1] && parts[2] > maxParts[2])
      ) {
        maxParts = parts;
        maxVersion = v.num;
      }
    }
    return maxVersion;
  } catch {
    return null;
  }
}

async function getLatestReleaseTag() {
  try {
    const result = await $`git tag -l "rust-v*" --sort=-version:refname`.run({ capture: true });
    const tags = result.stdout.trim().split('\n').filter(Boolean);
    return tags.length > 0 ? tags[0] : null;
  } catch {
    return null;
  }
}

async function hasPublishableChangesSinceTag(tag) {
  try {
    const result = await $`git diff --name-only ${tag}..HEAD`.run({ capture: true });
    const changedFiles = result.stdout.trim().split('\n').filter(Boolean);

    const publishableChanges = changedFiles.filter((file) =>
      RUST_PUBLISHABLE_PATHS.some((path) => file.startsWith(path))
    );

    if (publishableChanges.length > 0) {
      console.log(`Publishable changes since ${tag}:`);
      publishableChanges.forEach((f) => console.log(`  ${f}`));
    }

    return publishableChanges.length > 0;
  } catch {
    return false;
  }
}

try {
  const crateName = getCrateName();
  const currentVersion = getCargoVersion();
  console.log(`Crate: ${crateName}`);
  console.log(`Current version in Cargo.toml: ${currentVersion}`);

  setOutput('version', currentVersion);

  // Check max published version on crates.io
  const maxPublished = await getMaxPublishedVersion(crateName);
  if (maxPublished) {
    console.log(`Max published version on crates.io: ${maxPublished}`);
    setOutput('max_published_version', maxPublished);
  } else {
    console.log('No versions published on crates.io yet (or crate not found)');
    setOutput('max_published_version', '');
  }

  // Check if current version is already published
  const isPublished = await checkCratesIo(crateName, currentVersion);
  console.log(`Version ${currentVersion} published on crates.io: ${isPublished}`);

  if (!isPublished) {
    // Current version not on crates.io — release it (no bump needed)
    console.log(`Version ${currentVersion} is NOT on crates.io — should release`);
    setOutput('should_release', 'true');
    setOutput('needs_auto_bump', 'false');
    process.exit(0);
  }

  // Current version IS on crates.io — check for unreleased commits
  console.log(`Version ${currentVersion} is already on crates.io`);
  const latestTag = await getLatestReleaseTag();
  console.log(`Latest release tag: ${latestTag || '(none)'}`);

  if (!latestTag) {
    console.log('No release tags found — nothing to compare against');
    setOutput('should_release', 'false');
    setOutput('needs_auto_bump', 'false');
    process.exit(0);
  }

  const hasChanges = await hasPublishableChangesSinceTag(latestTag);

  if (hasChanges) {
    console.log(`Found unreleased publishable changes since ${latestTag}`);
    console.log('Auto-bump needed to release accumulated changes');
    setOutput('should_release', 'true');
    setOutput('needs_auto_bump', 'true');
  } else {
    console.log(`No publishable changes since ${latestTag} — no release needed`);
    setOutput('should_release', 'false');
    setOutput('needs_auto_bump', 'false');
  }
} catch (error) {
  console.error('Error checking release needed:', error.message);
  if (process.env.DEBUG) {
    console.error('Stack trace:', error.stack);
  }
  process.exit(1);
}
