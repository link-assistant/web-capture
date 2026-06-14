# Issue 139 CI/CD false positives and errors

Issue: <https://github.com/link-assistant/web-capture/issues/139>

Pull request: <https://github.com/link-assistant/web-capture/pull/140>

## Scope

The issue requested a full investigation of false positives and errors in the
CI/CD runs linked from issue 139, plus a comparison with these pipeline
templates:

- `link-foundation/js-ai-driven-development-pipeline-template`
- `link-foundation/rust-ai-driven-development-pipeline-template`
- `link-foundation/python-ai-driven-development-pipeline-template`
- `link-foundation/csharp-ai-driven-development-pipeline-template`

Raw run metadata, logs, issue snapshots, and template comparisons are preserved
under `docs/case-studies/issue-139/data/`.

## Timeline

| Time (UTC)          | Event                                                                                                                            |
| ------------------- | -------------------------------------------------------------------------------------------------------------------------------- |
| 2026-06-14 16:12:38 | `Rust Checks and Release` run `27504645835` started for push `f4f5f08b4a483d3a17a167a6f242591851548493`.                         |
| 2026-06-14 16:12:38 | `JavaScript Checks and Release` run `27504645820` started for the same push.                                                     |
| 2026-06-14 16:12:43 | Both detect-change jobs logged `Merge commit detected (pull_request event)` even though the workflow event was `push`.           |
| 2026-06-14 16:12:43 | Both detect-change jobs emitted all primary code flags as `false`, including `any-code-changed=false`.                           |
| 2026-06-14 16:24:07 | The Rust Docker build failed because `rust:1.94-bullseye` provided `rustc 1.94.1`, while `rust/Cargo.toml` required Rust `1.96`. |
| 2026-06-14 16:25:23 | The JavaScript release completed and published `@link-assistant/web-capture@1.10.8`.                                             |
| 2026-06-14 20:12:00 | Issue 139 was opened.                                                                                                            |
| 2026-06-14 20:12:41 | PR 140's initial placeholder checks ran on `9db6dfc` and passed.                                                                 |

## Evidence

- Rust failed run: `data/rust-run-27504645835.log`,
  `data/rust-run-27504645835.json`.
- JavaScript run: `data/js-run-27504645820.log`,
  `data/js-run-27504645820.json`.
- Recent run list: `data/recent-runs.json`.
- Template workflow and detector comparisons:
  `data/js-workflow-vs-template.diff`,
  `data/rust-workflow-vs-template.diff`,
  `data/js-detect-script-vs-template.diff`,
  `data/rust-detect-script-vs-template.diff`.

Key log lines:

- `rust-run-27504645835.log:269` logged `Merge commit detected (pull_request event)` during a push event.
- `rust-run-27504645835.log:276` logged `rust-code-changed=false`.
- `rust-run-27504645835.log:289` logged `any-code-changed=false`.
- `rust-run-27504645835.log:9629` logged `rustc 1.94.1 is not supported`.
- `rust-run-27504645835.log:9630` logged that `web-capture@0.3.31` requires `rustc 1.96`.
- `js-run-27504645820.log:262` logged the same merge-event misclassification.
- `js-run-27504645820.log:283` logged `any-js-code-changed=false`.
- `js-run-27504645820.log:3578` logged the successful npm publish.

## Root Causes

### 1. Real push merges were classified as pull request merges

`scripts/detect-code-changes.mjs` treated every merge commit as a GitHub
Actions `pull_request` synthetic merge. That made it compare `HEAD^2^..HEAD^2`
for a real merge commit pushed to `main`.

That comparison only inspects the merged branch's final commit. If the branch's
final commit is docs-only, the detector can report no code changes even when
earlier commits in the same branch introduced JavaScript or Rust changes.

For real push merge commits, the detector must compare the first parent to the
merge commit: `HEAD^1..HEAD`.

### 2. The Rust Docker builder image lagged the crate MSRV

