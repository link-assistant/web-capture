# Case Study: Issue #38 - npm package version lag (1.1.2 vs 1.2.0)

## Problem Statement

The npm published version of `@link-assistant/web-capture` is v1.1.2, while the GitHub repository source is at v1.2.0. Nine critical modules are missing from the npm package.

## Timeline of Events

| Date | Event | Details |
|------|-------|---------|
| 2025-12-22 07:16 UTC | v1.1.1 published | First CI/CD automated release (npm OIDC + changesets) |
| 2025-12-22 09:50 UTC | v1.1.2 published | Last successful npm publish |
| 2025-12-23 22:42 UTC | v1.1.3 GitHub Release | Created on GitHub but **never published to npm** |
| 2025-12-28 16:43 UTC | v1.2.0 GitHub Release | Created on GitHub but **never published to npm** |
| 2026-04-06 23:05 UTC | JS Release run fails | Run #24055582663 on main branch, same root cause |
| 2026-04-10 14:03 UTC | JS Release run fails | Run #24246825461 on main branch, same root cause |
| 2026-04-10 | Issue #38 opened | Version lag reported |

## Root Cause Analysis

### Root Cause 1: Script Path Mismatch in package.json (PRIMARY)

**File:** `js/package.json` line 30
**Script:** `"changeset:version": "node scripts/changeset-version.mjs"`

The release workflow sets `working-directory: js`. When the `version-and-commit.mjs` script runs `npm run changeset:version`, npm resolves the path relative to `js/`, looking for `js/scripts/changeset-version.mjs`. However, the actual file is at the repository root: `scripts/changeset-version.mjs`.

**Error from CI logs (run #24246825461):**
```
Error: Cannot find module '/home/runner/work/web-capture/web-capture/js/scripts/changeset-version.mjs'
```

**Why this happened:** When the repository was restructured to move scripts from `js/scripts/` to the shared `scripts/` directory at the repo root, the `package.json` script reference was not updated to use the new path (`../scripts/changeset-version.mjs`).

### Root Cause 2: npm Global Update Failure (SECONDARY)

**File:** `scripts/setup-npm.mjs` line 28
**Command:** `npm install -g npm@latest`

The npm global update fails with `Cannot find module 'promise-retry'` on Node.js 22.22.2 GitHub Actions runners. This is a known issue with certain Node.js + npm version combinations where the global npm installation becomes corrupted during an in-place upgrade.

**Error from CI logs:**
```
npm error code MODULE_NOT_FOUND
npm error Cannot find module 'promise-retry'
npm error Require stack:
npm error - /opt/hostedtoolcache/node/22.22.2/x64/lib/node_modules/npm/node_modules/@npmcli/arborist/lib/arborist/rebuild.js
```

**Impact:** The setup-npm.mjs script is meant to update npm to >=11.5.1 for OIDC trusted publishing support. When it fails, the publish step may lack proper OIDC authentication.

**External references:**
- [actions/runner-images#13883](https://github.com/actions/runner-images/issues/13883) - npm in Node.js 22.22.2 toolcache has broken module tree (missing `promise-retry`)
- [nodejs/node#62430](https://github.com/nodejs/node/issues/62430) - npm i -g npm@latest -> Cannot find module 'promise-retry'
- [npm/cli#9151](https://github.com/npm/cli/issues/9151) - latest npm fails to install in latest node 22

**Status:** The `promise-retry` dependency was replaced with `@gar/promise-retry` in npm 11.11.0. The issue affects Node.js 22.22.2 on GitHub Actions runner images with `ubuntu-24.04` starting from image version `20260329.72.1`. A workaround is to use `corepack enable && corepack prepare npm@latest --activate` or to gracefully handle the failure.

### Root Cause 3: Cascading Publish Failure (CONSEQUENCE)

Because Root Cause 1 prevents the changeset version step from running, no version bump commit is made. The `version-and-commit.mjs` script reports "No changes to commit", the `version_committed` output is never set to `true`, and the subsequent publish step is skipped.

Even in the failed run #24055582663 where publish was somehow attempted, it failed with E404 because npm OIDC was not properly configured (Root Cause 2) and/or the package version was already at 1.2.0 locally but the changeset metadata was stale.

## Affected Components

| Component | Issue | Fix |
|-----------|-------|-----|
| `js/package.json` | `changeset:version` script path wrong | Change to `node ../scripts/changeset-version.mjs` |
| `scripts/setup-npm.mjs` | `npm install -g npm@latest` corrupts npm | Use `npm install -g npm@11` (pinned major version) with error resilience |
| `README.md` | No package version badges | Add npm and crates.io badges |
| GitHub Releases | No package manager badges | Add badge to release format script |

## Solutions Implemented

### Fix 1: Correct changeset:version script path
Update `js/package.json` to reference `../scripts/changeset-version.mjs` instead of `scripts/changeset-version.mjs`.

### Fix 2: Make npm update more resilient
Update `scripts/setup-npm.mjs` to:
- Pin npm to a specific major version (`npm@11`) instead of `npm@latest`
- Handle update failure gracefully (warn but don't exit) since the current npm 10.9.7 may still work for OIDC

### Fix 3: Add package manager badges to README.md
Add npm version badge and crates.io version badge to the root README.md.

### Fix 4: Add badges to GitHub Release format script
Update `scripts/format-github-release.mjs` and `scripts/rust-create-github-release.mjs` to include package manager badges.

## CI Log Evidence

Relevant log files saved to `ci-logs/` directory:
- `ci-logs/js-24055582663.log` - Failed JS release run from 2026-04-06
- `ci-logs/js-24246825461-main-latest.log` - Failed JS release run from 2026-04-10

## Verification Plan

After fixes are merged to main:
1. A new changeset exists (`meta-theory-best-practices.md`) which will trigger the release pipeline
2. The corrected `changeset:version` path will allow the version bump to succeed
3. The resilient npm setup will ensure OIDC publishing works
4. The new version will be published to npm and visible via the badges
