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
| npm 12 lock regeneration drops placeholders for unpublished requested optional native versions | `node experiments/issue-174/lockfile-probe.mjs --regenerate` fails with two Missing Kreuzberg musl errors, `issue-174-lockfile-probe.log:12-13` | Positive probe uses upstream npm version to synchronize release metadata and then verifies npm 12 clean installation; a compatible lock is generated once with npm 11.13.0 |
| Generated scaffold's default install drops the same placeholders | `issue-174-scaffold-lock-before.log:12-13`, missing both musl lock entries | `node experiments/issue-174/scaffold-install-probe.mjs` executes the actual default install, verifies npm 12 clean installation and checks browser installation remains permitted |
| Docs-only tail commits hide earlier PR code changes from CI | `issue-174-pr-diff-before.log:10-23`, expected Rust changes true, actual false; latest full test matrices were skipped | `js/tests/ci/detect-code-changes.test.js` tests full PR detection, real merge pushes, genuinely docs-only PRs and exclusion of base-branch-only code changes |
| Python examples hard-code a service address and cannot safely encode URL queries | `issue-174-python-before.log`, five errors against the local fixture | `uv run --locked python -m unittest discover -s tests/python -v` exercises every example with encoded URLs, Unicode HTML/Markdown, exact PNG bytes, Playwright parameters and connection failures |
| Shell-wrapper migration risks argument and failure semantics | Wrapper supplied shell commands and legacy `.code`; locked Execa uses argument arrays and `.exitCode` | `tests/tools/process.test.mjs` checks literal shell characters/newlines/quotes, array arguments, JSON stdin, captured E404 and rejecting mutation failures; existing publish verification tests cover propagation retries |
| Node 26 fixture closes its socket before body bytes are flushed | Existing stream test returned 500 instead of its expected 200 | Close only after the write callback; retain both partial-body and no-body assertions |
| Current Puppeteer returns Uint8Array screenshots | Existing browser integration Buffer-only assertion failed; enabled Wikipedia live suite exposed the same assumption in another file | Browser-engine, Wikipedia and GitHub suites all accept the current byte-array API and retain PNG signature, size and engine parity assertions; HTTP binary parser assertions still require their actual Buffer contract |

## Local results

| Check | Result |
| --- | --- |
| JavaScript full existing suite, Node 26.11.1 / native ESM | 61 suites passed, 523 tests passed; 4 suites / 42 tests are pre-existing opt-in network skips |
| JavaScript ESLint / Prettier / jscpd | Passed; shared PNG assertions reduce clones from 226 to 224, zero new clones; pre-existing complexity warnings remain |
| Real browser-engine, Wikipedia and GitHub screenshot suites | 16 passed with live integration gates enabled and open-handle tracing; exact PNG signature, original size thresholds, Markdown content and both engines verified |
| Locked root release-tool tests | 8 passed |
| Scaffold, binary response and npm 12 release-lock regressions | Passed |
| Python example tests, Python 3.14.8 / requests 2.34.2 | 2 passed, covering every script |
| npm Python-example entrypoint | `python-entrypoint-probe.py` exercises the actual npm command against the local fixture; it uses the locked uv project |
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
| Rust all-feature Clippy/build/test | Local all-feature compiler was killed by the 3 GB cgroup memory limit in generated chromiumoxide_cdp; minimal features verified locally, full coverage passed on CI |
| Rust final Trixie Docker image and release package | CI release compilation, package listing and complete Docker build passed |

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

