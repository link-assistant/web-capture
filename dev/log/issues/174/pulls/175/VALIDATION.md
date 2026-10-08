# Reproduction and validation

Issue: https://github.com/link-assistant/web-capture/issues/174
Pull request: https://github.com/link-assistant/web-capture/pull/175

Research was collected on 2026-10-08 UTC. Registry snapshots, all issue/PR
comment types, the previous dependency PR and major release notes are in
`data/`. Complete before/latest/after tables are in `DEPENDENCIES.md`.
Large transient logs are saved in the ignored repository `ci-logs/` directory.

## Reproduced failures and regression coverage

| Problem | Before evidence | Fix and automated verification |
| --- | --- | --- |
| Scaffold imports nonexistent `node:fetch` and duplicates stale service dependencies | `issue-174-scaffold-before.log:5`, `ERR_UNKNOWN_BUILTIN_MODULE` | `node experiments/issue-174/scaffold-probe.mjs` imports the maintained application and verifies all three original routes remain available; the default install still downloads Puppeteer's browser |
| Binary responses call deprecated node-fetch `buffer()` | `issue-174-buffer-before.log`, assertion finds one deprecation warning | `node experiments/issue-174/fetch-buffer-probe.mjs` verifies exact binary bytes and no buffer deprecation; all equivalent production paths use arrayBuffer |
| Existing npm bootstrap accepts obsolete npm versions | `issue-174-npm-version-before.log`, test fails against the original bootstrap | `tests/tools/npm-version.test.mjs` checks exact latest patch/major, successful no-op and installation/version failures |
| Private root tooling manifest redirects JS release paths | `issue-174-paths-before.log`, expected `js`, actual `.` | `tests/tools/js-paths.test.mjs` covers all package/lock/changeset paths and explicit overrides |
| Manual release from root versions the private package and cannot locate the JS changelog | `issue-174-root-release-before.log`, unchanged JS version and ENOENT CHANGELOG.md | The same test executes the real manual release in a temporary checkout, verifies only JS gets 1.0.1, and checks the changelog |
| npm 12 lock regeneration drops unpublished optional native package placeholders | `node experiments/issue-174/lockfile-probe.mjs --regenerate` fails with two Missing Kreuzberg musl errors, `issue-174-lockfile-probe.log:12-13` | Positive probe uses upstream npm version to synchronize release metadata and then verifies npm 12 clean installation; a compatible lock is generated once with npm 11.13.0 |
| Python examples hard-code a service address and cannot safely encode URL queries | `issue-174-python-before.log`, five errors against the local fixture | `uv run --locked python -m unittest discover -s tests/python -v` exercises every example with encoded URLs, Unicode HTML/Markdown, exact PNG bytes, Playwright parameters and connection failures |
| Shell-wrapper migration risks argument and failure semantics | Wrapper supplied shell commands and legacy `.code`; locked Execa uses argument arrays and `.exitCode` | `tests/tools/process.test.mjs` checks literal shell characters/newlines/quotes, array arguments, JSON stdin, captured E404 and rejecting mutation failures; existing publish verification tests cover propagation retries |
| Node 26 fixture closes its socket before body bytes are flushed | Existing stream test returned 500 instead of its expected 200 | Close only after the write callback; retain both partial-body and no-body assertions |
| Current Puppeteer returns Uint8Array screenshots | Existing browser integration Buffer-only assertion failed | Both real browser engines retain PNG signature, content-length and parity assertions using the current byte-array API |

## Local results

