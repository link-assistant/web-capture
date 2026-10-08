// Reproduce npm's handling of unpublished optional versions in an isolated copy.
import { mkdtemp, copyFile, rm, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
const temp = await mkdtemp(path.join(tmpdir(), 'web-capture-lock-'));
try {
  for (const file of ['package.json', 'package-lock.json']) {
    await copyFile(
      new URL(`../../js/${file}`, import.meta.url),
      path.join(temp, file)
    );
  }
  if (process.argv.includes('--regenerate')) {
    execFileSync(
      'npx',
      [
        '--yes',
        'npm@12.2.0',
        'install',
        '--package-lock-only',
        '--ignore-scripts',
      ],
      { cwd: temp, stdio: 'inherit' }
    );
  } else {
    const manifestPath = path.join(temp, 'package.json');
    const manifest = JSON.parse(await readFile(manifestPath, 'utf8'));
    manifest.version = '2.0.0';
    await writeFile(manifestPath, JSON.stringify(manifest, null, 2));
    execFileSync(
      'npx',
      [
        '--yes',
        'npm@12.2.0',
        'version',
        manifest.version,
        '--allow-same-version',
        '--no-git-tag-version',
      ],
      { cwd: temp, stdio: 'inherit' }
    );
  }
  execFileSync(
    'npx',
    ['--yes', 'npm@12.2.0', 'ci', '--ignore-scripts', '--dry-run'],
    { cwd: temp, stdio: 'inherit' }
  );
  console.log(
    'npm 12 version synchronizes release metadata while preserving the compatible dependency graph.'
  );
} finally {
  await rm(temp, { recursive: true, force: true });
}
