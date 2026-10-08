import assert from 'node:assert/strict';
import { test } from 'node:test';
import { $ } from 'execa';

test('release arguments preserve newlines, quotes, shell characters and array expansion', async () => {
  const message = 'Release: didn\'t split "quotes"\n$literal `backticks`; & |';
  const args = ['branch with spaces', '--description', message];
  const { stdout } =
    await $`${process.execPath} -p ${'JSON.stringify(process.argv.slice(1))'} ${args}`;
  assert.deepEqual(JSON.parse(stdout), args);
});

test('release JSON input is delivered without shell escaping', async () => {
  const payload = JSON.stringify({
    body: "café\nDidn't escape this 'quoted' body",
  });
  const result = await $({
    input: payload,
  })`${process.execPath} -e ${'process.stdin.pipe(process.stdout)'}`;
  assert.equal(result.stdout, payload);
});

test('captured registry failures retain status and stderr; mutation failures reject', async () => {
  const script = "process.stderr.write('npm E404'); process.exit(1)";
  const result = await $({ reject: false })`${process.execPath} -e ${script}`;
  assert.equal(result.exitCode, 1);
  assert.equal(result.stderr, 'npm E404');
  await assert.rejects($`${process.execPath} -e ${script}`, /npm E404/);
});