| Check | Result |
| --- | --- |
| JavaScript full existing suite, Node 26.11.1 / native ESM | 61 suites passed, 521 tests passed; 4 suites / 42 tests are pre-existing opt-in network skips |
| JavaScript ESLint / Prettier / jscpd | Passed; 226 clones, zero new clones; pre-existing complexity warnings remain |
| Locked root release-tool tests | 8 passed |
| Scaffold, binary response and npm 12 release-lock regressions | Passed |
| Python example tests, Python 3.14.8 / requests 2.34.2 | 2 passed, covering every script |
| npm 12 clean install for both manifests | Passed |
| npm audit, both complete locks | Zero vulnerabilities, JSON retained in data |
| cargo audit 0.22.2, complete shipped Rust lock | Zero vulnerabilities and zero warnings, JSON retained in data |
| pip-audit 2.10.1, complete Python environment | Zero vulnerabilities, JSON retained in data |
| Rust 1.99 / edition 2024 formatting | Passed |
| Rust minimal search/cache all-target Clippy | Passed with warnings denied |
| Rust minimal feature tests and docs | 10 library, 4 cache, 1 search and 1 doctest passed |
| Rust minimal dependency boundary / default TLS guard | Passed; no browser/server/runtime in search, no default OpenSSL |
| Rust direct dependency upgrades and full lock update | All direct crates already current; exact upstream constraints retain generic-array 0.14.7 and matchit 0.8.4 |
| JavaScript Trixie Docker build and Compose smoke tests | Final Node 26.10/Trixie/npm 12 image built; all five Compose endpoint smoke tests passed |
| Rust all-feature Clippy/build/test | Local all-feature compiler was killed by the 3 GB cgroup memory limit in generated chromiumoxide_cdp; verified minimal features locally and complete coverage remains enabled in CI |

Rust's resource failure is explicit: `issue-174-rust-clippy.log:312-315`
reports SIGKILL while compiling chromiumoxide_cdp 0.9.1, and
`/sys/fs/cgroup/memory.events` reports one OOM kill. The build already used
one worker and disabled debug symbols. No test, lint or feature was weakened
to accommodate the container; GitHub CI runs the full existing matrices.
Rust 2024's suggested let-chain migration is applied where current Clippy
requires it, with no lint suppression.

The Node 26 experimental VM Modules warning is inherent to Jest's native ESM
runner. The docx package also triggers Node's existing localStorage experimental
warning on import: it reproduces with the same pre-update docx 9.9.0. Neither
is a newly introduced dependency deprecation. Deprecated response.buffer calls
have been removed from every node-fetch path.

## CI investigation protocol and initial failure

List recent runs with creation timestamps and head SHA, compare them with the
current commit, download every failed run, read the actual errors and fix the
root cause. Preserve run metadata in `data/` and complete logs in `ci-logs/`.

Initial [JavaScript run 37735882034](https://github.com/link-assistant/web-capture/actions/runs/37735882034)
was created for prepared head `1ffeaa1`, before these updates. Its downloaded
log `javascript-37735882034.log:813-818` reports EUSAGE at
2026-10-08T06:12:09Z and missing
`@kreuzberg/html-to-markdown-node-linux-arm64-musl` and
`@kreuzberg/html-to-markdown-node-linux-x64-musl` lock entries. The standalone
lockfile experiment reproduces the same actual errors. Latest-head runs,
precise follow-up failures and final results will be recorded after pushing.

## Evidence-backed exceptions

- JS browser-commander remains 0.10.0 under existing [issue 160](https://github.com/link-assistant/web-capture/issues/160).
  Registry-current 0.26.3 still requires native better-sqlite3 13.0.3; packaged
  VSIX/desktop consumers cannot be validated from this repository. Preserve
  explicit blocker metadata and executablePath/channel forwarding tests.
- Node source/CI is 26.11.1. The latest published official Docker tag is
  26.10.0-trixie; the 26.11.1-trixie registry request returns 404. The supported
  engine floor covers that current image, and publication evidence is retained.
- Latest upstream parents retain older transitive API generations. Every
  installed slot and its actual parent requirements are listed in the inventory;
  incompatible overrides would not constitute a tested upstream migration.
- The ignored fresh-consumer lock is disposable research output, regenerated
  for the complete inventory. Keeping it ignored preserves the fixture's
  purpose of finding breaks in new consumers; the actual shipped Rust lock,
  both npm locks, uv.lock and hashed requirements export are committed.
- npm 11.13.0 is a one-time compatible lock generator for the upstream optional
  package defect. Runtime, CI, Docker and releases use npm 12.2.0.

No production endpoint, output format, cache behavior, opt-in feature or
existing assertion was removed. There are no visual UI changes.
