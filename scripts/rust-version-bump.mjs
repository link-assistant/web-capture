#!/usr/bin/env node

/**
 * Bump Rust version in Cargo.toml and CHANGELOG.md
 * Usage: node scripts/rust-version-bump.mjs --bump-type <major|minor|patch> [--description <description>]
 *
 * Outputs:
 *   version: New version after bump
 *
 * Uses link-foundation libraries:
 * - use-m: Dynamic package loading without package.json dependencies
 * - command-stream: Modern shell command execution with streaming support
 * - lino-arguments: Unified configuration from CLI args, env vars, and .lenv files
 */

import { readFileSync, writeFileSync, appendFileSync } from 'fs';

// Load use-m dynamically
const { use } = eval(
  await (await fetch('https://unpkg.com/use-m/use.js')).text()
);

// Import link-foundation libraries
const { $ } = await use('command-stream');
const { makeConfig } = await use('lino-arguments');

// Parse CLI arguments using lino-arguments
const config = makeConfig({
  yargs: ({ yargs, getenv }) =>
    yargs
      .option('bump-type', {
        type: 'string',
        default: getenv('BUMP_TYPE', ''),
        describe: 'Version bump type: major, minor, or patch',
        choices: ['major', 'minor', 'patch'],
      })
      .option('description', {
        type: 'string',
        default: getenv('DESCRIPTION', ''),
        describe: 'Description for the version bump',
      }),
});

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

/**
 * Bump version based on type
 * @param {string} version - Current version (e.g., "1.2.3")
 * @param {string} bumpType - Bump type: major, minor, or patch
 * @returns {string} New version
 */
function bumpVersion(version, bumpType) {
  const [major, minor, patch] = version.split('.').map(Number);

  switch (bumpType) {
    case 'major':
      return `${major + 1}.0.0`;
    case 'minor':
      return `${major}.${minor + 1}.0`;
    case 'patch':
      return `${major}.${minor}.${patch + 1}`;
    default:
      throw new Error(`Invalid bump type: ${bumpType}`);
  }
}

try {
  const { bumpType, description } = config;
  const finalDescription = description || `Manual ${bumpType} release`;

  if (!bumpType || !['major', 'minor', 'patch'].includes(bumpType)) {
    console.error(
      'Usage: node scripts/rust-version-bump.mjs --bump-type <major|minor|patch> [--description <description>]'
    );
    process.exit(1);
  }

  console.log(`\nBumping version (${bumpType})...`);

  // Get current version
  const oldVersion = getCargoVersion();
  console.log(`Current version: ${oldVersion}`);

  // Calculate new version
  const newVersion = bumpVersion(oldVersion, bumpType);
  console.log(`New version: ${newVersion}`);

  // Update Cargo.toml
  console.log('\nUpdating Cargo.toml...');
  let cargoToml = readFileSync('./Cargo.toml', 'utf8');
  cargoToml = cargoToml.replace(
    /^version\s*=\s*"[^"]+"/m,
    `version = "${newVersion}"`
  );
  writeFileSync('./Cargo.toml', cargoToml, 'utf8');
  console.log('Cargo.toml updated');

  // Update CHANGELOG.md
  console.log('\nUpdating CHANGELOG.md...');
  const changelogPath = './CHANGELOG.md';
  let changelog = readFileSync(changelogPath, 'utf-8');

  // Create new changelog entry
  const newEntry = `## ${newVersion}

### ${bumpType.charAt(0).toUpperCase() + bumpType.slice(1)} Changes

- ${finalDescription}

`;

  // Insert new entry after the first heading (# Changelog or similar)
  // Look for the first ## heading and insert before it
  const firstVersionMatch = changelog.match(/^## /m);

  if (firstVersionMatch) {
    const insertPosition = firstVersionMatch.index;
    changelog =
      changelog.slice(0, insertPosition) +
      newEntry +
      changelog.slice(insertPosition);
  } else {
    // If no version headings exist, append after the main heading
    const mainHeadingMatch = changelog.match(/^# .+$/m);
    if (mainHeadingMatch) {
      const insertPosition =
        mainHeadingMatch.index + mainHeadingMatch[0].length;
      changelog = `${changelog.slice(0, insertPosition)}\n\n${newEntry}${changelog.slice(insertPosition)}`;
    } else {
      // If no headings at all, prepend
      changelog = `${newEntry}\n${changelog}`;
    }
  }

  writeFileSync(changelogPath, changelog, 'utf-8');
  console.log('CHANGELOG.md updated');

  // Set output
  setOutput('version', newVersion);

  console.log('\nVersion bump complete');
  console.log(`Version: ${oldVersion} -> ${newVersion}`);
} catch (error) {
  console.error('Error during version bump:', error.message);
  if (process.env.DEBUG) {
    console.error('Stack trace:', error.stack);
  }
  process.exit(1);
}
