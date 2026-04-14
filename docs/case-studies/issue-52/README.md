# Case Study: Issue #52 — Find root cause and fix CI/CD for JavaScript

## Timeline

1. **2026-04-14 09:22** — CI run [24391258731](https://github.com/link-assistant/web-capture/actions/runs/24391258731) on `issue-53-ee04eb2d7520` branch: JS Release job fails at npm publish step with E404 (version 1.5.0). The `setup-npm.mjs` script also fails to upgrade npm from 10.9.7, all fallbacks fail with MODULE_NOT_FOUND for `promise-retry`.
2. **2026-04-14 10:38** — CI run [24394459276](https://github.com/link-assistant/web-capture/actions/runs/24394459276) on `main` branch (merge of PR #54): Same npm upgrade failure, same npm publish E404 (version 1.5.1). Version bump to 1.5.1 committed and pushed to main, but publish fails with 3 retries.
3. **2026-04-14 10:39** — Lint, test, and detect-changes jobs all pass. Only the Release job fails.

## Requirements from Issue

1. Find root cause of CI/CD failures in the referenced runs
2. Compare with CI/CD templates from `link-foundation/js-ai-driven-development-pipeline-template` and `link-foundation/rust-ai-driven-development-pipeline-template`
3. Download logs and data to `docs/case-studies/issue-52`
4. Perform deep case study analysis with timeline, root causes, and proposed solutions
5. If the same issue exists in templates, report it there too

## Root Causes

### Root Cause 1: `setup-npm.mjs` — All npm upgrade strategies fail

**Environment:** GitHub Actions `ubuntu-24.04` image (>= 20260329.72.1) with Node.js 22.22.2 ships a broken npm 10.9.7 that is missing the `promise-retry` module.

**What happens:** The `setup-npm.mjs` script attempts 3 strategies to upgrade npm:
1. `npm install -g npm@11` — Fails with `MODULE_NOT_FOUND: Cannot find module 'promise-retry'` because npm's own `@npmcli/arborist` rebuild code path requires this module.
2. `npx --yes npm@11 install -g npm@11` — Fails for the same reason (npx uses the same broken npm internals).
3. `corepack enable && corepack prepare npm@11 --activate` — Fails (corepack limitations on GitHub Actions).

**Critical flaw:** After all strategies fail, the script **does not exit with an error**. It logs a warning and continues, leaving npm at 10.9.7 which does not support OIDC trusted publishing. This means `npm publish --provenance` will inevitably fail.

**Known upstream issues:**
- [actions/runner-images#13883](https://github.com/actions/runner-images/issues/13883)
- [nodejs/node#62430](https://github.com/nodejs/node/issues/62430)
- [npm/cli#9151](https://github.com/npm/cli/issues/9151)

### Root Cause 2: `publish-to-npm.mjs` — 404 error not caught properly

**What happens:** `npm publish --provenance --access public` fails with `E404 Not Found - PUT https://registry.npmjs.org/@link-assistant%2fweb-capture`. The script has error handling for 404 (to guide first-time manual setup), but uses a try/catch on `await $\`npm publish ...\`` which throws before the error message can be analyzed.

**Evidence from logs (run 24394459276, lines 2583-2590):**
```
npm error code E404
npm error 404 Not Found - PUT https://registry.npmjs.org/@link-assistant%2fweb-capture - Not found
npm error 404  '@link-assistant/web-capture@1.5.1' is not in this registry.
```

The publish command's stderr contains the 404 error, but command-stream's `$` template tag throws an exception with a generic message before the `catch` block can check for `errorMsg.includes('404')`.

### Root Cause 3: `js.yml` — `cancel-in-progress: true` on main

**What happens:** The workflow uses `cancel-in-progress: true` unconditionally. When the version-and-commit step pushes a new commit to main (line 2459-2463 in the log: `[main c6dd289] 1.5.1` → `8b178a7..c6dd289 main -> main`), this triggers a new workflow run. If concurrency cancellation fires, it can cancel the active release workflow mid-publish.

**Template comparison:** The `js-ai-driven-development-pipeline-template` uses `cancel-in-progress: ${{ github.ref == 'refs/heads/main' }}` which is inverted — it only cancels on main. The correct pattern for this project is `cancel-in-progress: ${{ github.ref != 'refs/heads/main' }}` — queue on main (never cancel releases), cancel on PR branches (cancel stale checks).

## Solutions Implemented

### Fix 1: `setup-npm.mjs` — Added direct tarball download strategy

Added Strategy 2 (before npx and corepack): download the npm tarball directly via `curl` and extract it to the global `node_modules/npm` directory. This completely bypasses the broken npm binary:

```bash
curl -sL https://registry.npmjs.org/npm/-/npm-11.4.2.tgz | tar xz -C /tmp
rm -rf "${globalNpmDir}"
mv /tmp/package "${globalNpmDir}"
```

Also changed the script to **exit with error code 1** when all strategies fail, instead of silently continuing with a broken npm. This ensures the release job fails fast with a clear error instead of proceeding to inevitably fail at npm publish.

### Fix 2: `publish-to-npm.mjs` — Use `.run({ capture: true })` for npm publish

Changed the publish command from `await $\`npm publish ...\`` (which throws on non-zero exit) to `await $\`npm publish ...\`.run({ capture: true })` which captures stdout/stderr and exit code without throwing. This allows reliable pattern matching on the output for 404 errors and other failure modes.

### Fix 3: `js.yml` — Fix concurrency for main branch

Changed `cancel-in-progress: true` to `cancel-in-progress: ${{ github.ref != 'refs/heads/main' }}`:
- **Main branch:** Runs queue sequentially (never cancel an active release)
- **PR branches:** Cancel stale runs when new commits are pushed

## Template Comparison

Key differences found between this project and `link-foundation/js-ai-driven-development-pipeline-template`:

| Feature | Template | This Project | Action Needed |
|---------|----------|-------------|---------------|
| npm upgrade fallbacks | Only `npm install -g npm@latest` (no fallbacks) | 4 strategies with curl fallback | Template also needs fix |
| Concurrency on main | `cancel-in-progress: ${{ github.ref == 'refs/heads/main' }}` (inverted logic) | Fixed to `${{ github.ref != 'refs/heads/main' }}` | Template has inverted logic bug |
| Node.js version | 20.x | 22.x | 22.x triggers the broken npm issue |
| test-compilation job | Present | Absent | Nice-to-have |
| check-file-line-limits | Present | Absent | Nice-to-have |
| version-check job | Present (blocks manual version edits) | Absent | Nice-to-have |
| simulate-fresh-merge | Present (ensures PR tests run against latest main) | Absent | Nice-to-have |
| Secrets check | Present (secretlint) | Absent | Nice-to-have |

## CI Logs

- [`ci-logs/js-24391258731.log`](ci-logs/js-24391258731.log) — First failure (issue-53 branch)
- [`ci-logs/js-24394459276.log`](ci-logs/js-24394459276.log) — Second failure (main branch after PR #54 merge)
