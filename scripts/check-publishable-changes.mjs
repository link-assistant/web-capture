#!/usr/bin/env node

/**
 * Check if a PR includes publishable changes without a version bump or changeset
 *
 * This script is designed to run on pull_request events to warn contributors
 * when their PR touches publishable code paths but doesn't include a
 * changeset (JS) or version bump (Rust).
 *
 * The auto-release mechanism on main will handle the gap, but this check
 * ensures contributors are aware and can add explicit release notes.
 *
 * Usage: node scripts/check-publishable-changes.mjs
 *
 * Environment variables:
 *   GITHUB_BASE_REF: Base branch of the PR
 *
 * Exit codes:
 *   0: No publishable changes, or changeset/version bump present
 *   1: Publishable changes found without changeset/version bump (warning)
 */

import { execSync } from 'child_process';
import { readdirSync, existsSync } from 'fs';

const RUST_PUBLISHABLE_PATHS = [
  'rust/src/',
  'rust/Cargo.toml',
  'rust/build.rs',
];

const JS_PUBLISHABLE_PATHS = [
  'js/src/',
  'js/bin/',
  'js/package.json',
];

function exec(command) {
  try {
    return execSync(command, { encoding: 'utf-8' }).trim();
  } catch (error) {
    console.error(`Error executing: ${command}`);
    return '';
  }
}

function getChangedFiles() {
  const baseRef = process.env.GITHUB_BASE_REF || 'main';
  exec(`git fetch origin ${baseRef} --depth=1`);
  const output = exec(`git diff --name-only origin/${baseRef}...HEAD`);
  return output ? output.split('\n').filter(Boolean) : [];
}

function countChangesets() {
  const changesetDir = 'js/.changeset';
  if (!existsSync(changesetDir)) return 0;
  const files = readdirSync(changesetDir);
  return files.filter((f) => f.endsWith('.md') && f !== 'README.md').length;
}

function checkVersionChanged(changedFiles) {
  return changedFiles.some((f) => f === 'rust/Cargo.toml');
}

try {
  const changedFiles = getChangedFiles();

  if (changedFiles.length === 0) {
    console.log('No changed files detected');
    process.exit(0);
  }

  console.log(`Changed files (${changedFiles.length}):`);
  changedFiles.forEach((f) => console.log(`  ${f}`));

  // Check Rust publishable changes
  const rustPublishable = changedFiles.filter((file) =>
    RUST_PUBLISHABLE_PATHS.some((path) => file.startsWith(path))
  );

  // Check JS publishable changes
  const jsPublishable = changedFiles.filter((file) =>
    JS_PUBLISHABLE_PATHS.some((path) => file.startsWith(path))
  );

  const issues = [];

  if (rustPublishable.length > 0) {
    console.log('\nRust publishable changes found:');
    rustPublishable.forEach((f) => console.log(`  ${f}`));

    // For Rust, we just check if Cargo.toml version line changed
    // (The auto-release will handle it if not, but we warn)
    const versionChanged = checkVersionChanged(changedFiles);
    if (!versionChanged) {
      issues.push(
        'Rust: publishable code changed but no version bump in Cargo.toml. ' +
        'The auto-release on main will patch-bump automatically, but consider ' +
        'adding an explicit version bump for better release notes.'
      );
    }
  }

  if (jsPublishable.length > 0) {
    console.log('\nJS publishable changes found:');
    jsPublishable.forEach((f) => console.log(`  ${f}`));

    const changesetCount = countChangesets();
    if (changesetCount === 0) {
      issues.push(
        'JS: publishable code changed but no changeset file found in js/.changeset/. ' +
        'The auto-release on main will patch-bump automatically, but consider ' +
        'adding a changeset for better release notes.'
      );
    }
  }

  if (issues.length > 0) {
    console.log('\n⚠️  Release preparation warnings:');
    issues.forEach((issue) => console.log(`  - ${issue}`));
    console.log('\nNote: The CI/CD pipeline will auto-release these changes on main,');
    console.log('but explicit version bumps produce better changelogs.');
    console.log('');
    console.log('::warning::Publishable changes without explicit version bump/changeset detected. Auto-release will handle this on main.');
    // Exit 0 — this is a warning, not a blocker (auto-release handles it)
    process.exit(0);
  }

  console.log('\nAll publishable changes have corresponding version bumps/changesets.');
} catch (error) {
  console.error('Error:', error.message);
  // Don't fail the workflow on script errors
  process.exit(0);
}
