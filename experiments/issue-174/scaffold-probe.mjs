// Exercise generated service startup with no registry install or external network.
import {
  mkdtemp,
  mkdir,
  readFile,
  rm,
  symlink,
  writeFile,
} from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
const root = path.resolve(import.meta.dirname, '../..');
const temp = await mkdtemp(path.join(tmpdir(), 'web-capture-scaffold-'));
try {
  const shims = path.join(temp, 'shims');
  await mkdir(shims);
  for (const command of ['npm', 'yarn']) {
    await writeFile(path.join(shims, command), '#!/bin/sh\nexit 0\n', {
      mode: 0o755,
    });
  }
  const generated = path.join(temp, 'service');
  execFileSync(
    'bash',
    [
      process.env.ISSUE174_SCAFFOLD_SCRIPT || path.join(root, 'apply.sh'),
      generated,
      '--skip-install',
    ],
    {
      env: { ...process.env, PATH: `${shims}:${process.env.PATH}` },
      stdio: 'pipe',
    }
  );
  // Real published app API is represented by the source under test.
  await mkdir(path.join(generated, 'node_modules/@link-assistant'), {
    recursive: true,
  });
  await symlink(
    path.join(root, 'js'),
    path.join(generated, 'node_modules/@link-assistant/web-capture')
  );
  for (const name of ['express', 'turndown']) {
    await symlink(
      path.join(root, 'js/node_modules', name),
      path.join(generated, 'node_modules', name)
    );
  }
  await mkdir(path.join(generated, 'node_modules/capture-website'));
  await writeFile(
    path.join(generated, 'node_modules/capture-website/package.json'),
    JSON.stringify({ type: 'module', main: 'index.js' })
  );
  await writeFile(
    path.join(generated, 'node_modules/capture-website/index.js'),
    'export default {};'
  );
  const source = await readFile(path.join(generated, 'index.js'), 'utf8');
  // Import the generated module while replacing only its server listen call.
  await writeFile(
    path.join(generated, 'probe.mjs'),
    source.replace(
      /app.listen\([\s\S]*$/,
      "console.log(app.router.stack.filter(layer => layer.route).map(layer => layer.route.path).join(','));\n"
    )
  );
  const output = execFileSync(
    process.execPath,
    [path.join(generated, 'probe.mjs')],
    { encoding: 'utf8' }
  );
  for (const route of ['/html', '/markdown', '/image']) {
    if (!output.includes(route))
      throw new Error(`Missing original route ${route}`);
  }
  console.log(
    'Generated service imports successfully and preserves every original route.'
  );
} finally {
  await rm(temp, { recursive: true, force: true });
}
