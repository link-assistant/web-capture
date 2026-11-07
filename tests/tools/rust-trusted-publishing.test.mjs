import assert from 'node:assert/strict';
import { readFileSync, mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { test } from 'node:test';

const root = fileURLToPath(new URL('../../', import.meta.url));
const workflow = readFileSync(
  path.join(root, '.github/workflows/rust.yml'),
  'utf8'
);
const releaseJobs = [
  ...workflow.matchAll(
    /^  (release|instant-release):\n([\s\S]*?)(?=^  [\w-]+:|$(?![\s\S]))/gm
  ),
];

for (const [, name, body] of releaseJobs) {
  test(`${name}: publishing is gated, builds before OIDC and preserves fallback`, () => {
    assert.match(body, /github\.ref == 'refs\/heads\/main'/);
    assert.match(body, /needs: \[lint, test, build, dependency-health\]/);
    assert.match(body, /permissions:\n      id-token: write/);
    const authAt = body.indexOf('      - name: Authenticate with crates.io');
    const publishAt = body.indexOf('      - name: Publish to crates.io');
    const buildAt = body.indexOf('run: cargo build --release');
    assert.ok(buildAt > 0 && buildAt < authAt && authAt < publishAt);
    const auth = body.slice(authAt, publishAt);
    assert.match(auth, /uses: rust-lang\/crates-io-auth-action@[a-f0-9]{40}/);
    assert.match(auth, /continue-on-error: true/);
    const gate =
      name === 'release'
        ? "steps.release_check.outputs.should_release == 'true'"
        : "steps.version.outputs.version_committed == 'true'";
    assert.ok(auth.includes(`if: ${gate}`));
    assert.ok(body.slice(publishAt).includes(`if: ${gate}`));
    assert.ok(
      body.includes(
        '${{ steps.prm_auth.outputs.token || secrets.CARGO_REGISTRY_TOKEN || secrets.CARGO_TOKEN }}'
      )
    );
    assert.match(
      body.slice(publishAt),
      /if: steps.publish.outputs.published == 'true'/
    );
  });
}
test('both Rust release paths are covered', () =>
  assert.equal(releaseJobs.length, 2));

test('only publishing jobs request OIDC write permission', () => {
  assert.equal((workflow.match(/id-token: write/g) || []).length, 2);
});

for (const source of ['CARGO_REGISTRY_TOKEN', 'CARGO_TOKEN', 'missing']) {
  test(
    `cargo publishing uses ${source} without exposing credentials`,
    { timeout: 10000, skip: process.platform === 'win32' },
    () => {
      const dir = mkdtempSync(path.join(tmpdir(), 'rust-publish-'));
      try {
        writeFileSync(
          path.join(dir, 'Cargo.toml'),
          '[package]\nname = "test-crate"\nversion = "1.2.3"\n'
        );
        writeFileSync(
          path.join(dir, 'cargo'),
          `#!/usr/bin/env node
const fs = require('node:fs');
fs.writeFileSync(process.env.CAPTURE_FILE, JSON.stringify({args: process.argv.slice(2), token: process.env.CARGO_REGISTRY_TOKEN}));
`,
          { mode: 0o755 }
        );
        writeFileSync(
          path.join(dir, 'fetch.mjs'),
          'globalThis.fetch = async () => ({ ok: false, status: 404 });\n'
        );
        const env = {
          ...process.env,
          PATH: `${dir}${path.delimiter}${process.env.PATH}`,
          GITHUB_OUTPUT: path.join(dir, 'output'),
          CAPTURE_FILE: path.join(dir, 'capture'),
          CARGO_REGISTRY_TOKEN: '',
          CARGO_TOKEN: '',
        };
        if (source !== 'missing') env[source] = 'private-test-token';
        if (source === 'CARGO_REGISTRY_TOKEN')
          env.CARGO_TOKEN = 'lower-priority-token';
        const result = spawnSync(
          process.execPath,
          [
            '--import',
            path.join(dir, 'fetch.mjs'),
            path.join(root, 'scripts/rust-publish-crate.mjs'),
          ],
          { cwd: dir, env, encoding: 'utf8', timeout: 8000 }
        );
        assert.ifError(result.error);
        assert.equal(
          result.status,
          source === 'missing' ? 1 : 0,
          result.stderr
        );
        assert.doesNotMatch(
          result.stdout + result.stderr,
          /private-test-token|lower-priority-token/
        );
        const output = readFileSync(env.GITHUB_OUTPUT, 'utf8');
        assert.ok(output.includes(`published=${source !== 'missing'}\n`));
        if (source !== 'missing') {
          const captured = JSON.parse(readFileSync(env.CAPTURE_FILE));
          assert.deepEqual(captured.args, ['publish', '--allow-dirty']);
          assert.equal(captured.token, 'private-test-token');
        }
      } finally {
        rmSync(dir, { recursive: true, force: true });
      }
    }
  );
}