`rust/Cargo.toml` declares:

```toml
rust-version = "1.96"
```

`rust/Dockerfile` used `rust:1.94-bullseye`, which failed during dependency
builds with:

```text
web-capture@0.3.31 requires rustc 1.96
```

### 3. Workflow policy had drifted from the current templates

The JS and Rust workflows still used `actions/checkout@v4`, and the Rust
workflow still used `actions/cache@v4`. The failed run logs also contained
GitHub's Node 20 action-runtime deprecation warning.

The current templates use `actions/checkout@v6` and `actions/cache@v5`.

The release workflows also cancelled in-flight `main` runs when newer pushes
arrived. The current template policy keeps `main` release runs alive and only
cancels stale PR-branch runs.

## Template Comparison

The Python and C# templates already key change detection off
`GITHUB_EVENT_NAME`; they do not have the same merge-classification defect.

The JS and Rust templates had the same merge-commit detector pattern found in
this repository. Upstream issues were filed:

- JS template: <https://github.com/link-foundation/js-ai-driven-development-pipeline-template/issues/91>
- Rust template: <https://github.com/link-foundation/rust-ai-driven-development-pipeline-template/issues/81>

## Fixes

- `scripts/detect-code-changes.mjs` now uses the `HEAD^2^..HEAD^2` comparison
  only for `pull_request` events.
- Real merge commits on `push` events now compare `HEAD^1..HEAD`, detecting the
  full set of files introduced by the merge.
- `rust/Dockerfile` now uses `rust:1.96-bullseye`, matching the crate MSRV.
- GitHub workflows now use `actions/checkout@v6`.
- The Rust workflow now uses `actions/cache@v5`.
- Workflow concurrency now preserves in-flight `main` release runs and cancels
  stale PR branch runs.

## Regression Tests

Added tests:

- `js/tests/unit/detect-code-changes.test.js`
  - reproduces a real merge commit pushed to `main` where the final feature
    commit is docs-only but an earlier feature commit changed Rust code;
  - verifies that `pull_request` merge commits keep the existing PR-head
    per-commit behavior;
  - verifies first-commit pushes fall back to listing files in `HEAD`.
- `js/tests/unit/rust-dockerfile.test.js`
  - verifies the Docker builder Rust version matches `rust/Cargo.toml`.
- `js/tests/unit/workflow-policy.test.js`
  - verifies current checkout/cache action versions and release-safe
    concurrency.

Focused verification:

```sh
cd js
npm test -- --runTestsByPath tests/unit/detect-code-changes.test.js tests/unit/rust-dockerfile.test.js tests/unit/workflow-policy.test.js
```

Result: 3 suites passed, 11 tests passed. The log is preserved at
`data/verification-focused-jest.log`.

Additional local verification:

- `npm run lint`: passed with 0 errors and existing complexity warnings. Log:
  `data/verification-npm-lint.log`.
- `npx prettier --check ...`: passed. Log:
  `data/verification-prettier-check.log`.
- `cargo fmt --all -- --check`: passed. Log:
  `data/verification-cargo-fmt.log`.
- `cargo clippy --all-targets --all-features -- -D warnings`: passed. Log:
  `data/verification-cargo-clippy.log`.
- `cargo test --all-features --verbose`: passed, including doc tests. Log:
  `data/verification-cargo-test.log`.
- `docker build -t web-capture-rust-issue-139 .` from `rust/`: passed. Log:
  `data/verification-docker-build-rust.log`.

The full local `npm test` command was also attempted. It is not a clean local
signal in this workspace because the browser integration tests require
Playwright browser binaries that are not installed, and Docker e2e setup is
normally prepared by the workflow before those tests run. The failures were:

- missing Playwright executable under `~/.cache/ms-playwright`;
- Docker e2e `beforeAll` hook timeout.

The full-test attempt log is preserved at `data/verification-npm-test.log`.
