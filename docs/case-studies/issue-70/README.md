# Case Study: Issue #70 - JS CLI Missing Runtime GFM Dependency

## Timeline

1. **2026-04-15T16:30:03Z**: Issue #68 reports that the JS CLI rejects positional URLs.
2. **2026-04-16T06:55:05Z**: PR #69 merges the positional URL fix, so `web-capture https://example.com` reaches capture mode.
3. **2026-04-16T07:10:12Z**: Issue #70 reports the next runtime failure: `Cannot find package 'turndown-plugin-gfm'`.
4. **2026-04-16T07:17:15Z**: PR #71 is opened as a draft for issue #70.
5. **2026-04-16T07:17:18Z**: Initial PR checks run against the placeholder commit and skip most JS/Rust jobs because no package code changed.
6. **Investigation**: npm registry metadata for `@link-assistant/web-capture@1.7.3` shows `turndown-plugin-gfm` under `devDependencies`, while repository code imports it from `js/src/lib.js`.
7. **Fix**: Move `turndown-plugin-gfm` to production dependencies, update `package-lock.json`, add a regression test, and verify a production-style install from a packed tarball.

## Data Preserved

- Issue data: `issue.json`, `issue-comments.json`
- PR data: `pr-71.json`, `pr-71-comments.json`, `pr-71-review-comments.json`, `pr-71-reviews.json`
- Related context: `related-issue-68.json`, `related-pr-69.json`, `related-merged-prs.json`
- Code search data: `code-search-turndown-plugin-gfm.json`
- Registry data: `npm-web-capture-1.7.3.json`, `npm-web-capture-latest.json`, `npm-turndown-plugin-gfm-1.0.2.json`
- CI data: `ci-runs.json`, `ci-run-24497357669-js.log`, `ci-run-24497357637-rust.log`
- Reproduction and validation logs: `package-runtime-dependencies-before.log`, `package-runtime-dependencies-after.log`, `package-production-smoke-after.log`, `npm-pack-after.log`, `cli-version.log`, `targeted-tests.log`, `unit-tests.log`, `non-docker-tests.log`, `validate-changeset.log`, `npm-lint.log`, `npm-format-check.log`, `npm-duplication.log`, `docker-unavailable.log`

## Requirements From The Issue

1. Fix the JS CLI crash caused by missing `turndown-plugin-gfm` at runtime.
2. Move `turndown-plugin-gfm` from `devDependencies` to `dependencies` in `js/package.json`.
3. Preserve relevant logs and data under `docs/case-studies/issue-70/`.
4. Produce a deep case-study analysis with timeline, requirements, root causes, and solution options.
5. Search online for additional facts and data.
6. Report issues in other repositories only if the root cause belongs to another project.

## Online Research Notes

- npm documents that production installs do not install modules listed in `devDependencies`: https://docs.npmjs.com/cli/v11/commands/npm-install/
- npm also documents that `npm install` saves packages to `dependencies` by default, while `--save-dev` saves to `devDependencies`: https://docs.npmjs.com/cli/v11/commands/npm-install/
- Bun documents global installs for command-line tools and `--omit dev`/production modes that exclude `devDependencies`: https://bun.com/docs/pm/cli/install
- npm registry metadata captured in `npm-web-capture-1.7.3.json` confirms `@link-assistant/web-capture@1.7.3` was the `latest` version and classified `turndown-plugin-gfm` as a dev dependency.

## Root Cause Analysis

### Primary Root Cause

`js/src/lib.js` imports `turndown-plugin-gfm` at module load time:

```js
import turndownPluginGfm from "turndown-plugin-gfm";
```

That makes the package a runtime dependency for any code path importing `src/lib.js`, including Markdown capture. In `@link-assistant/web-capture@1.7.3`, the package was listed only in `devDependencies`. Production/global installs can omit dev dependencies, so the published CLI could reach `src/lib.js` after the issue #68 fix and then fail before capture logic ran.

### Secondary Root Cause

The test suite had CLI behavior tests, but no package-level regression test that verifies runtime imports are listed in production dependencies and not marked dev-only in `package-lock.json`. A local development install with dev dependencies present hides this class of packaging bug.

### Non-Root Cause

Issue #68 did not introduce the missing dependency. It exposed this older packaging mistake by allowing the CLI to get past argument parsing. The issue note that `--version` reported `0.3.0` was not reproduced from this branch: `cli-version.log` shows `1.7.3`.

## Solution Options

1. **Move `turndown-plugin-gfm` to `dependencies`**: Chosen. This matches the actual runtime import and package-manager behavior.
2. **Lazy-load the GFM plugin and degrade without it**: Rejected. The package intentionally uses GFM table conversion, and silently dropping it would create inconsistent Markdown output.
3. **Declare it as `optionalDependencies`**: Rejected. The import is unconditional, so optional installation would still crash when omitted.
4. **Remove the plugin import**: Rejected. Existing Markdown table behavior depends on it.
5. **Add a general dependency analyzer**: Deferred. Tools such as dependency graph analyzers could broaden coverage, but the narrow Jest regression covers the reported failure without adding another dev dependency.

## Fix Applied

- Moved `turndown-plugin-gfm` from `devDependencies` to `dependencies` in `js/package.json`.
- Updated `js/package-lock.json` so the root package declares the dependency and `node_modules/turndown-plugin-gfm` is not marked `"dev": true`.
- Added `js/tests/unit/package-runtime-dependencies.test.js` to assert the runtime import, package manifest, and lockfile classification stay aligned.
- Updated `ARCHITECTURE.md` so the documented dependency table matches the published package.
- Added `js/.changeset/fix-runtime-gfm-dependency.md` for release notes.

## Validation

- Before the fix, `package-runtime-dependencies-before.log` shows the new regression test failing because `turndown-plugin-gfm` is absent from production dependencies.
- After the fix, `package-runtime-dependencies-after.log` shows the regression test passing.
- `package-production-smoke-after.log` shows a packed tarball installed with `npm install --omit=dev --ignore-scripts` and `import('@link-assistant/web-capture/src/lib.js')` completing with `runtime import ok`.
- `targeted-tests.log` shows the package runtime dependency test, CLI tests, and HTML-to-Markdown tests passing: 31 tests.
- `unit-tests.log` shows the full unit suite passing: 209 tests.
- `non-docker-tests.log` shows the CI-style non-Docker Jest suite passing: 247 tests passed, 16 live Habr tests skipped.
- `validate-changeset.log` shows the patch changeset passing validation.
- `npm-lint.log` shows ESLint passing with existing warnings only.
- `npm-format-check.log` shows Prettier formatting passing.
- `npm-duplication.log` shows duplication checking passing.
- `docker-unavailable.log` records that Docker is not installed in this local environment, so Docker-specific tests could not be run locally.

No upstream or third-party issue was opened because the root cause is this repository's package manifest, not npm, Bun, Turndown, or `turndown-plugin-gfm`.