[Rust run 37741228883](https://github.com/link-assistant/web-capture/actions/runs/37741228883)
was created at 07:04:35Z for `9582e21`. Its downloaded and color-stripped log
`rust-37741228883-clean.log:1898-2389` identifies 23 `collapsible_if` errors
in runtime modules, now eligible for Rust 2024 let chains. Apply the exact
short-circuit-preserving suggestions; keep all warnings denied. The other three
workflows passed for that SHA, including all four security audits. However,
per-commit change detection skipped full test matrices after the research
commit, so those green workflows did not yet prove full validation. A failing
Git-fixture regression reproduces that gap; complete PR change detection fixes
it before the next full run. Canceled superseded runs had no completed job logs;
their CLI responses and timestamp/SHA snapshots are retained.

The complete matrices ran for `16f63a3`, created at 07:30:22Z.
[Rust run 37743839902](https://github.com/link-assistant/web-capture/actions/runs/37743839902)
passed all tests and doctests on Linux, macOS and Windows, all four enabled
live integration groups on each platform, fresh consumer resolution and the
bare-container build without system OpenSSL. Its remaining CLI-only Clippy
error is recorded in `rust-lint-37743839902.log:456-494`: the image extraction
guard at main.rs:323 requires one more Rust 2024 let chain. Apply the suggestion
and keep the release/Docker build gate intact.

[JavaScript run 37743839957](https://github.com/link-assistant/web-capture/actions/runs/37743839957)
passed the standard suite, Habr live tests and all 27 Google Docs tests, but
`javascript-37743839957.log:4577-4593` reports expected Buffer, received Uint8Array
in Wikipedia's screenshot test. The same stale assertion exists in GitHub's
live screenshot suite. Update both suites, preserving signature and size checks
and leaving HTTP Buffer assertions intact. Security and parity workflows passed
for this SHA. These are actual current-code diagnostics, rather than stale
failures from the prepared branch; run timestamps and SHA are retained in data.

## Complete implementation CI receipt

All four workflows created at 2026-10-08T07:48:01Z passed for implementation SHA
`59c9a0e1b666310cbae6f43aeb0b58d222fe5f1a`:

| Workflow | Full validation actually executed |
| --- | --- |
| [JavaScript 37745680526](https://github.com/link-assistant/web-capture/actions/runs/37745680526) | 518 standard tests; Habr 16, Google Docs 27, Wikipedia 5, GitHub 4 and StackOverflow 7 enabled live tests; final-image Docker build and 5 endpoint tests; lint, format, duplication, changeset and freshness checks |
| [Rust 37745680454](https://github.com/link-assistant/web-capture/actions/runs/37745680454) | All-feature/all-target Clippy with warnings denied; full tests, doctests and all four live integration groups on Linux, macOS and Windows; fresh consumer resolution; bare image without OpenSSL; release compilation, package listing and final Docker image build |
| [Security/tooling 37745680448](https://github.com/link-assistant/web-capture/actions/runs/37745680448) | Eight release-tool tests; scaffold/default-install/binary/release-lock probes; every Python example; complete npm, Cargo and Python audits with zero findings |
| [Parity 37745680617](https://github.com/link-assistant/web-capture/actions/runs/37745680617) | Required JavaScript/Rust source and test parity |

Only release publishing and manual release-PR jobs were skipped, as intended
for a pull request. Full test/build jobs executed; they were not bypassed by the
evidence-only tail commit. Run receipts and test summary lines are retained in
`data/ci-validated-source-head.json`. Subsequent research refinements preserve the
same locks and runtime behavior; the [PR's current-head checks](https://github.com/link-assistant/web-capture/pull/175/checks)
are the final gate before marking it ready.

## Evidence-backed exceptions

- JS browser-commander remains 0.10.0 under existing [issue 160](https://github.com/link-assistant/web-capture/issues/160).
  Registry-current 0.26.3 still requires native better-sqlite3 13.0.3; packaged
  VSIX/desktop consumers cannot be validated from this repository. Preserve
  explicit blocker metadata and executablePath/channel forwarding tests.
- Node source/CI is 26.11.1. The latest published official Docker tag is
  26.10.0-trixie; the 26.11.1-trixie registry request returns 404. The supported
  engine floor covers that current image, and publication evidence is retained.
- Playwright 1.64's matching prebuilt Noble browser image is not yet published
  (MCR returns 404; its tag list ends at 1.63.0-noble). CI retains the existing
  matching-version CDN fallback; it does not install an incompatible older
  prebuilt browser. Raw tag and manifest responses are retained in data.
- Latest upstream parents retain older transitive API generations. Every
  installed slot and its actual parent requirements are listed in the inventory;
  incompatible overrides would not constitute a tested upstream migration.
- The ignored fresh-consumer lock is disposable research output, regenerated
  for the complete inventory. Keeping it ignored preserves the fixture's
  purpose of finding breaks in new consumers; the actual shipped Rust lock,
  both npm locks, uv.lock and hashed requirements export are committed.
- npm 11.13.0 is a one-time compatible lock generator for the upstream optional
  version defect: both Kreuzberg musl packages have latest 3.5.5, but their parent
  requires unavailable 3.7.2. Exact-version registry 404 responses and unversioned
  lock placeholders are explicitly recorded in the complete inventory.
  Runtime, CI, Docker and releases use npm 12.2.0.

No production endpoint, output format, cache behavior, opt-in feature or
existing assertion was removed. There are no visual UI changes.
