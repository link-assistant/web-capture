#!/usr/bin/env node
// Preserve npm's all-severity audit, accounting for a rejected CVE while the
// GitHub advisory feed catches up. Any other advisory or verification error fails.
import { execFileSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';

const rejectedAdvisory = 'https://github.com/advisories/GHSA-gcqx-w48m-w2h4';
const recordUrl =
  'https://raw.githubusercontent.com/CVEProject/cvelistV5/main/cves/2026/93xxx/CVE-2026-93753.json';

export async function auditFindings(report, getRecord) {
  if (
    report.error ||
    !report.metadata?.vulnerabilities ||
    !report.vulnerabilities
  ) {
    throw new Error('npm audit did not return a valid security report');
  }
  const findings = Object.values(report.vulnerabilities).flatMap((v) =>
    v.via.filter((via) => typeof via === 'object')
  );
  // Do not accidentally accept a changed or incomplete npm report format.
  if (report.metadata.vulnerabilities.total > 0 && findings.length === 0) {
    throw new Error(
      'npm audit reported vulnerabilities without advisory details'
    );
  }
  let rejected = false;
  if (
    findings.some(
      (finding) =>
        finding.url === rejectedAdvisory && finding.name === 'deepmerge'
    )
  ) {
    const record = await getRecord();
    rejected =
      record.cveMetadata?.cveId === 'CVE-2026-93753' &&
      record.cveMetadata?.state === 'REJECTED';
  }
  return findings.filter(
    (finding) =>
      !(
        rejected &&
        finding.url === rejectedAdvisory &&
        finding.name === 'deepmerge'
      )
  );
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  try {
    let output;
    try {
      output = execFileSync(
        'npm',
        ['audit', '--package-lock-only', '--json', ...process.argv.slice(2)],
        { encoding: 'utf8' }
      );
    } catch (error) {
      if (error.status !== 1) throw error;
      output = error.stdout;
    }
    const report = JSON.parse(output);
    console.log(JSON.stringify(report, null, 2));
    const findings = await auditFindings(report, async () => {
      const response = await fetch(recordUrl, {
        signal: AbortSignal.timeout(30000),
      });
      if (!response.ok)
        throw new Error(
          `CVE rejection verification failed: HTTP ${response.status}`
        );
      return response.json();
    });
    if (findings.length)
      throw new Error(
        findings.map((finding) => `${finding.name}: ${finding.url}`).join('\n')
      );
    console.log(
      'No actionable npm advisories. Any GHSA-gcqx-w48m-w2h4 finding was verified against the rejected CVE record.'
    );
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}
