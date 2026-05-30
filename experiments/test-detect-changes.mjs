#!/usr/bin/env node

// Test script for detect-code-changes.mjs logic
// Validates that the change detection correctly classifies files

import { execSync } from 'child_process';

function isExcludedFromCodeChanges(filePath) {
  if (filePath.endsWith('.md')) return true;
  const excludedFolders = ['.changeset/', 'docs/', 'experiments/', 'examples/'];
  for (const folder of excludedFolders) {
    if (filePath.startsWith(folder)) return true;
  }
  return false;
}

function classifyFiles(changedFiles) {
  const jsCodeChanged = changedFiles.some(
    (f) => f.startsWith('js/') && /\.(js|mjs|json)$/.test(f)
  );
  const jsChanged = changedFiles.some((f) => f.startsWith('js/'));
  const rustCodeChanged = changedFiles.some(
    (f) => f.startsWith('rust/') && /\.(rs|toml)$/.test(f)
  );
  const rustChanged = changedFiles.some((f) => f.startsWith('rust/'));
  const scriptsChanged = changedFiles.some((f) => f.startsWith('scripts/'));
  const jsScriptsChanged = changedFiles.some(
    (f) =>
      f.startsWith('scripts/') &&
      !f.startsWith('scripts/rust-') &&
      f.endsWith('.mjs')
  );
  const rustScriptsChanged = changedFiles.some(
    (f) => f.startsWith('scripts/rust-') && f.endsWith('.mjs')
  );
  const jsWorkflowChanged = changedFiles.some(
    (f) => f === '.github/workflows/js.yml'
  );
  const rustWorkflowChanged = changedFiles.some(
    (f) => f === '.github/workflows/rust.yml'
  );
  const docsChanged = changedFiles.some((f) => f.endsWith('.md'));

  const codeChangedFiles = changedFiles.filter(
    (file) => !isExcludedFromCodeChanges(file)
  );
  const codePattern =
    /\.(mjs|js|json|rs|toml|yml|yaml|sh|lock)$|\.github\/workflows\//;
  const anyCodeChanged = codeChangedFiles.some((file) =>
    codePattern.test(file)
  );

  const anyJsCodeChanged =
    jsCodeChanged || jsScriptsChanged || jsWorkflowChanged;
  const anyRustCodeChanged =
    rustCodeChanged || rustScriptsChanged || rustWorkflowChanged;

  return {
    jsCodeChanged, jsChanged, rustCodeChanged, rustChanged,
    scriptsChanged, jsScriptsChanged, rustScriptsChanged,
    jsWorkflowChanged, rustWorkflowChanged, docsChanged,
    anyCodeChanged, anyJsCodeChanged, anyRustCodeChanged,
    codeChangedFiles,
  };
}

let passed = 0;
let failed = 0;

function test(name, files, expected) {
  const result = classifyFiles(files);
  const errors = [];
  for (const [key, expectedValue] of Object.entries(expected)) {
    if (result[key] !== expectedValue) {
      errors.push(`  ${key}: expected ${expectedValue}, got ${result[key]}`);
    }
  }
  if (errors.length > 0) {
    console.log(`FAIL: ${name}`);
    errors.forEach((e) => console.log(e));
    failed++;
  } else {
    console.log(`PASS: ${name}`);
    passed++;
  }
}

// Test cases
test('.gitkeep only change', ['.gitkeep'], {
  anyCodeChanged: false,
  anyJsCodeChanged: false,
  anyRustCodeChanged: false,
  docsChanged: false,
});

test('.gitignore only change', ['.gitignore'], {
  anyCodeChanged: false,
  anyJsCodeChanged: false,
  anyRustCodeChanged: false,
});

test('README.md only change', ['README.md'], {
  anyCodeChanged: false,
  anyJsCodeChanged: false,
  anyRustCodeChanged: false,
  docsChanged: true,
});

test('docs/ folder change', ['docs/case-studies/issue-50/analysis.md'], {
  anyCodeChanged: false,
  anyJsCodeChanged: false,
  anyRustCodeChanged: false,
  docsChanged: true,
});

test('JS source change', ['js/src/archive.js'], {
  anyCodeChanged: true,
  anyJsCodeChanged: true,
  anyRustCodeChanged: false,
  jsCodeChanged: true,
});

test('Rust source change', ['rust/src/main.rs'], {
  anyCodeChanged: true,
  anyJsCodeChanged: false,
  anyRustCodeChanged: true,
  rustCodeChanged: true,
});

test('Rust script change only triggers Rust CI', ['scripts/rust-publish-crate.mjs'], {
  anyCodeChanged: true,
  anyJsCodeChanged: false,
  anyRustCodeChanged: true,
  scriptsChanged: true,
  jsScriptsChanged: false,
  rustScriptsChanged: true,
});

test('JS script change only triggers JS CI', ['scripts/validate-changeset.mjs'], {
  anyCodeChanged: true,
  anyJsCodeChanged: true,
  anyRustCodeChanged: false,
  scriptsChanged: true,
  jsScriptsChanged: true,
  rustScriptsChanged: false,
});

test('detect-code-changes.mjs itself triggers JS CI (not Rust)', ['scripts/detect-code-changes.mjs'], {
  anyCodeChanged: true,
  anyJsCodeChanged: true,
  anyRustCodeChanged: false,
  jsScriptsChanged: true,
  rustScriptsChanged: false,
});

test('JS workflow change triggers JS CI', ['.github/workflows/js.yml'], {
  anyCodeChanged: true,
  anyJsCodeChanged: true,
  anyRustCodeChanged: false,
});

test('Rust workflow change triggers Rust CI', ['.github/workflows/rust.yml'], {
  anyCodeChanged: true,
  anyJsCodeChanged: false,
  anyRustCodeChanged: true,
});

test('.changeset/ folder excluded from code changes', ['.changeset/some-change.md', 'js/.changeset/skip-ci.md'], {
  anyCodeChanged: false,
  anyJsCodeChanged: false,
  anyRustCodeChanged: false,
});

test('experiments/ folder excluded from code changes', ['experiments/test.mjs'], {
  anyCodeChanged: false,
  anyJsCodeChanged: false,
  anyRustCodeChanged: false,
});

test('examples/ folder excluded from code changes', ['examples/demo.js'], {
  anyCodeChanged: false,
  anyJsCodeChanged: false,
  anyRustCodeChanged: false,
});

test('Mixed: .gitkeep + JS code triggers JS CI only', ['.gitkeep', 'js/src/archive.js'], {
  anyCodeChanged: true,
  anyJsCodeChanged: true,
  anyRustCodeChanged: false,
});

test('Mixed: .gitkeep + Rust code triggers Rust CI only', ['.gitkeep', 'rust/src/main.rs'], {
  anyCodeChanged: true,
  anyJsCodeChanged: false,
  anyRustCodeChanged: true,
});

test('LICENSE file', ['LICENSE'], {
  anyCodeChanged: false,
  anyJsCodeChanged: false,
  anyRustCodeChanged: false,
});

test('Cargo.lock change triggers Rust', ['rust/Cargo.lock'], {
  anyRustCodeChanged: false,
  rustChanged: true,
});

test('yarn.lock change', ['js/yarn.lock'], {
  anyJsCodeChanged: false,
  jsChanged: true,
});

console.log(`\n${passed} passed, ${failed} failed out of ${passed + failed} tests`);
process.exit(failed > 0 ? 1 : 0);
