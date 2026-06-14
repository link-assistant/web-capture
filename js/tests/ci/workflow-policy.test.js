import { readFileSync } from 'fs';
import { dirname, resolve } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const repoRoot = resolve(__dirname, '../../..');

const workflowFiles = [
  '.github/workflows/js.yml',
  '.github/workflows/rust.yml',
  '.github/workflows/parity.yml',
];

function readRootFile(relativePath) {
  return readFileSync(resolve(repoRoot, relativePath), 'utf8');
}

function readWorkflow(relativePath) {
  return readRootFile(relativePath);
}

describe('workflow policy', () => {
  test.each(workflowFiles)(
    '%s uses release-safe concurrency cancellation',
    (workflowFile) => {
      const workflow = readWorkflow(workflowFile);

      expect(workflow).toContain(
        "cancel-in-progress: ${{ github.ref != 'refs/heads/main' }}"
      );
      expect(workflow).not.toContain(
        "cancel-in-progress: ${{ github.ref == 'refs/heads/main' }}"
      );
    }
  );

  test.each(workflowFiles)(
    '%s uses the current checkout action',
    (workflowFile) => {
      const workflow = readWorkflow(workflowFile);

      expect(workflow).toContain('uses: actions/checkout@v6');
      expect(workflow).not.toContain('uses: actions/checkout@v4');
    }
  );

  test('Rust workflow uses the current cache action', () => {
    const workflow = readWorkflow('.github/workflows/rust.yml');

    expect(workflow).toContain('uses: actions/cache@v5');
    expect(workflow).not.toContain('uses: actions/cache@v4');
  });

  test('parity check ignores repository-level CI tests', () => {
    const parityScript = readRootFile('scripts/check-js-rust-parity.mjs');

    expect(parityScript).toContain('"js/tests/ci/"');
    expect(parityScript).toContain(
      'matchingFiles(files, JS_PARITY_PATHS, JS_PARITY_IGNORE_PATHS)'
    );
  });
});
