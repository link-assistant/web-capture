# Case Study: Issue #50 — Skip CI tests on non-code file changes

## Problem Statement

When a commit in a pull request only modifies non-code files (e.g., `.gitkeep`, `.md` files in excluded folders), CI still runs the full test suite because GitHub Actions `paths:` filters operate at the **PR level**, not the individual commit level.

## Root Cause

### The `paths:` filter limitation

Both `js.yml` and `rust.yml` workflows used `on.pull_request.paths` filters:

```yaml
# js.yml (before fix)
on:
  pull_request:
    paths:
      - 'js/**'
      - 'scripts/**'
      - '.github/workflows/js.yml'
```

The `paths:` filter is evaluated against **all files changed in the entire PR**, not just the latest commit. So if a PR has 8 commits where 7 touch `js/**` and 1 only touches `.gitkeep`, pushing that `.gitkeep`-only commit still triggers the full JS workflow because the PR as a whole includes `js/**` changes.

### Evidence: commit `0e9b6e8c` in PR #49

PR #49 had 8 commits. Commit `0e9b6e8c` only modified `.gitkeep` (reverting a task details file), but the following CI jobs ran:

| Job | Status | Should have run? |
|-----|--------|------------------|
| JS - Lint and Format Check | success | No |
| JS - Check for Changesets | success | No |
| JS - Test (Node.js on ubuntu-latest) | success | No |
| Rust - Lint and Format Check | success | No |
| Rust - Test (ubuntu-latest) | success | No |
| Rust - Test (macos-latest) | success | No |
| Rust - Test (windows-latest) | success | No |
| Rust - Build | success | No |

All 8 jobs ran unnecessarily, consuming CI minutes on 3 different OS runners.

## Timeline

1. PR #49 opened with commits touching `js/**` and `rust/**`
2. Commit `0e9b6e8c` pushed — only modifies `.gitkeep` at repo root
3. Full CI suite triggered because `paths:` filter sees all PR files, not just the latest push
4. Issue #50 filed requesting fix

## Solution

### Approach: Runtime change detection (from template repos)

Instead of relying on YAML-level `paths:` filters, we implement a **detect-changes job** that runs a script at the start of every workflow. The script:

1. Uses `git diff` to compare the actual changed files
2. Categorizes changes by type (JS code, Rust code, scripts, workflows, docs)
3. Excludes non-code files from triggering test runs
4. Outputs boolean flags that downstream jobs use in their `if:` conditions

### Files excluded from code changes

- Markdown files (`*.md`) anywhere in the repo
- `.changeset/` folder
- `docs/` folder
- `experiments/` folder
- `examples/` folder
- Any file not matching known code extensions (`.js`, `.mjs`, `.json`, `.rs`, `.toml`, `.yml`, `.yaml`, `.sh`, `.lock`)

This means files like `.gitkeep`, `.gitignore`, `LICENSE`, `README.md` etc. will not trigger test runs.

### Best practices from template repositories

The solution follows the pattern established in:
- [link-foundation/js-ai-driven-development-pipeline-template](https://github.com/link-foundation/js-ai-driven-development-pipeline-template) — uses `scripts/detect-code-changes.mjs`
- [link-foundation/rust-ai-driven-development-pipeline-template](https://github.com/link-foundation/rust-ai-driven-development-pipeline-template) — uses `scripts/detect-code-changes.rs`

Both templates use the same approach: no `paths:` filters at the workflow trigger level, runtime detection via script, per-job gating via `needs.detect-changes.outputs.*`.

### Key differences from templates

This repo is a **monorepo** with both JS and Rust code, so the detect-changes script outputs language-specific flags:
- `any-js-code-changed` — gates JS workflow jobs (includes JS scripts like `scripts/validate-changeset.mjs`, excludes Rust-specific scripts like `scripts/rust-publish-crate.mjs`)
- `any-rust-code-changed` — gates Rust workflow jobs (includes Rust-specific scripts prefixed with `scripts/rust-*`)
- `any-code-changed` — overall code change flag

### Additional improvements

- Changed from `always()` to `!cancelled()` in job conditions (following [hive-mind issue #1278](https://github.com/link-assistant/hive-mind/issues/1278) best practice)
- Changeset check now only runs when actual JS code changes exist (not on docs-only PRs)

## Files Changed

| File | Change |
|------|--------|
| `scripts/detect-code-changes.mjs` | New — runtime change detection script |
| `.github/workflows/js.yml` | Removed `paths:` filters, added `detect-changes` job, gated all jobs on outputs |
| `.github/workflows/rust.yml` | Removed `paths:` filters, added `detect-changes` job, gated all jobs on outputs |

## Second Bug: Full-PR diff in detect-changes script

### Discovery

After implementing the detect-changes script, commit `aa262e5` (which only reverted `.gitkeep`) still triggered all CI jobs. The initial script used `GITHUB_BASE_SHA...GITHUB_HEAD_SHA` for PRs — identical to the `paths:` filter behavior.

### Root cause: GitHub Actions synthetic merge commit

GitHub Actions creates a **synthetic merge commit** for `pull_request` events:
- `HEAD` = merge commit (not the actual PR head)
- `HEAD^` = base branch (first parent)
- `HEAD^2` = actual PR head commit (second parent)

Even `git diff HEAD^ HEAD` gives the full PR diff, because `HEAD^` is the base branch.

### Fix: Per-commit diff via merge commit detection

The script now detects merge commits and uses `HEAD^2^..HEAD^2` to get the per-commit diff:

```javascript
function isMergeCommit() {
  const parentCount = exec('git cat-file -p HEAD')
    .split('\n')
    .filter((line) => line.startsWith('parent ')).length;
  return parentCount > 1;
}
```

For merge commits: `git diff HEAD^2^ HEAD^2` (latest PR commit only)
For push events: `git diff HEAD^ HEAD` (regular per-commit diff)

### CI verification

Commit `d87498f` (changed only `scripts/detect-code-changes.mjs`):
- Rust detect-changes log: `Merge commit detected → Comparing HEAD^2^ to HEAD^2 → any-rust-code-changed=false`
- All Rust jobs correctly **skipped**
- JS jobs correctly **ran** (JS script changed)

### Template repos affected

The same bug exists in both template repositories. Issues filed:
- [js-ai-driven-development-pipeline-template#31](https://github.com/link-foundation/js-ai-driven-development-pipeline-template/issues/31)
- [rust-ai-driven-development-pipeline-template#34](https://github.com/link-foundation/rust-ai-driven-development-pipeline-template/issues/34)

## Verification

With this fix, if commit `0e9b6e8c` were pushed again:
- `detect-changes` job would run (lightweight, ~5s)
- Merge commit detected, per-commit diff used (`HEAD^2^..HEAD^2`)
- All outputs would be `false` (only `.gitkeep` changed)
- All downstream jobs (lint, test, build) would be **skipped**
- CI minutes saved: ~15-30 minutes per non-code commit
