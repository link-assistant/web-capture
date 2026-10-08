#!/usr/bin/env node

/**
 * Version Rust package and commit to main
 * Usage: node scripts/rust-version-and-commit.mjs --bump-type <major|minor|patch> [--description <desc>]
 *
 * Uses locked libraries:
 * - execa: Process execution with safe tagged argument interpolation
 * - lino-arguments: Unified configuration from CLI args, env vars, and .lenv files
 */

import { readFileSync, appendFileSync } from 'fs';

// Import locked release tooling
import { $ } from 'execa';
import { makeConfig } from 'lino-arguments';

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
        describe: 'Description for version bump',
      }),
});

const { bumpType, description } = config;

// Debug: Log parsed configuration
console.log('Parsed configuration:', {
  bumpType,
  description: description || '(none)',
});

// Validation: Ensure bump type is provided
if (!bumpType || !['major', 'minor', 'patch'].includes(bumpType)) {
  console.error('Error: --bump-type is required');
  console.error(
    'Usage: node scripts/rust-version-and-commit.mjs --bump-type <major|minor|patch> [--description <desc>]'
  );
  process.exit(1);
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
 * Get Cargo.toml version
 */
function getVersion() {
  const cargoToml = readFileSync('./Cargo.toml', 'utf8');
  const match = cargoToml.match(/^version\s*=\s*"([^"]+)"/m);
  if (!match) {
    throw new Error('Could not find version in Cargo.toml');
  }
  return match[1];
}

async function main() {
  try {
    // Configure git
    await $`git config user.name github-actions[bot]`;
    await $`git config user.email github-actions[bot]@users.noreply.github.com`;

    // Get current version before bump
    const oldVersion = getVersion();
    console.log(`Current version: ${oldVersion}`);

    // Run version bump script
    console.log('Running version bump...');
    if (description) {
      await $`node ../scripts/rust-version-bump.mjs --bump-type ${bumpType} --description ${description}`;
    } else {
      await $`node ../scripts/rust-version-bump.mjs --bump-type ${bumpType}`;
    }

    // Get new version after bump
    const newVersion = getVersion();
    console.log(`New version: ${newVersion}`);
    setOutput('version', newVersion);

    // Check if there are changes to commit
    const statusResult = await $({ reject: false })`git status --porcelain`;
    const status = statusResult.stdout.trim();

    if (status) {
      console.log('Changes detected, committing...');

      // Stage all changes (Cargo.toml, CHANGELOG.md)
      await $`git add -A`;

      // Commit with version number as message
      const commitMessage = `chore(rust): bump version to ${newVersion}`;
      await $`git commit -m ${commitMessage}`;

      // Push to main with fetch+rebase+retry to tolerate concurrent release
      // workflows (e.g. JS release) racing to push to main.
      // See docs/case-studies/issue-94.
      await $`node ../scripts/safe-git-push.mjs --branch main`;

      console.log('Version bump committed and pushed to main');
      setOutput('version_committed', 'true');
    } else {
      console.log('No changes to commit');
      setOutput('version_committed', 'false');
    }
  } catch (error) {
    console.error('Error:', error.message);
    process.exit(1);
  }
}

main();
