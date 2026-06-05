# Case Study: Issue #94 — Rust CI/CD release is broken

- Issue: https://github.com/link-assistant/web-capture/issues/94
- Failing run: https://github.com/link-assistant/web-capture/actions/runs/24686173280/job/72197673668
- Head SHA under test: `4a3dc433a560210b8bc08ff77711382bf2468dc1`
  (merge of PR #93 — Google Docs capture fixes)
- PR fixing this issue: #95 (branch `issue-94-2e4653a0a183`)

## Timeline / sequence of events

All timestamps UTC from the workflow log (download with
`gh run view 24686173280 --repo link-assistant/web-capture --log`; the logs
folder is `.gitignore`d):

| Time | Event |
| --- | --- |
| 19:31:12 | Two workflows start simultaneously on the same push-to-`main` event (merge of PR #93): `JavaScript Checks and Release` (run 24686173274) and `Rust Checks and Release` (run 24686173280). |
| 19:31:17 | Rust `detect-changes` sees `rust-code-changed=false` for the JS-only PR merge. |
| 19:32:03 – 19:34:35 | Rust test matrix runs on `4a3dc43…` (green on ubuntu / macos / windows). |
| 19:42:15 | Rust `build` job finishes. |
| 19:42:18 | Rust `release` job starts on base commit `4a3dc43…`. |
| ~19:42:19 | Meanwhile the JS `release` job (which had parallel workspace) runs `instant-version-bump.mjs` (patch), commits `1.7.10` and pushes to `main` → new head `aef6f59`. |
| 19:42:49 | Rust `release_check` decides `should_release=true`, `needs_auto_bump=true` (publishable paths changed since `rust-v0.3.2`). |
| 19:42:51 | `rust-version-bump.mjs` bumps Cargo.toml 0.3.2 → 0.3.3, commits `c6f4e7c` on top of local `4a3dc43…`, then `git push origin main` fails: `! [rejected] main -> main (non-fast-forward)`. |
| 19:42:51 | Release job exits with code 1. All later steps (`Determine release version`, `Build release`, `Publish to crates.io`, `Create GitHub Release`) are skipped. |

Net effect: the JS release (npm `1.7.10`) went out; the Rust release (crates.io `0.3.3`) was never published, and `rust/src/browser.rs` + `rust/src/gdocs.rs` changes from PR #93 remain unreleased.

## Root cause

The Rust `release` job's `Auto-bump patch version for unreleased changes` step does **not** sync with `origin/main` before committing and pushing, and has **no retry**:

```yaml
# .github/workflows/rust.yml  (broken)
- name: Auto-bump patch version for unreleased changes
  if: steps.release_check.outputs.should_release == 'true' && steps.release_check.outputs.needs_auto_bump == 'true'
  id: auto_bump
  run: |
    git config user.name "github-actions[bot]"
    git config user.email "github-actions[bot]@users.noreply.github.com"
    node ../scripts/rust-version-bump.mjs --bump-type patch --description "Auto-release unreleased changes"
    git add -A
    NEW_VERSION=$(grep -m1 '^version' Cargo.toml | sed 's/.*"\(.*\)"/\1/')
    git commit -m "chore(rust): auto-bump to ${NEW_VERSION} for unreleased changes"
    git push origin main     # <-- fails with non-fast-forward when JS release pushed first
```

Because the JS and Rust workflows both trigger on the same `push` event to `main` and both try to auto-bump and push to `main`, whichever one finishes its auto-bump first "wins" and the other gets `! [rejected] main -> main (non-fast-forward)`.

### Why the concurrency guard didn't help
Each workflow has its own per-workflow concurrency group (`${{ github.workflow }}-${{ github.ref }}`). JS and Rust workflows are different workflows, so they can run concurrently. They must — JS needs its own `npm` auth context. The right fix is to make the pushes tolerant to each other (fetch + rebase + retry), not to serialize the whole workflow.

### The same anti-pattern also exists in JS auto-bump
`.github/workflows/js.yml` uses the same inline pattern (`instant-version-bump.mjs → git commit → git push origin main`) with no fetch/rebase/retry. In this run JS won the race; a symmetric run where Rust pushes first would have broken JS. The upstream JS template already got this right (`scripts/version-and-commit.mjs` has `git fetch origin main` + rebase before commit), and the JS `publish-to-npm.mjs --should-pull` also pulls before publishing — but neither path is used by the auto-bump block, so the window of races stays open.

## Upstream template comparison

- `link-foundation/rust-ai-driven-development-pipeline-template` (`scripts/version-and-commit.rs`) does:
  - `git fetch origin <branch>` before committing, and rebases if behind.
  - **Retries** `git push` up to 3 times, running `git pull --rebase origin <branch>` between attempts.
  - Pushes `--tags` separately after the commit push succeeds.
- `link-foundation/js-ai-driven-development-pipeline-template` (`scripts/version-and-commit.mjs`) does `git fetch origin main` + rebase before committing (handled by `version-and-commit.mjs`, which is only invoked in the **changeset** path in our repo — the **auto-bump** path uses raw inline shell without this protection).

So the templates already contain the best practice; this repo copied an older / truncated version of the auto-bump block that doesn't invoke the sync-aware script. The issue should also be reported upstream in the Rust template, since the auto-bump path in the current template's `release.yml` only works because `version-and-commit.rs` is always used — but if other templates or downstream repos copy the inline block, they inherit the bug. (See `proposed-upstream-issue.md`.)

## Requirements extracted from the issue

1. **R1:** Find the root cause of the failed CI/CD release (issue #94).
2. **R2:** Compare every workflow / CI-CD script in this repo against the two upstream templates and reuse best practices.
3. **R3:** Compile all related logs and data into `docs/case-studies/issue-94/` for reconstructable case study.
4. **R4:** Reconstruct timeline, enumerate requirements, identify root causes, and propose solution(s) for each requirement.
5. **R5:** Report the same issue upstream if the template is affected, with reproducible example, workaround and suggested fix.
6. **R6:** Add debug output / verbose mode if the current data is insufficient to pin down the root cause.

## Solution plan

### R1 — Fix the Rust release race (chosen solution)

Make the Rust auto-bump step "race-safe" by teaching it to fetch, rebase if behind, push with retries, and resync between retries. Two matching touch points:

1. `.github/workflows/rust.yml` — replace the inline shell with a call to a dedicated `scripts/rust-version-and-commit.mjs` flow that does the same safe-push dance the JS template already does.
2. `scripts/rust-version-and-commit.mjs` — already exists for manual instant release; extend it to support auto-bump (pre-fetch / rebase / retryable push) so both manual and auto release paths share one race-safe implementation.

Apply the same hardening to the JS auto-bump inline shell to prevent the mirror-image race.

### R2 — Cross-compare scripts
Done (see `upstream-templates/`). The one concrete bug found is the missing fetch-rebase-retry in both auto-bump steps. All other workflow structure (detect-changes, concurrency groups, permissions, OIDC, etc.) already matches the templates.

### R3/R4 — Case study
This document plus `upstream-templates/` (reference files) complete R3/R4. The
raw CI logs for run 24686173280 were reviewed during analysis but not
committed because the repo `.gitignore` excludes `*.log` — retrieve them with
`gh run view 24686173280 --repo link-assistant/web-capture --log` if needed.

### R5 — Upstream issue
Drafted in `proposed-upstream-issue.md`. To be filed under `link-foundation/rust-ai-driven-development-pipeline-template` (the repo whose template is used here) as a defensive hardening suggestion so multi-package monorepos using both the JS and Rust templates never hit this race.

### R6 — Debug / verbose
Added `DEBUG` / `--verbose` support so the next failure (if any) prints `git remote -v`, `git rev-parse HEAD`, `git rev-parse origin/main`, and the full push stderr.

## How to reproduce locally

```bash
# Simulate the race: two clones of main try to commit+push concurrently.
git clone https://github.com/link-assistant/web-capture.git repo-a
git clone https://github.com/link-assistant/web-capture.git repo-b
cd repo-a && echo "# a" >> rust/CHANGELOG.md && git add -A && git commit -m "a" && git push origin main &
cd ../repo-b && echo "# b" >> rust/CHANGELOG.md && git add -A && git commit -m "b" && git push origin main &
wait
# Exactly one of the two pushes is rejected with:
#   ! [rejected]        main -> main (non-fast-forward)
```

## Verification after fix

- Dry-run: `node scripts/rust-version-and-commit.mjs --bump-type patch --dry-run` (added verbose mode) executes fetch/rebase/retry path in a clean clone without pushing.
- Real run: manual `workflow_dispatch` → `instant` release on a feature branch simulating divergence still succeeds.
- Observed from CI: next merge to `main` that triggers both JS and Rust release concurrently publishes both npm and crates.io releases without a non-fast-forward error.
