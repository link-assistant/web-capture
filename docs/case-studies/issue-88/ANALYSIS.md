# Case Study: Issue #88 — JavaScript CI/CD Missing `js-` Tag Prefix

## Issue

**URL:** https://github.com/link-assistant/web-capture/issues/88  
**Title:** JavaScript CI/CD should also have prefix in tags/releases (`js-`), like we have with Rust (`rust-`)  
**Labels:** bug  

## Requirements

1. JS GitHub releases must use `js-v<version>` tags (e.g., `js-v1.7.8`), matching the Rust convention of `rust-v<version>`.
2. JS release names must be descriptive (e.g., `JS v1.7.8`), matching Rust's `Rust v0.3.2`.
3. Compare all CI/CD files with the two template repositories and adopt best practices:
   - https://github.com/link-foundation/js-ai-driven-development-pipeline-template
   - https://github.com/link-foundation/rust-ai-driven-development-pipeline-template
4. Report the same issue to the JS template repository if it has the same bug.

## Timeline of Events

- The repo was set up with both a Rust and a JavaScript package.
- Rust releases were implemented with `rust-v<version>` tags from the start (see `rust-create-github-release.mjs`, line 67: `const tag = \`rust-v${version}\``).
- The JavaScript `create-github-release.mjs` was written using `v<version>` (line 53), without a language prefix.
- JS releases accumulated with tags like `v1.7.8`, `v1.7.7`, etc., while Rust releases used `rust-v0.3.2`.
- Issue #88 was filed to align JS tags with the Rust convention.

## Root Cause Analysis

### Primary Root Cause

**File:** `scripts/create-github-release.mjs`, line 53  
```javascript
// BEFORE (wrong):
const tag = `v${version}`;

// AFTER (correct):
const tag = `js-v${version}`;
```

The JS script was written without considering the multi-language nature of the repository. When both JS and Rust packages share the same GitHub repository, tags must be namespaced by language to avoid ambiguity and conflicts.

### Secondary Issue

**File:** `scripts/format-github-release.mjs`, line 57  
```javascript
// BEFORE (wrong):
const tag = `v${version}`;

// AFTER (correct):
const tag = `js-v${version}`;
```

This script retrieves and updates the GitHub release by tag. It must use the same tag format as `create-github-release.mjs`.

### Release Name Issue

**File:** `scripts/create-github-release.mjs`, line 81  
```javascript
// BEFORE (wrong — just shows "1.7.8"):
name: version,

// AFTER (correct — shows "JS v1.7.8"):
name: `JS v${version}`,
```

Rust uses `Rust v${version}` as the release name, which is clear in the GitHub releases list. JS should do the same.

## Template Comparison

### JS Template (`link-foundation/js-ai-driven-development-pipeline-template`)

**Finding:** The JS template has the **same bug** — `scripts/create-github-release.mjs` also uses `v${version}` without a prefix. A separate GitHub issue should be filed against the template repository.

### Rust Template (`link-foundation/rust-ai-driven-development-pipeline-template`)

**Finding:** The Rust template uses `v${version}` by default (not `rust-v`). The web-capture Rust scripts correctly override this with the `rust-v` prefix. However, the templates themselves could benefit from explicit prefix support.

## Fix Applied

Two files were modified:

### 1. `scripts/create-github-release.mjs`

- Tag changed from `v${version}` → `js-v${version}`
- Release name changed from `version` → `` `JS v${version}` ``
- Default release notes changed from `Release ${version}` → `JS Release ${version}`

### 2. `scripts/format-github-release.mjs`

- Tag changed from `v${version}` → `js-v${version}` (so the formatter can find and update the correct release)

## Impact

- **New releases:** Will use `js-v<version>` tags going forward.
- **Existing releases:** Already-created releases with `v<version>` tags are unaffected (they remain in the GitHub releases list with the old naming).
- **No breaking changes** to npm publishing or versioning — only the GitHub tag/release name changes.

## Related Issues to File in Template Repositories

1. **JS Template:** File issue at https://github.com/link-foundation/js-ai-driven-development-pipeline-template reporting that `scripts/create-github-release.mjs` uses `v${version}` but multi-language repos need `js-v${version}`.
