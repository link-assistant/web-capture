# Case Study: Issue #56 — Unreleased Fixes After Merge

## Timeline

| Time (UTC) | Event |
|---|---|
| 2026-04-14 09:22 | CI runs on commit `a1ff9896` (Rust succeeds, JS fails) |
| 2026-04-14 09:33:46 | Release `rust-v0.2.0` created (tag + crates.io publish) |
| 2026-04-14 10:36 | PR #54 commits pushed (cancelled by concurrency) |
| 2026-04-14 10:38:43 | PR #54 merged to `main` (commit `8b178a78`) |
| 2026-04-14 10:38:47 | CI triggered on merge commit |
| 2026-04-14 10:49:18 | Rust release job: `Tag rust-v0.2.0 already exists` → `should_release=false` |
| 2026-04-14 10:49:19 | Rust release job completes — **no release cut** |

## Root Causes

### Root Cause 1: Rust release gated on git tags, not crates.io

**Script:** `scripts/rust-version-check.mjs` (line 59)

```javascript
const tagResult = await $`git tag -l "${tagName}"`.run({ capture: true });
const tagExists = tagResult.stdout.trim().length > 0;
```

The script checks if `rust-v{version}` git tag exists. Since v0.2.0 was already released at 09:33, the tag existed when PR #54 merged at 10:38. The script returned `should_release=false` without checking whether there were unreleased commits.

**Evidence from CI logs** (rust-24394459262.log, lines 7096-7099):
```
Current version: 0.2.0
rust-v0.2.0
Tag rust-v0.2.0 already exists
Output: should_release=false
```

### Root Cause 2: No mechanism to detect accumulated unreleased changes

The Rust release job had no step to compare HEAD against the last release tag and check if publishable paths changed. The check was purely: "does the version tag exist?" — a binary yes/no with no nuance.

### Root Cause 3: JS release gated on changeset presence only

The JS release job (js.yml) gates entirely on `.changeset/*.md` files existing. If a PR merges without a changeset, the release is silently skipped. Same class of problem, different mechanism.

### Root Cause 4: No PR-time warning for missing version bumps

Neither workflow had a check on pull_request events that warns when publishable code changes without a corresponding changeset or version bump. Contributors had no feedback loop to catch the gap before merge.

## Template Comparison

| Feature | Rust Template | JS Template | web-capture (before fix) |
|---|---|---|---|
| Release gate | crates.io check | changeset presence | git tag check |
| Unreleased change detection | Yes (check-release-needed.rs) | No | No |
| Auto-bump on unreleased changes | Yes (via fragment system) | No | No |
| PR-time changeset check | Yes (check-changelog-fragment.rs) | Yes (validate-changeset.mjs) | JS only |

The Rust template (`link-foundation/rust-ai-driven-development-pipeline-template`) already had the correct pattern via `check-release-needed.rs`, which checks crates.io as the source of truth. The web-capture repo diverged from this pattern by using the simpler git-tag check.

The JS template (`link-foundation/js-ai-driven-development-pipeline-template`) has the same gap as web-capture — reported as issue #36 on that template.

## Solution

### New Scripts

1. **`scripts/rust-check-release-needed.mjs`**: Replaces `rust-version-check.mjs` in the release job. Checks crates.io (not git tags) as the source of truth. If the version is already published, checks for unreleased commits touching publishable paths since the last release tag.

2. **`scripts/check-release-needed.mjs`**: Same logic for JS/npm. Checks npm registry, then checks for unreleased publishable commits.

3. **`scripts/check-publishable-changes.mjs`**: PR-time check that warns when publishable paths change without a version bump or changeset.

### Workflow Changes

- **Rust release job**: Uses `rust-check-release-needed.mjs` → if unreleased changes detected, auto-bumps patch version using `rust-version-bump.mjs`, commits, pushes, then publishes.
- **JS release job**: Uses `check-release-needed.mjs` → same auto-bump logic using `instant-version-bump.mjs`.
- **Both workflows**: Added `publishable-check` job on `pull_request` events.

### Decision Tree

```
Push to main
├── Check registry (crates.io / npm)
│   ├── Version NOT published → release as-is (no bump needed)
│   └── Version IS published
│       ├── Find latest release tag
│       ├── Diff HEAD vs tag for publishable paths
│       │   ├── Publishable changes found → auto-bump patch → release
│       │   └── No publishable changes → skip release (correct behavior)
│       └── No release tag found → skip (nothing to compare)
```

## Affected Downstream

- **Users of `cargo install web-capture`**: Got v0.2.0 (broken `--archive zip`) instead of the fix from PR #54
- **Issue #53**: Marked as fixed by PR #54, but the fix was unreachable via `cargo install` until this pipeline fix ships

## Related Issues Filed

- [link-foundation/js-ai-driven-development-pipeline-template#36](https://github.com/link-foundation/js-ai-driven-development-pipeline-template/issues/36) — same gap in the JS template
