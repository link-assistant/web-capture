# Case Study: CI/CD Release Pipeline Broken (Issue #42)

## Summary

The JavaScript release pipeline failed at the "Version packages and commit to main" step during CI run [24262572320](https://github.com/link-assistant/web-capture/actions/runs/24262572320/job/70853245788). The npm package release for version 1.4.0 did not complete through the automated pipeline. Two distinct issues were identified: a primary bug in `version-and-commit.mjs` and a secondary upstream issue with Node.js 22.22.2's broken npm.

## Timeline

| Date | Event | Details |
|------|-------|---------|
| 2026-04-10 20:24:29 | CI triggered | Push to main (merge PR #41, commit `f6c733b`) triggered JS workflow |
| 2026-04-10 20:24:30 | Lint+Test start | Both jobs start successfully |
| 2026-04-10 20:24:56 | Lint passes | ESLint, Prettier, duplication check all pass |
| 2026-04-10 20:30:22 | Tests pass | Unit, integration, e2e, and Docker tests all pass |
| 2026-04-10 20:51:08 | Release job starts | Begins after lint and test jobs complete |
| 2026-04-10 20:51:31 | Dependencies installed | `npm install` succeeds (136 packages funded, 14 vulnerabilities noted) |
| 2026-04-10 20:51:33 | setup-npm.mjs runs | Detects npm 10.9.7, attempts `npm install -g npm@11` |
| 2026-04-10 20:51:36 | npm upgrade fails | `MODULE_NOT_FOUND: Cannot find module 'promise-retry'` — known Node.js 22.22.2 issue |
| 2026-04-10 20:51:36 | setup-npm continues | Fallbacks fail silently, npm stays at 10.9.7 |
| 2026-04-10 20:51:36 | Changeset check | Finds 1 changeset file to process |
| 2026-04-10 20:51:36 | version-and-commit.mjs starts | Begins version bump in changeset mode |
| 2026-04-10 20:51:38 | Remote divergence detected | Local HEAD `f6c733b` != remote HEAD `2d5bbd1` (version 1.4.0 already pushed by previous run) |
| 2026-04-10 20:51:38 | **FAILURE**: `git show` path error | `git show origin/main:package.json` fails with `fatal: path 'js/package.json' exists, but not 'package.json'` |
| 2026-04-10 20:51:38 | Script crashes | `Error: Unexpected end of JSON input` — JSON.parse fails on empty git show output |
| 2026-04-10 20:51:38 | Job fails | Process exits with code 1, publish step skipped |

## Root Causes

### RC1 (Primary): `git show` uses repo-root-relative paths, not working-directory-relative

**Evidence** (CI log lines 230-236):
```
f6c733bd2b56cd935592b1be33a93fae83584328
2d5bbd1360036ea8a74a9cba6a341fadcca27e3c
Remote main has advanced (local: f6c733bd2b56cd935592b1be33a93fae83584328, remote: 2d5bbd1360036ea8a74a9cba6a341fadcca27e3c)
fatal: path 'js/package.json' exists, but not 'package.json'
This may indicate a previous attempt partially succeeded.
hint: Did you mean 'origin/main:js/package.json' aka 'origin/main:./package.json'?
Error: Unexpected end of JSON input
```

**Root cause**: In `scripts/version-and-commit.mjs:129`, the `getVersion('remote')` function runs:
```javascript
const result = await $`git show origin/main:package.json`.run({ capture: true });
```

The `git show <ref>:<path>` command **always** resolves `<path>` relative to the **repository root**, regardless of the current working directory. However, the GitHub Actions workflow sets `working-directory: js`, so `package.json` is at `js/package.json` relative to the repo root. The command should have been `git show origin/main:js/package.json`.

This is documented in git's behavior: `git show` uses tree-level paths (from repo root), while filesystem commands like `readFileSync('./package.json')` use the process working directory. This asymmetry created the bug.

**Trigger condition**: This bug only manifests when `localHead !== remoteHead` (i.e., when the remote main branch has advanced since the CI run was triggered). This is a race condition that occurs when:
1. A push to main triggers CI run A
2. Before CI run A's release job starts, another push (e.g., from a previous CI run's version bump) advances main
3. CI run A detects the divergence and calls `getVersion('remote')` to check the remote version

**Why it wasn't caught earlier**: The `getVersion('local')` path uses `readFileSync('./package.json')` which correctly reads from the `js/` working directory. The `getVersion('remote')` path is only called in the race condition scenario, making it an infrequent code path.

### RC2 (Secondary): Node.js 22.22.2 ships with broken npm 10.9.7

**Evidence** (CI log lines 189-203):
```
npm error code MODULE_NOT_FOUND
npm error Cannot find module 'promise-retry'
npm error Require stack:
npm error - /opt/hostedtoolcache/node/22.22.2/x64/lib/node_modules/npm/node_modules/@npmcli/arborist/lib/arborist/rebuild.js
```

**Root cause**: The pre-cached Node.js 22.22.2 on GitHub Actions runner images (ubuntu-24.04 image >= 20260329.72.1) has a broken npm installation where the `promise-retry` module is missing from npm's internal dependency tree. This causes any command that triggers `@npmcli/arborist` (including `npm install -g`) to fail with `MODULE_NOT_FOUND`.

This is a known upstream issue:
- [actions/runner-images#13883](https://github.com/actions/runner-images/issues/13883)
- [npm/cli#9151](https://github.com/npm/cli/issues/9151)
- [nodejs/node#62430](https://github.com/nodejs/node/issues/62430)

**Impact**: The `setup-npm.mjs` script could not upgrade npm from 10.9.7 to 11.x for OIDC trusted publishing support. The existing corepack fallback also failed. However, since the version-and-commit step failed before reaching the publish step, this issue was not the direct cause of the pipeline failure. It would have caused a publish failure if the version bump had succeeded.

## Solutions Applied

### Fix 1: Use `git rev-parse --show-prefix` for dynamic path resolution

In `scripts/version-and-commit.mjs`, the `getVersion('remote')` function now dynamically determines the repo-root-relative path:

```javascript
const prefixResult = await $`git rev-parse --show-prefix`.run({ capture: true });
const prefix = prefixResult.stdout.trim();  // e.g., "js/"
const gitPath = `${prefix}package.json`;    // e.g., "js/package.json"
const result = await $`git show origin/main:${gitPath}`.run({ capture: true });
```

This approach:
- Works from any subdirectory, not just `js/`
- Uses a standard git command (`git rev-parse --show-prefix`) to determine the current directory relative to the repo root
- Is forward-compatible if the repository structure changes

### Fix 2: Add npx-based fallback for broken npm upgrade

In `scripts/setup-npm.mjs`, added an intermediate fallback strategy between the direct `npm install -g` and the `corepack` fallback:

```javascript
// Fallback 1: npx downloads packages to a cache and runs them,
// bypassing the broken global npm's rebuild/arborist code path
await $`npx --yes npm@11 install -g npm@11`;
```

The `npx` approach works because it downloads npm@11 to a temporary cache directory and executes it directly, bypassing the broken global npm's `@npmcli/arborist/rebuild` code path that requires the missing `promise-retry` module.

Fallback order is now:
1. `npm install -g npm@11` (standard, works when npm is healthy)
2. `npx --yes npm@11 install -g npm@11` (new, bypasses broken npm)
3. `corepack enable && corepack prepare npm@11 --activate` (existing fallback)
4. Check if current npm already >= 11 (existing fallback)

## Verification

The fix can be verified by:
1. Re-running the CI/CD pipeline after merging
2. The `version-and-commit.mjs` script should correctly resolve `js/package.json` even when remote main has advanced
3. The `setup-npm.mjs` script should successfully upgrade npm via the npx fallback

## References

- [CI run 24262572320](https://github.com/link-assistant/web-capture/actions/runs/24262572320/job/70853245788) — failed release job
- [Git documentation: git-rev-parse --show-prefix](https://git-scm.com/docs/git-rev-parse) — current directory relative to repo root
- [actions/runner-images#13883](https://github.com/actions/runner-images/issues/13883) — broken npm on Node.js 22.22.2
- [npm/cli#9151](https://github.com/npm/cli/issues/9151) — npm MODULE_NOT_FOUND issue
- [nodejs/node#62430](https://github.com/nodejs/node/issues/62430) — Node.js tracking issue
