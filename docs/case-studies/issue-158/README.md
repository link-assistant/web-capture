# Issues 153–158: dependency security, packaged browsers and capture replay

Implementation and review: [PR #159](https://github.com/link-assistant/web-capture/pull/159).
Research date: 2026-10-07. The parent issue and every sub-issue/comment were read;
none of the five defects was already resolved. Registry inventories are retained
in [data](data/), and reproducible probes are in [experiments](../../../experiments/issue-158/).

## Complete requirement inventory and solution plans

Each row records a separate requirement, its alternatives, and the selected plan.

| Source               | Requirement                                                                    | Alternatives considered                                                                              | Selected solution and verification                                                                                                            |
| -------------------- | ------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------- |
| #158 R1              | Read and implement every sub-issue, including comments                         | Fix only the two security findings; implement all five                                               | Read #153–157, consumer tracking and recent transport/search/TLS PRs; implement all five                                                      |
| #158 R2              | One PR; no listed issue deferred                                               | Separate dependency/cache PRs                                                                        | Keep all implementation, regressions, documentation and release preparation in #159                                                           |
| #158 R3–4            | Close parent and all children with one full keyword per issue                  | Comma-separated references are insufficient                                                          | Include separate `Fixes #153` through `Fixes #158` lines in the PR body                                                                       |
| #158 R5              | Explicitly report already resolved/non-reproducible work, retaining references | Assume issue reports remain accurate                                                                 | Reproduce each defect; report that all five required changes                                                                                  |
| #153                 | Remove vulnerable Puppeteer 24 → browsers → extract-zip chain                  | Update extract-zip; downstream override; upgrade upstream Puppeteer                                  | Upgrade puppeteer and puppeteer-core together to 25.12.0; lockfile probe asserts extract-zip is absent                                        |
| #153                 | Exercise both capture engines in CI                                            | Unit mocks alone; browser integration                                                                | Retain both-engine capture tests and add explicit packaged-path browser integration                                                           |
| #153                 | Required moderate-level audit over the complete lockfile                       | Informational install warnings; production-only audit                                                | Add `npm audit --package-lock-only --audit-level=moderate` job; gate automatic and manual releases                                            |
| #153 comment         | Bundled consumers must retain Playwright as external production packages       | Inline Playwright; externalize its packages                                                          | Document external `playwright` and `playwright-core`; update Puppeteer ESM/async CI calls                                                     |
| #153 comment, #154   | Compatible browser-commander dependency floor                                  | Patch launcher locally; upgrade to first compatible release; latest release with native dependencies | Pin JS browser-commander 0.10.0, honoring the issue's explicit packaging constraint                                                           |
| #154                 | Forward executablePath and channel to BOTH underlying engines                  | Mock createBrowser, which would miss the upstream loss; stub actual engines                          | Stub Puppeteer launch and Playwright launchPersistentContext while executing the real commander launcher                                      |
| #154                 | Render from an explicit temporary packaged executable                          | Use engine cache/default discovery; temporary symlink to Chromium                                    | Launch both engines with a temporary executable path and render deterministic local JavaScript HTML                                           |
| #155                 | Raise scraper to an fxhash-free version, latest 0.27                           | Scraper 0.24 is insufficient; advisory ignore; fork selectors                                        | Scraper 0.27.0 resolves selectors 0.38/rustc-hash; assert fxhash absent from Cargo.lock                                                       |
| #155                 | Preserve search-only and full-runtime builds                                   | Enable runtime to obtain cache/transport types                                                       | Keep search feature minimal; test it independently, along with full runtime                                                                   |
| #156                 | Cache over ANY caller-owned Transport                                          | HTTP-specific middleware; reusable decorator                                                         | Add CachedTransport and CaptureStore to Rust and JS; Rust cache feature selects no HTTP client or executor                                    |
| #156                 | Key by request                                                                 | URL only risks method/auth collisions; canonical request tuple                                       | SHA-256 of UTF-8 JSON `[1, url, method, sorted header pairs]`; isolate URL queries, methods and all header values                             |
| #156                 | Store exact bytes addressed by SHA-256                                         | Decoded HTML; duplicate body per request; shared binary objects                                      | Store bodies/<sha256>, verify hash on load/import, deduplicate identical responses                                                            |
| #156                 | Retain fetch time, URL, headers and complete response receipt                  | Reconstruct a subset on replay                                                                       | Versioned request metadata retains Unix milliseconds and the unchanged receipt, including final URL, status, headers and diagnostics          |
| #156                 | Configurable TTL                                                               | HTTP Cache-Control middleware; application TTL                                                       | Default 60 days matching the consumer; injectable clock, exact expiry boundary and zero-TTL behavior                                          |
| #156                 | Offline serves ONLY cache; no network on miss                                  | Transparent fallback; explicit offline error                                                         | Offline miss returns offline_cache_miss; forbidden mock transport proves zero network calls                                                   |
| #156                 | Online expired entries refetch                                                 | Return stale online; refetch and replace                                                             | Refetch expired entries; retain previous evidence if the transport fails                                                                      |
| #156                 | Offline expired entries return stale-with-flag                                 | Mutate receipt diagnostics; separate provenance                                                      | CachedCapture exposes cached/stale separately, leaving the receipt identical                                                                  |
| #156                 | Committable versioned replay format                                            | Binary-only store; platform-specific database; portable JSON                                         | Export/import JSON with byte arrays, version and both hashes; JS and Rust consume the same committed binary fixture                           |
| #156                 | List and prune captures                                                        | Manual directory deletion; explicit maintenance API                                                  | List sorted metadata; prune expired requests and orphan bodies while retaining shared live bodies                                             |
| #156                 | Fetch, offline replay, stale/refetch regression scenarios                      | Live network tests with wall-clock sleeps                                                            | Fake transports/clocks and temporary stores assert complete receipt equality and exact call counts                                            |
| #157 R1              | Latest async-tungstenite                                                       | Remain on 0.27; latest 0.35                                                                          | 0.35.0; convert WebSocket text into Utf8Bytes and remove obsolete SinkExt import                                                              |
| #157 R1              | Latest base64                                                                  | Keep 0.22; latest                                                                                    | 0.23.1; existing Engine API remains compatible                                                                                                |
| #157 R1              | Latest Rust browser-commander                                                  | Issue's dated 0.12.1; current registry latest                                                        | 0.19.0; existing engine wrapper APIs compile; previously necessary OpenSSL exception is removed                                               |
| #157 R1              | Latest reqwest and API adaptations                                             | 0.12; 0.13 default TLS; explicit rustls features                                                     | 0.13.5, default-features=false, rustls replaces rustls-tls, explicit query feature; preserve charset/cookies/gzip/http2 and native-tls opt-in |
| #157 R1              | Latest scraper                                                                 | 0.25 minimum; current latest                                                                         | 0.27.0, shared with #155; every parser uses compatible Html/Selector/ElementRef/Node APIs                                                     |
| #157 R1              | Latest tower-http                                                              | Keep 0.6; latest                                                                                     | 0.7.1; cors/trace APIs remain compatible                                                                                                      |
| #157 R1              | Latest zip                                                                     | Keep 4; latest                                                                                       | 8.6.0, retain deflate and SimpleFileOptions; archive regressions verify outputs                                                               |
| #157 standing policy | Every direct production/development dependency current                         | Only seven Rust rows; registry inventory of both packages                                            | Upgrade all Rust and JS direct/dev dependencies; sole deliberate JS pin has an open explanatory blocker                                       |
| #157 R1              | List each breaking API change in PR                                            | List version numbers only                                                                            | Record Rust/JS API, configuration, engine, test and tooling migrations below and in PR body                                                   |
| #157 R2              | Run cargo update; dry-run has no pending package Updating lines                | Update direct crates only; resolve all compatible transitive updates                                 | Fully update Cargo.lock and require clean dry-run in CI                                                                                       |
| #157 R3              | Fail CI for stale direct dependencies                                          | cargo-outdated/npm outdated alone; registry check with live blockers                                 | Check resolved direct dependencies against stable/latest registries; absent, closed or unverifiable blocker fails                             |
| #157 R3              | Blocker must identify OPEN issue and reason in manifest                        | Permanent ignore; unchecked issue URL                                                                | Rust accepts dependency-line `# <GitHub issue URL> <reason>`; JSON uses dependencyBlockers with issue/reason; query GitHub issue state        |
| #157 R4              | Publish updated crates.io/npm releases                                         | Publish unreviewed branch; existing main release workflows                                           | Prepare Rust 0.4.0/changelog and npm minor changeset; dependency health gates both automatic/manual workflows; publication follows merge      |
| #157 verification    | Fresh consumer resolves one copy of each table dependency                      | Check only this repository's lockfile                                                                | Retain a fresh consumer manifest experiment with latest seven direct requirements and inspect its resolution                                  |
| Repository parity    | Apply shared features to both implementations and docs                         | Rust-only cache; independent incompatible replay formats                                             | Matching public APIs, shared replay fixture, README/API guide and executable examples in both packages                                        |

## Root causes and observed evidence

The baseline npm install reported 75 advisories (1 low, 9 moderate, 62 high,
3 critical). The original Puppeteer range could not reach the archive replacement
in version 25. Baseline audit output identified the actual current extract-zip
advisories; advisory feeds change, so the implementation verifies the dependency
is removed and runs the complete audit rather than matching one historical ID.

The packaged-browser unit regression failed for both engines against commander
0.8.1: their actual launch options omitted executablePath/channel. Commander
0.10.0 passes without a local launcher fork. Later JavaScript releases add
better-sqlite3, so [open blocker #160](https://github.com/link-assistant/web-capture/issues/160)
records the explicit #154 constraint after #154 closes. This does not defer any
listed defect. Rust's current commander has no corresponding packaging blocker.

The baseline Rust tree contained scraper 0.21 → selectors 0.26 → fxhash 0.2.1.
Cargo cannot cross the scraper 0.x minor range. The updated graph removes fxhash
entirely, rather than silencing RUSTSEC-2025-0057. Previously missing JS/Rust cache
imports made the deterministic cache reproductions fail before implementation.

The fresh-consumer experiment unifies each of the seven direct requirements with
web-capture's latest version. The stronger requested whole-graph single-copy check
still fails for three upstream dependency ranges:

- async-tungstenite 0.32.1 comes from chromiumoxide 0.9.1 under browser-commander
  0.19.0, alongside the direct 0.35.0 copy.
- base64 0.22.1 comes from chromiumoxide, fantoccini and webdriver under
  browser-commander, alongside the direct 0.23.1 copy.
- tower-http 0.6.11 comes from reqwest 0.13.5, alongside the direct 0.7.1 copy.

These are ranges in the latest published upstream packages. Updating Cargo.lock
cannot cross those ranges. Forking browser engines/reqwest or removing existing
engines would expand the requested change considerably. The experiment reports
these paths and retains `--strict` to reproduce the remaining failure; this PR
does not claim a globally duplicate-free graph. Published upstream manifest
sources: [chromiumoxide](https://docs.rs/crate/chromiumoxide/0.9.1/source/Cargo.toml),
[fantoccini](https://docs.rs/crate/fantoccini/0.22.1/source/Cargo.toml),
[reqwest](https://docs.rs/crate/reqwest/0.13.5/source/Cargo.toml).

## Reusable components researched

| Component                                                                                                                        | Useful capability                                  | Decision                                                                                                                                                                      |
| -------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [cacache (Rust)](https://docs.rs/cacache/latest/cacache/) and [cacache (npm)](https://github.com/npm/cacache)                    | Content-addressed integrity-checked binary storage | Good general storage, but still requires request keys, exact receipt metadata, TTL, offline state and portable replay schema; use a small shared format with standard SHA-256 |
| [http-cache](https://docs.rs/http-cache/latest/http_cache/)                                                                      | RFC HTTP cache middleware with storage backends    | HTTP/client middleware and Cache-Control semantics differ from an arbitrary Transport and application TTL; do not impose an HTTP stack                                        |
| [sha2](https://docs.rs/sha2/latest/sha2/) and [tempfile](https://docs.rs/tempfile/latest/tempfile/)                              | Cryptographic hash and safe atomic replacement     | Reuse these crates for the Rust implementation; JS uses node:crypto and atomic filesystem operations                                                                          |
| [cargo-outdated](https://github.com/kbknapp/cargo-outdated) and [npm outdated](https://docs.npmjs.com/cli/commands/npm-outdated) | Direct dependency freshness                        | Their basic exit codes do not validate live issue blockers; wrap registry/metadata checks in a small tested policy script                                                     |

## API and tooling migrations handled

- Reqwest 0.13 renames rustls-tls to rustls and gates query serialization behind
  query. Keep default TLS disabled; upgraded commander also removes the old
  fantoccini/native-tls route, so the default graph must contain no openssl-sys.
- async-tungstenite text messages use Utf8Bytes; `.into()` adapts strings.
- sha2 0.11 digest arrays no longer implement LowerHex; encode digest bytes
  explicitly in the new cache implementation.
- Puppeteer 25 is ESM and executablePath is asynchronous. Browser installation
  CI uses module import/await; Puppeteer downloads use PUPPETEER_SKIP_DOWNLOAD.
- he 2 uses named ESM exports; every importing module uses a namespace import.
- Nock 15 is ESM. CommonJS preload uses its default namespace export, and a
  shared suite helper restores interceptors when Jest changes VM contexts.
- Jest 30 renames testPathPattern to testPathPatterns throughout workflows/docs.
- ESLint 10 adds no-useless-assignment/preserve-caught-error checks: remove an
  unnecessary Google Docs model copy and preserve the e2e response error cause.
- jscpd 5 uses a Rust engine, validates format names and replaces skipComments
  with mode=weak. The previous format=console did not name a language. Scan real
  formats and fail on any new clone relative to origin/main; legacy duplicates
  remain visible in the report. Checkout full history so the comparison works.
- Node minimum is 22.22.1 for upgraded tooling; CI and Docker use 24. Docker and
  development scripts use the audited npm lockfile. Yarn Classic cannot resolve
  the latest HTML converter's unpublished optional musl artifacts even with
  ignore-optional; retain npm as the reproducible package manager and remove the
  competing Yarn lockfile rather than keep an unusable install path.
- A scoped Istanbul loader js-yaml 4 override removes its old argparse/sprintf-js
  advisory. Its yaml.load usage is compatible; Jest coverage remains exercised.
- The latest HTML converter references two unpublished optional musl packages.
  Current npm install omits their inert lockfile placeholders, and npm ci then
  rejects its own generated lockfile (also reproduced in Docker). Regenerating
  with `npx --yes npm@11.13.0 install --package-lock-only --ignore-scripts`
  retains the optional placeholders; current npm ci then works without changing
  any dependency version. This matches [npm/cli #9846](https://github.com/npm/cli/issues/9846).
  Keep this generation command while that upstream bug remains open. GNU Linux,
  macOS and Windows native artifacts are published; the optional musl artifacts
  remain unavailable upstream.
- Docker verification found that both package-install retry loops returned
  success even when all three attempts failed. A finite mock shell test failed
  for both Dockerfiles before the fix and now requires a nonzero exit after the
  third failure. Retries refresh package indexes. Rust's runtime image uses
  Bookworm after Bullseye package downloads returned 404s during verification.

Primary migration/security references: [Puppeteer v25](https://github.com/puppeteer/puppeteer/releases/tag/puppeteer-v25.0.0),
[async executablePath](https://pptr.dev/api/puppeteer.executablepath),
[Playwright bundling](https://github.com/microsoft/playwright/issues/33031),
[reqwest 0.13 features](https://docs.rs/reqwest/0.13.5/reqwest/),
[fxhash advisory](https://rustsec.org/advisories/RUSTSEC-2025-0057.html),
[Jest 30 upgrade guide](https://github.com/jestjs/jest/blob/main/docs/UpgradingToJest30.md),
[Nock Jest cleanup](https://github.com/nock/nock#memory-issues-with-jest),
[jscpd 5 migration](https://github.com/kucherenko/jscpd/blob/master/docs/rust.md).

## Verification protocol

1. Run the dependency regression probe, full npm moderate audit, direct
   freshness policy and cargo update dry-run. Keep verbose logs in ci-logs.
2. Run both browser launch-option regressions and packaged executable tests.
3. Run deterministic cache tests in both implementations with the shared fixture,
   including exact receipts, TTL boundary, offline miss, failed refresh, corruption,
   request isolation and shared-body pruning.
4. Run JS lint/format/duplication and complete tests/Docker integration. Run Rust
   fmt/clippy/all-feature tests, minimal search/cache, TLS guard and fresh consumer
   resolution. Local Rust compilation uses one worker/debug=0 for the 3 GiB host.
5. Review PR diff and updated description; fetch default branch before push.
6. Inspect current CI run timestamps and SHA. Preserve failed run logs in
   ci-logs/<workflow>-<run>.log, report precise failures, fix them, and wait for the
   latest commit's checks to pass before marking #159 ready.

The release artifacts are prepared in this PR. Actual publication requires the
existing protected-main workflows after merge; no release has been claimed from
the development branch.
