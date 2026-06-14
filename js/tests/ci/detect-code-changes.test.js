import { execFileSync } from 'child_process';
import {
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'fs';
import { tmpdir } from 'os';
import { dirname, join, resolve } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const repoRoot = resolve(__dirname, '../../..');
const detectorPath = resolve(repoRoot, 'scripts/detect-code-changes.mjs');

function run(command, args, cwd, options = {}) {
  return execFileSync(command, args, {
    cwd,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
    ...options,
  });
}

function git(repoPath, args) {
  return run('git', args, repoPath);
}

function writeTrackedFile(repoPath, relativePath, contents) {
  const filePath = join(repoPath, relativePath);
  mkdirSync(dirname(filePath), { recursive: true });
  writeFileSync(filePath, contents);
}

function commitAll(repoPath, message) {
  git(repoPath, ['add', '.']);
  git(repoPath, ['commit', '-m', message]);
}

function createMergedFeatureRepo() {
  const repoPath = mkdtempSync(join(tmpdir(), 'web-capture-detect-'));

  initializeRepo(repoPath);

  writeTrackedFile(repoPath, 'README.md', '# fixture\n');
  commitAll(repoPath, 'initial commit');

  git(repoPath, ['checkout', '-b', 'feature']);
  writeTrackedFile(repoPath, 'rust/src/lib.rs', 'pub fn capture() {}\n');
  commitAll(repoPath, 'add rust code');

  writeTrackedFile(repoPath, 'docs/notes.md', '# docs only tail commit\n');
  commitAll(repoPath, 'document rust change');

  git(repoPath, ['checkout', 'main']);
  git(repoPath, ['merge', '--no-ff', 'feature', '-m', 'merge feature']);

  return repoPath;
}

function createSingleCommitRepo() {
  return createSingleCommitRepoWithFiles({
    'js/src/index.js': 'export const ok = true;\n',
  });
}

function createSingleCommitRepoWithFiles(files) {
  const repoPath = mkdtempSync(join(tmpdir(), 'web-capture-detect-'));

  initializeRepo(repoPath);
  for (const [relativePath, contents] of Object.entries(files)) {
    writeTrackedFile(repoPath, relativePath, contents);
  }
  commitAll(repoPath, 'initial commit');

  return repoPath;
}

function initializeRepo(repoPath) {
  git(repoPath, ['init']);
  git(repoPath, ['config', 'user.email', 'ci@example.test']);
  git(repoPath, ['config', 'user.name', 'CI Test']);
  git(repoPath, ['checkout', '-b', 'main']);
}

function parseOutputs(outputFile) {
  return Object.fromEntries(
    readFileSync(outputFile, 'utf8')
      .trim()
      .split('\n')
      .filter(Boolean)
      .map((line) => {
        const separatorIndex = line.indexOf('=');
        return [line.slice(0, separatorIndex), line.slice(separatorIndex + 1)];
      })
  );
}

function runDetector(repoPath, eventName) {
  const outputFile = join(repoPath, `github-output-${eventName}.txt`);
  const env = {
    ...process.env,
    GITHUB_EVENT_NAME: eventName,
    GITHUB_OUTPUT: outputFile,
  };
  delete env.GITHUB_BASE_SHA;
  delete env.GITHUB_HEAD_SHA;

  run(process.execPath, [detectorPath], repoPath, { env });

  return parseOutputs(outputFile);
}

describe('detect-code-changes', () => {
  let repoPath;

  afterEach(() => {
    if (repoPath) {
      rmSync(repoPath, { recursive: true, force: true });
      repoPath = undefined;
    }
  });

  test('detects code introduced by a real merge commit pushed to main', () => {
    repoPath = createMergedFeatureRepo();

    const outputs = runDetector(repoPath, 'push');

    expect(outputs['rust-code-changed']).toBe('true');
    expect(outputs['rust-changed']).toBe('true');
    expect(outputs['any-rust-code-changed']).toBe('true');
    expect(outputs['any-code-changed']).toBe('true');
    expect(outputs['docs-changed']).toBe('true');
  });

  test('keeps pull request merge commits scoped to the PR head commit', () => {
    repoPath = createMergedFeatureRepo();

    const outputs = runDetector(repoPath, 'pull_request');

    expect(outputs['rust-code-changed']).toBe('false');
    expect(outputs['rust-changed']).toBe('false');
    expect(outputs['any-rust-code-changed']).toBe('false');
    expect(outputs['any-code-changed']).toBe('false');
    expect(outputs['docs-changed']).toBe('true');
  });

  test('detects files when a push only has one commit', () => {
    repoPath = createSingleCommitRepo();

    const outputs = runDetector(repoPath, 'push');

    expect(outputs['js-code-changed']).toBe('true');
    expect(outputs['js-changed']).toBe('true');
    expect(outputs['any-js-code-changed']).toBe('true');
    expect(outputs['any-code-changed']).toBe('true');
  });

  test('runs JS checks for CI tests without requiring a changeset', () => {
    repoPath = createSingleCommitRepoWithFiles({
      'js/jest.config.mjs': 'export default {};\n',
      'js/tests/ci/workflow-policy.test.js': 'test("ok", () => {});\n',
    });

    const outputs = runDetector(repoPath, 'push');

    expect(outputs['js-code-changed']).toBe('false');
    expect(outputs['js-changed']).toBe('true');
    expect(outputs['any-js-code-changed']).toBe('true');
    expect(outputs['any-code-changed']).toBe('true');
  });
});
