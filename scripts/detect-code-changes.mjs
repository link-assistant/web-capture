#!/usr/bin/env node

// Detect code changes for CI/CD pipeline
//
// Detects what types of files changed in the latest commit and outputs
// results for use in GitHub Actions workflow conditions.
//
// For PRs: GitHub Actions checks out a synthetic merge commit, so we
// compare HEAD^2^ to HEAD^2 (the PR head's per-commit diff).
// For pushes: compares HEAD^ to HEAD.
// This ensures a commit touching only non-code files skips tests,
// even when earlier commits in the same PR changed code.
//
// Excluded from code changes (don't require changesets):
// - Markdown files in any folder
// - .changeset/ folder (changeset metadata)
// - docs/ folder (documentation)
// - experiments/ folder (experimental scripts)
// - examples/ folder (example scripts)
//
// Outputs (written to GITHUB_OUTPUT):
//   js-code-changed, js-changed, rust-code-changed, rust-changed,
//   scripts-changed, js-scripts-changed, rust-scripts-changed,
//   workflow-changed, js-workflow-changed, rust-workflow-changed,
//   docs-changed, any-code-changed, any-js-code-changed, any-rust-code-changed

import { execSync } from 'child_process';
import { appendFileSync } from 'fs';

function exec(command) {
  try {
    return execSync(command, { encoding: 'utf-8' }).trim();
  } catch (error) {
    console.error(`Error executing command: ${command}`);
    console.error(error.message);
    return '';
  }
}

function setOutput(name, value) {
  const outputFile = process.env.GITHUB_OUTPUT;
  if (outputFile) {
    appendFileSync(outputFile, `${name}=${value}\n`);
  }
  console.log(`${name}=${value}`);
}

function isMergeCommit() {
  const parentCount = exec('git cat-file -p HEAD')
    .split('\n')
    .filter((line) => line.startsWith('parent ')).length;
  return parentCount > 1;
}

function getChangedFiles() {
  // GitHub Actions checks out a synthetic merge commit for pull_request
  // events: HEAD is the merge commit, HEAD^ is the base branch, HEAD^2
  // is the actual PR head. To get the per-commit diff (what the latest
  // push actually changed), we compare HEAD^2^ to HEAD^2.
  // For push events, HEAD is the real commit, so HEAD^ to HEAD works.
  if (isMergeCommit()) {
    console.log('Merge commit detected (pull_request event)');
    console.log('Comparing HEAD^2^ to HEAD^2 (per-commit diff of PR head)');
    try {
      const output = exec('git diff --name-only HEAD^2^ HEAD^2');
      return output ? output.split('\n').filter(Boolean) : [];
    } catch {
      console.log('HEAD^2^ not available (first commit in PR), listing files in HEAD^2');
      const output = exec('git diff --name-only HEAD^ HEAD^2');
      return output ? output.split('\n').filter(Boolean) : [];
    }
  }

  console.log('Comparing HEAD^ to HEAD');
  try {
    const output = exec('git diff --name-only HEAD^ HEAD');
    return output ? output.split('\n').filter(Boolean) : [];
  } catch {
    console.log('HEAD^ not available, listing all files in HEAD');
    const output = exec('git ls-tree --name-only -r HEAD');
    return output ? output.split('\n').filter(Boolean) : [];
  }
}

function isExcludedFromCodeChanges(filePath) {
  if (filePath.endsWith('.md')) {
    return true;
  }

  const excludedFolders = ['.changeset/', 'docs/', 'experiments/', 'examples/'];

  for (const folder of excludedFolders) {
    if (filePath.startsWith(folder)) {
      return true;
    }
  }

  return false;
}

function detectChanges() {
  console.log('Detecting file changes for CI/CD...\n');

  const changedFiles = getChangedFiles();

  console.log('Changed files:');
  if (changedFiles.length === 0) {
    console.log('  (none)');
  } else {
    changedFiles.forEach((file) => console.log(`  ${file}`));
  }
  console.log('');

  // JS-specific detection
  const jsCodeChanged = changedFiles.some(
    (f) => f.startsWith('js/') && /\.(js|mjs|json)$/.test(f)
  );
  setOutput('js-code-changed', jsCodeChanged ? 'true' : 'false');

  const jsChanged = changedFiles.some((f) => f.startsWith('js/'));
  setOutput('js-changed', jsChanged ? 'true' : 'false');

  // Rust-specific detection
  const rustCodeChanged = changedFiles.some(
    (f) => f.startsWith('rust/') && /\.(rs|toml)$/.test(f)
  );
  setOutput('rust-code-changed', rustCodeChanged ? 'true' : 'false');

  const rustChanged = changedFiles.some((f) => f.startsWith('rust/'));
  setOutput('rust-changed', rustChanged ? 'true' : 'false');

  // Scripts detection
  const scriptsChanged = changedFiles.some((f) => f.startsWith('scripts/'));
  setOutput('scripts-changed', scriptsChanged ? 'true' : 'false');

  const jsScriptsChanged = changedFiles.some(
    (f) =>
      f.startsWith('scripts/') &&
      !f.startsWith('scripts/rust-') &&
      f.endsWith('.mjs')
  );
  setOutput('js-scripts-changed', jsScriptsChanged ? 'true' : 'false');

  const rustScriptsChanged = changedFiles.some(
    (f) => f.startsWith('scripts/rust-') && f.endsWith('.mjs')
  );
  setOutput('rust-scripts-changed', rustScriptsChanged ? 'true' : 'false');

  // Workflow detection
  const workflowChanged = changedFiles.some((f) =>
    f.startsWith('.github/workflows/')
  );
  setOutput('workflow-changed', workflowChanged ? 'true' : 'false');

  const jsWorkflowChanged = changedFiles.some(
    (f) => f === '.github/workflows/js.yml'
  );
  setOutput('js-workflow-changed', jsWorkflowChanged ? 'true' : 'false');

  const rustWorkflowChanged = changedFiles.some(
    (f) => f === '.github/workflows/rust.yml'
  );
  setOutput('rust-workflow-changed', rustWorkflowChanged ? 'true' : 'false');

  // Docs detection
  const docsChanged = changedFiles.some((f) => f.endsWith('.md'));
  setOutput('docs-changed', docsChanged ? 'true' : 'false');

  // Code changes (excluding docs, changesets, experiments, examples)
  const codeChangedFiles = changedFiles.filter(
    (file) => !isExcludedFromCodeChanges(file)
  );

  console.log('\nFiles considered as code changes:');
  if (codeChangedFiles.length === 0) {
    console.log('  (none)');
  } else {
    codeChangedFiles.forEach((file) => console.log(`  ${file}`));
  }
  console.log('');

  const codePattern =
    /\.(mjs|js|json|rs|toml|yml|yaml|sh|lock)$|\.github\/workflows\//;
  const anyCodeChanged = codeChangedFiles.some((file) =>
    codePattern.test(file)
  );
  setOutput('any-code-changed', anyCodeChanged ? 'true' : 'false');

  // Composite flags for workflow gating
  const anyJsCodeChanged =
    jsCodeChanged || jsScriptsChanged || jsWorkflowChanged;
  setOutput('any-js-code-changed', anyJsCodeChanged ? 'true' : 'false');

  const anyRustCodeChanged =
    rustCodeChanged || rustScriptsChanged || rustWorkflowChanged;
  setOutput('any-rust-code-changed', anyRustCodeChanged ? 'true' : 'false');

  console.log('\nChange detection completed.');
}

detectChanges();
