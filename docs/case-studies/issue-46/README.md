# Case Study: Issue #46 — CARGO_TOKEN Fallback and Fail-on-Missing-Token

## Problem Statement

The Rust CI/CD release pipeline silently skipped publishing to crates.io when `CARGO_REGISTRY_TOKEN` was not configured, instead of either:
1. Falling back to `CARGO_TOKEN` (which may be configured at the organization level)
2. Failing with a clear error message

## Timeline

- **2026-04-13T08:00:46Z**: Rust CI run [24332395778](https://github.com/link-assistant/web-capture/actions/runs/24332395778) triggered on push to `main` (commit `63157e6`)
- **2026-04-13T08:13:25Z**: Release job runs `rust-version-check.mjs`, determines `should_release=true` for version `0.1.0`
- **2026-04-13T08:13:28Z**: Publish step starts, `CARGO_REGISTRY_TOKEN` is empty
- **2026-04-13T08:13:29Z**: Script outputs `CARGO_REGISTRY_TOKEN not set, skipping publish` and exits with code 0 (success)
- **Result**: No crate published, no error surfaced, no GitHub release created (since `published=false`)

## Root Cause Analysis

### Root Cause 1: Missing CARGO_TOKEN Fallback

The `rust-publish-crate.mjs` script only checked `process.env.CARGO_REGISTRY_TOKEN` (line 71). The organization may use `CARGO_TOKEN` as the secret name (this is the convention used in `browser-commander`, `lino-arguments`, and `Numbers` repos within the same organization).

**Evidence from CI log** (`ci-logs/rust-24332395778.log`):
```
Rust - Release  Publish to crates.io  CARGO_REGISTRY_TOKEN: 
Rust - Release  Publish to crates.io  Current version to publish: 0.1.0
Rust - Release  Publish to crates.io  CARGO_REGISTRY_TOKEN not set, skipping publish
Rust - Release  Publish to crates.io  Output: published=false
Rust - Release  Publish to crates.io  Output: skipped=true
```

### Root Cause 2: Silent Skip Instead of Failure

When no token was available, the script exited with code 0 and `published=false`. This made the overall CI run appear successful while no crate was actually published. The issue states: "we should not skip publish, but always fail if we cannot publish."

### Root Cause 3: Inconsistent Token Handling Across Reference Repos

All four reference repos (`browser-commander`, `lino-arguments`, `Numbers`, `rust-ai-driven-development-pipeline-template`) use a dual-token fallback pattern, but `web-capture` did not follow this convention.

## Reference Repository Comparison

| Feature | web-capture (before) | browser-commander | lino-arguments | Numbers | template |
|---------|---------------------|-------------------|----------------|---------|----------|
| CARGO_REGISTRY_TOKEN support | ✅ | ✅ | ✅ | ✅ | ✅ |
| CARGO_TOKEN fallback | ❌ | ✅ | ✅ | ✅ | ✅ |
| Fail on missing token | ❌ (skip) | ⚠️ (warn) | ⚠️ (warn) | ⚠️ (warn) | ⚠️ (warn) |
| crates.io pre-check | ❌ | ✅ | ✅ | ✅ | ✅ |
| Explicit --token flag | ❌ | ✅ | ✅ | ✅ | ✅ |
| Auth failure diagnostics | ❌ | ✅ | ❌ | ✅ | ✅ |
| Workflow-level token env | ❌ | ✅ | ✅ | ✅ | ✅ |

## Solution

### Changes Made

1. **`scripts/rust-publish-crate.mjs`**:
   - Token resolution: `CARGO_REGISTRY_TOKEN || CARGO_TOKEN` with priority chain
   - Fail with `exit(1)` and `::error::` annotation when no token is available
   - Pre-check crates.io API before attempting publish (avoids unnecessary attempts)
   - Pass token explicitly via `cargo publish --token` flag
   - Add authentication failure diagnostics with remediation guidance
   - Read crate name dynamically from `Cargo.toml`

2. **`.github/workflows/rust.yml`**:
   - Add workflow-level `CARGO_TOKEN: ${{ secrets.CARGO_REGISTRY_TOKEN || secrets.CARGO_TOKEN }}`
   - Update both `release` and `instant-release` publish steps to pass both token env vars

### Token Resolution Chain

```
Priority 1: CARGO_REGISTRY_TOKEN (cargo's native env var, preferred)
Priority 2: CARGO_TOKEN (backwards compatible, used by org-level secrets)
Priority 3: No token → exit(1) with clear error message
```

## Template Repo Issue

The `rust-ai-driven-development-pipeline-template` has a minor inconsistency: the workflow-level env uses `secrets.CARGO_REGISTRY_TOKEN || secrets.CARGO_TOKEN` fallback, but publish steps hardcode only `secrets.CARGO_TOKEN`. This means if only `CARGO_REGISTRY_TOKEN` is configured, the per-step env would be empty (though the script compensates). This was reported as an issue.

## Verification

- Token resolution logic tested via `experiments/test-token-resolution.mjs` (5 test cases, all passing)
- CI pipeline runs on PR to verify workflow syntax and test pass

## Files

- `rust-ci-run-24332395778.log` — Full Rust CI log showing the failed publish
- `js-ci-run-24332395802.log` — JS CI log from the same commit (for reference)
