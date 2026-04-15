#!/usr/bin/env node

/**
 * Check if a JavaScript/npm release is needed
 *
 * This script checks npm (the source of truth for JS packages),
 * NOT just the presence of changeset files. This is critical because:
 * - Changesets can be consumed without publishing (partial failures)
 * - PRs can merge without changesets, leaving fixes unreleased
 * - Only npm publication means users can actually install the package
 *
 * Logic:
 * 1. If there are pending changesets, signal release needed (normal flow)
 * 2. If no changesets but current version isn't on npm, signal release needed
 * 3. If no changesets and version is on npm, check for unreleased publishable
 *    commits since the last release tag — if found, signal auto-bump needed
 *
 * Usage: node scripts/check-release-needed.mjs
 *
 * Outputs (written to GITHUB_OUTPUT):
 *   has_changesets: 'true' if pending changeset files exist
 *   changeset_count: number of changeset files
 *   should_release: 'true' if a release should be created
 *   needs_auto_bump: 'true' if version needs auto-bumping
 *   version: current version from package.json
 *
 * Uses link-foundation libraries:
 * - use-m: Dynamic package loading without package.json dependencies
 * - command-stream: Modern shell command execution with streaming support
 */

import { readFileSync, readdirSync, existsSync, appendFileSync } from 'fs';
import {
  getJsRoot,
  getPackageJsonPath,
  getChangesetDir,
  parseJsRootConfig,
} from './js-paths.mjs';

// Load use-m dynamically
const { use } = eval(
  await (await fetch('https://unpkg.com/use-m/use.js')).text()
);

const { $ } = await use('command-stream');

const jsRootConfig = parseJsRootConfig();
const jsRoot = getJsRoot({ jsRoot: jsRootConfig, verbose: true });

const JS_PUBLISHABLE_PATHS = [
  'js/src/',
  'js/bin/',
  'js/package.json',
  'js/package-lock.json',
];

function setOutput(key, value) {
  const outputFile = process.env.GITHUB_OUTPUT;
  if (outputFile) {
    appendFileSync(outputFile, `${key}=${value}\n`);
  }
  console.log(`Output: ${key}=${value}`);
}

function getPackageVersion() {
  const packageJsonPath = getPackageJsonPath({ jsRoot });
  const pkg = JSON.parse(readFileSync(packageJsonPath, 'utf8'));
  return pkg.version;
}

function getPackageName() {
  const packageJsonPath = getPackageJsonPath({ jsRoot });
  const pkg = JSON.parse(readFileSync(packageJsonPath, 'utf8'));
  return pkg.name;
}

function countChangesets() {
  const changesetDir = getChangesetDir({ jsRoot });
  if (!existsSync(changesetDir)) return 0;

  const files = readdirSync(changesetDir);
  return files.filter((f) => f.endsWith('.md') && f !== 'README.md').length;
}

async function checkNpmRegistry(packageName, version) {
  try {
    const result = await $`npm view "${packageName}@${version}" version`.run({ capture: true });
    return result.stdout.trim() === version;
  } catch {
    return false;
  }
}

async function getLatestReleaseTag() {
  try {
    const result = await $`git tag -l "v*" --sort=-version:refname`.run({ capture: true });
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
      JS_PUBLISHABLE_PATHS.some((path) => file.startsWith(path))
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
  const packageName = getPackageName();
  const currentVersion = getPackageVersion();
  console.log(`Package: ${packageName}`);
  console.log(`Current version in package.json: ${currentVersion}`);

  setOutput('version', currentVersion);

  // Check for changesets
  const changesetCount = countChangesets();
  console.log(`Found ${changesetCount} changeset file(s)`);
  setOutput('has_changesets', changesetCount > 0 ? 'true' : 'false');
  setOutput('changeset_count', String(changesetCount));

  if (changesetCount > 0) {
    console.log('Changesets found — normal release flow');
    setOutput('should_release', 'true');
    setOutput('needs_auto_bump', 'false');
    process.exit(0);
  }

  // No changesets — check npm
  console.log('No changesets found, checking npm registry...');
  const isPublished = await checkNpmRegistry(packageName, currentVersion);
  console.log(`Version ${currentVersion} published on npm: ${isPublished}`);

  if (!isPublished) {
    console.log(`Version ${currentVersion} is NOT on npm — should release`);
    setOutput('should_release', 'true');
    setOutput('needs_auto_bump', 'false');
    process.exit(0);
  }

  // Version is on npm — check for unreleased commits
  console.log(`Version ${currentVersion} is already on npm`);
  const latestTag = await getLatestReleaseTag();
  console.log(`Latest JS release tag: ${latestTag || '(none)'}`);

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
