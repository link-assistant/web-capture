import assert from 'node:assert/strict';
import { test } from 'node:test';
import { auditFindings } from '../../scripts/audit-npm.mjs';
const rejected = {
  name: 'deepmerge',
  url: 'https://github.com/advisories/GHSA-gcqx-w48m-w2h4',
};
const other = {
  name: 'glob',
  url: 'https://github.com/advisories/GHSA-3g3m-2fjr-6pw4',
};
const report = (...via) => ({
  metadata: { vulnerabilities: { total: via.length } },
  vulnerabilities: { dependency: { via } },
});
const record = async () => ({
  cveMetadata: { cveId: 'CVE-2026-93753', state: 'REJECTED' },
});

test('audit accepts only the verified rejected advisory, retaining other severities', async () => {
  assert.deepEqual(await auditFindings(report(rejected, other), record), [
    other,
  ]);
  assert.deepEqual(await auditFindings(report(rejected), record), []);
  assert.deepEqual(await auditFindings(report(), record), []);
});
test('audit fails closed when the CVE is active, different, or cannot be verified', async () => {
  for (const cveMetadata of [
    { cveId: 'CVE-2026-93753', state: 'PUBLISHED' },
    { cveId: 'other', state: 'REJECTED' },
  ]) {
    assert.deepEqual(
      await auditFindings(report(rejected), async () => ({ cveMetadata })),
      [rejected]
    );
  }
  await assert.rejects(
    auditFindings(report(rejected), async () => {
      throw new Error('network error');
    })
  );
  await assert.rejects(
    auditFindings({ error: 'registry unavailable' }, record)
  );
  await assert.rejects(auditFindings(report('missing details'), record));
  assert.deepEqual(
    await auditFindings(
      report({ ...rejected, name: 'another-package' }),
      record
    ),
    [{ ...rejected, name: 'another-package' }]
  );
});
