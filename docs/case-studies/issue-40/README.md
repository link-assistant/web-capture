# Case Study: CI/CD Release Failures (Issue #40)

## Summary

JavaScript npm publishing and Rust crates.io publishing are both broken in the CI/CD pipeline. Versions 1.2.0 and 1.3.0 were never actually published to npm despite the CI reporting success. The Rust crate has never been published to crates.io.

## Timeline

| Date | Event | Details |
|------|-------|---------|
| 2025-12-22 | v1.1.2 published | Last successfully published npm version |
| 2025-12-23 | v1.1.3 release | GitHub release created, but npm publish status unknown |
| 2025-12-28 | v1.2.0 release | GitHub release created, npm publish **failed silently** |
| 2026-04-06 | v1.2.0 re-attempt | JS Release job failed (E404 on npm + CHANGELOG.md not found) |
| 2026-04-10 | v1.3.0 release | GitHub release created, npm publish **failed silently** (E404) |
| 2026-04-10 | Rust release check | `should_release=false` due to false positive tag detection |

## Verified Facts

### npm Registry State
- Only version `1.1.2` exists on npm (`npm view @link-assistant/web-capture versions --json` returns `["1.1.2"]`)
- Versions 1.2.0 and 1.3.0 are **not published** despite CI logs showing "Published"

### crates.io State
- `web-capture` crate has **never been published** (`cargo search web-capture` returns empty)
- No `rust-v*` tags exist on GitHub (only `v1.1.1` through `v1.3.0`)

### Git Tags
- Tags present: `v1.1.1`, `v1.1.2`, `v1.1.3`, `v1.2.0`, `v1.3.0`
- No `rust-v*` tags exist

## Root Causes

### RC1: npm publish uses `changeset publish` which fails with E404

**Evidence** (from CI run 24255175150, 2026-04-10):
```
🦋 error: an error occurred while publishing @link-assistant/web-capture:
  E404 Not Found - PUT https://registry.npmjs.org/@link-assistant%2fweb-capture - Not found
```

**Root cause**: The `publish-to-npm.mjs` script runs `npm run changeset:publish` which executes `changeset publish`. The `changeset publish` command uses its own npm publish mechanism that does **not** support OIDC trusted publishing. The scoped package `@link-assistant/web-capture` requires authentication, and while the workflow sets up OIDC tokens via `actions/setup-node` with `registry-url`, the `changeset publish` command doesn't use this OIDC flow correctly, resulting in E404.

**Why the script reports success despite failure**: The `command-stream` library's `$` template tag wraps `changeset publish`, and when `changeset publish` fails, it **does not throw an error** — it logs errors to stderr but exits with code 0. The script's `try/catch` block never catches the failure, so it proceeds to log "Published" and set success outputs.

### RC2: `changeset:version` script path was incorrect (previously fixed)

**Evidence** (from CI run 24055582663, 2026-04-06):
```
Error: Cannot find module '/home/runner/work/web-capture/web-capture/js/scripts/changeset-version.mjs'
```

**Root cause**: `package.json` had `"changeset:version": "node scripts/changeset-version.mjs"` but the script is at `../scripts/changeset-version.mjs` (relative to the `js/` working directory). This was fixed in a subsequent commit to use `node ../scripts/changeset-version.mjs`.

**Current status**: Fixed. The v1.3.0 run shows `changeset:version` running correctly.

### RC3: Rust version check falsely reports tag exists

**Evidence** (from CI run 24255175149, 2026-04-10):
```
fatal: ambiguous argument 'rust-v0.1.0': unknown revision or path not in the working tree.
Use '--' to separate paths from revisions, like this:
'git <command> [<revision>...] -- [<file>...]'
rust-v0.1.0
Tag rust-v0.1.0 already exists
Output: should_release=false
```

**Root cause**: `rust-version-check.mjs` uses `git rev-parse "${tagName}"` to check if a tag exists. Without the `--verify` flag, `git rev-parse` can interpret the argument as a path or partial match and may not throw a proper error. The `command-stream` library's `$` tag may not properly detect the non-zero exit code from `git rev-parse`, so `tagExists` gets set to `true` even when the tag doesn't exist. Result: the Rust release is skipped every time.

### RC4: Changesets stored in wrong directory

**Evidence**: Changeset files exist at `/.changeset/add-google-docs-support.md` (root level) but the changeset config and tooling expects them at `/js/.changeset/`. The validate-changeset script and version-and-commit script both look for `.changeset/` relative to `js/` working directory. Having changesets at the root means they can be picked up by the workflow's `find .changeset` command but not by `changeset version`.

### RC5: npm OIDC trusted publishing requires npm >= 11.5.1

**Evidence** (from CI logs):
```
npm error code MODULE_NOT_FOUND
npm error Cannot find module 'promise-retry'
```

**Root cause**: The `setup-npm.mjs` script tries to update npm from 10.x to 11.x for OIDC support, but the update fails due to a known Node.js 22.22.2 broken npm issue (actions/runner-images#13883). The corepack fallback also fails. The script continues with npm 10.9.7 which doesn't support OIDC trusted publishing. This is a secondary cause of the E404 — even if `changeset publish` were replaced, npm 10.x cannot authenticate via OIDC.

## Solutions

### S1: Replace `changeset publish` with `npm publish --provenance --access public`

Replace the `changeset publish` call in `publish-to-npm.mjs` with direct `npm publish`:
- `npm publish --provenance --access public` uses the OIDC token set up by `actions/setup-node`
- Add explicit error checking of the exit code
- Verify the published version exists on npm after publish

### S2: Fix `rust-version-check.mjs` to use `git tag -l`

Replace `git rev-parse "${tagName}"` with `git tag -l "${tagName}"` and check if the output is empty (tag doesn't exist) or non-empty (tag exists). This is more reliable than `git rev-parse` for tag existence checks.

### S3: Move root changesets to js/.changeset/

Move any changeset files from `/.changeset/` to `/js/.changeset/` so they are picked up correctly by the changeset tooling.

### S4: Fix npm update for OIDC support

Since `npm install -g npm@11` fails on the GitHub Actions runner, use an alternative approach:
- Use `npx npm@11 publish` to run a one-off publish with npm 11
- Or pin the Node.js version to one that ships with working npm

## References

- [GitHub Actions runner images #13883](https://github.com/actions/runner-images/issues/13883) - Broken npm on Node.js 22.22.2
- [npm CLI #9151](https://github.com/npm/cli/issues/9151) - npm MODULE_NOT_FOUND issue
- [npm trusted publishing docs](https://docs.npmjs.com/generating-provenance-statements)
- [changesets publish limitations](https://github.com/changesets/changesets/issues/1195) - Changesets and OIDC
