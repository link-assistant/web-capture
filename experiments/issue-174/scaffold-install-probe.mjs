// Exercise the actual default scaffold install without downloading another browser.
import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync, spawnSync } from 'node:child_process';

const directory = await mkdtemp(
  path.join(tmpdir(), 'web-capture-scaffold-install-')
);
try {
  const scaffold = spawnSync(
    'bash',
    [fileURLToPath(new URL('../../apply.sh', import.meta.url)), directory],
    {
      env: { ...process.env, PUPPETEER_SKIP_DOWNLOAD: 'true' },
      encoding: 'utf8',
    }
  );
  process.stdout.write(scaffold.stdout);
  process.stderr.write(scaffold.stderr);
  assert.equal(scaffold.status, 0);
  // Mixing npm versions leaked npm 12 config into npm 11 as an unknown env
  // config, and a bare `git init` printed the default-branch hint (#177).
  assert.doesNotMatch(
    scaffold.stderr,
    /Unknown env config|hint: Using 'master'/
  );
  const lock = await readFile(
    path.join(directory, 'package-lock.json'),
    'utf8'
  );
  assert.doesNotMatch(lock, /"node_modules\/whatwg-encoding"/);
  execFileSync(
    'npx',
    ['--yes', 'npm@12.2.0', 'ci', '--ignore-scripts', '--dry-run'],
    {
      cwd: directory,
      stdio: 'inherit',
    }
  );
  const manifest = JSON.parse(
    await readFile(path.join(directory, 'package.json'), 'utf8')
  );
  assert.equal(manifest.packageManager, 'npm@12.2.0');
  assert.equal(manifest.allowScripts.puppeteer, true);
  console.log(
    'The default scaffold creates an npm 12 compatible lock and permits browser installation.'
  );
} finally {
  await rm(directory, { recursive: true, force: true });
}
