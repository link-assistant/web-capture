#!/usr/bin/env node

/**
 * Create GitHub Release for Rust version
 * Usage: node scripts/rust-create-github-release.mjs --release-version <version> --repository <repository> [--description <description>] [--commit-sha <sha>]
 *   release-version: Version number (e.g., 1.0.0)
 *   repository: GitHub repository (e.g., owner/repo)
 *   description: Optional release description
 *   commit-sha: Optional commit SHA to target
 *
 * Uses locked libraries:
 * - execa: Process execution with safe tagged argument interpolation
 * - lino-arguments: Unified configuration from CLI args, env vars, and .lenv files
 */

import { readFileSync } from 'fs';

// Import locked release tooling
import { $ } from 'execa';
import { makeConfig } from 'lino-arguments';

const CRATE_NAME = 'web-capture';

// Parse CLI arguments using lino-arguments
// Note: Using --release-version instead of --version to avoid conflict with yargs' built-in --version flag
const config = makeConfig({
  yargs: ({ yargs, getenv }) =>
    yargs
      .option('release-version', {
        type: 'string',
        default: getenv('VERSION', ''),
        describe: 'Version number (e.g., 1.0.0)',
      })
      .option('repository', {
        type: 'string',
        default: getenv('REPOSITORY', ''),
        describe: 'GitHub repository (e.g., owner/repo)',
      })
      .option('description', {
        type: 'string',
        default: getenv('DESCRIPTION', ''),
        describe: 'Release description',
      })
      .option('commit-sha', {
        type: 'string',
        default: getenv('COMMIT_SHA', ''),
        describe: 'Commit SHA to target',
      }),
});

const { releaseVersion: version, repository, description, commitSha } = config;

if (!version || !repository) {
  console.error('Error: Missing required arguments');
  console.error(
    'Usage: node scripts/rust-create-github-release.mjs --release-version <version> --repository <repository> [--description <description>]'
  );
  process.exit(1);
}

const tag = `rust-v${version}`;

console.log(`Creating GitHub release for ${tag}...`);

try {
  // Try to read CHANGELOG.md for release notes
  let releaseNotes = '';
  try {
    const changelog = readFileSync('./CHANGELOG.md', 'utf8');

    // Extract changelog entry for this version
    // Read from CHANGELOG.md between this version header and the next version header
    const versionHeaderRegex = new RegExp(
      `## ${version}[\\s\\S]*?(?=## \\d|$)`
    );
    const match = changelog.match(versionHeaderRegex);

    if (match) {
      // Remove the version header itself and trim
      releaseNotes = match[0].replace(`## ${version}`, '').trim();
    }
  } catch {
    // CHANGELOG.md might not exist or be readable
    console.log('Could not read CHANGELOG.md, using description or default');
  }

  // Use description if provided, otherwise use changelog or default
  if (!releaseNotes) {
    releaseNotes = description || `Rust web-capture version ${version}`;
  }

  // Add crates.io badge
  const cratesBadge = `[![Crates.io](https://img.shields.io/badge/crates.io-${version}-orange.svg)](https://crates.io/crates/${CRATE_NAME}/versions)`;
  releaseNotes = `${releaseNotes}\n\n---\n\n${cratesBadge}`;

  // Create release using GitHub API with JSON input
  // This avoids shell escaping issues
  const payload = {
    tag_name: tag,
    name: `[Rust] v${version}`,
    body: releaseNotes,
  };

  if (commitSha) {
    payload.target_commitish = commitSha;
  }

  await $({
    input: JSON.stringify(payload),
  })`gh api repos/${repository}/releases -X POST --input -`;

  console.log(`Created GitHub release: ${tag}`);
} catch (error) {
  console.error('Error creating release:', error.message);
  process.exit(1);
}
