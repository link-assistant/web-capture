# Dependency audit for PR 180

The original dependency health checks failed on 010f921 because new direct versions
had been released. Refresh the manifests and complete lockfiles while retaining the
browser-commander pin tracked by issue #160. A Rust patch version and a JS patch changeset prepare the next releases; runtime feature coverage remains in the existing JS/Rust CI matrix.

The npm lock also required security updates to compatible transitive dependencies
and overrides for glob 14.0.4+ and minimatch 11.0.5+ (both still expose CommonJS and
ESM entry points). The full JS tests and lint in CI check their consumers.

One remaining npm advisory, GHSA-gcqx-w48m-w2h4 for deepmerge, references
CVE-2026-93753, which its assigner rejected on 2026-11-02 because it does not describe
a security vulnerability. The GitHub advisory feed still reports it. We retain
all-severity audit enforcement with `scripts/audit-npm.mjs`: only that exact
package/advisory is discounted, and only when the live official CVE record confirms
its identity and REJECTED status. A fetch failure, changed CVE status, any other
advisory (including low severity), or malformed audit output fails the check.
Root release tooling continues to use unfiltered `npm audit`.

Evidence:

- [Official CVE record](https://github.com/CVEProject/cvelistV5/blob/main/cves/2026/93xxx/CVE-2026-93753.json)
- [Upstream discussion](https://github.com/TehShrike/deepmerge/issues/273)
- [GitHub advisory awaiting reconciliation](https://github.com/advisories/GHSA-gcqx-w48m-w2h4)

Reproduction: `npm audit --prefix js --package-lock-only` reports the rejected
advisory; `node scripts/audit-npm.mjs --prefix js` verifies the rejection and still
rejects actionable findings. `tests/tools/npm-audit.test.mjs` checks this exception,
other findings, changed status/identity, network errors, and malformed reports.

Python CI also found advisories in certifi 2026.7.22 and filelock 4.0.12.
Refresh only those packages in uv.lock and regenerate requirements.txt with the
locked uv export; existing Python unit tests and strict pip-audit verify the result.
