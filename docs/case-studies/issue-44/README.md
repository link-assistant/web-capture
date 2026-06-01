# Case Study: Issue #44 - CI/CD Package Publishing Failures

## Timeline of Events

1. **2026-04-11 05:42** - Push to `main` triggered the JavaScript CI/CD workflow (run [24275913722](https://github.com/link-assistant/web-capture/actions/runs/24275913722))
2. **2026-04-11 05:48** - Lint and test jobs passed successfully
3. **2026-04-11 05:48:13** - Release job started, version packages committed `1.4.1`
4. **2026-04-11 05:48:37** - `setup-npm.mjs` encountered `MODULE_NOT_FOUND` for `promise-retry` (known Node.js 22.22.2 broken npm issue, [actions/runner-images#13883](https://github.com/actions/runner-images/issues/13883))
5. **2026-04-11 05:48:43** - `publish-to-npm.mjs` started with `--should-pull`
6. **2026-04-11 05:48:45** - Version check confirmed `1.4.1` not on npm, proceeded to publish
7. **2026-04-11 05:48:48** - **FAILURE**: `npm publish --provenance --access public` returned `404 Not Found - PUT https://registry.npmjs.org/@link-assistant%2fweb-capture`
8. **2026-04-11 05:48:51** - Verification failed, retry loop started
9. **2026-04-11 05:49:03** - Second attempt also failed with same 404
10. **2026-04-11 05:49:18** - Third attempt failed, job exited with code 1

## Root Cause Analysis

### Primary Failure: npm Publish 404 Error

**Root cause**: The npm OIDC trusted publishing is not properly configured for the `@link-assistant` scope on npmjs.org.

**Evidence**:
- The package `@link-assistant/web-capture@1.1.2` was previously published using token-based authentication by user `konard`
- The workflow uses `npm publish --provenance --access public` which requires OIDC trusted publishing
- The npm registry returns `404 Not Found` on the PUT request, which is the standard npm error when OIDC provenance-based publishing is not authorized for the package
- The provenance statement was successfully signed (`Signed provenance statement with source and build information from GitHub Actions`) but the registry rejected the publish

**npm OIDC trusted publishing requirements**:
1. The package must be linked to a GitHub repository on npmjs.org
2. The npm organization/user must enable "Require two-factor authentication or an automation or granular access token for publishing" or configure trusted publishing
3. The GitHub Actions workflow must have `id-token: write` permission (present in workflow)
4. The package must be configured on npmjs.org to trust the specific GitHub repository and workflow

### Secondary Issue: Broken npm on GitHub Actions Runner

**Root cause**: Node.js 22.22.2 on ubuntu-latest runners ships with npm 10.9.7 that is missing the `promise-retry` module.

**Evidence**:
```
npm error code MODULE_NOT_FOUND
npm error Cannot find module 'promise-retry'
```

**Mitigation**: The `setup-npm.mjs` script already has fallback logic (npx-based install, corepack) that partially handles this. However, if the npm upgrade itself fails, the subsequent publish will use the broken npm version.

### Tertiary Issues: Dependency and Workflow Gaps

1. **JavaScript `lino-arguments`**: Currently `^0.2.5`, latest is `0.3.0` - should update to `^0.3.0`
2. **JavaScript `browser-commander`**: Currently `^0.8.0`, latest is `0.8.0` - already up to date
3. **Rust `browser-commander`**: Commented out in Cargo.toml, not being used
4. **Rust CI/CD workflow**: Missing several best practices from reference repos (detect-changes, changelog-pr mode, cancel-in-progress, verbose tests, etc.)

## Requirements from Issue

1. Update all dependencies (browser-commander, lino-arguments) to latest versions for both JS and Rust
2. Compare CI/CD workflows with reference repos and adopt best practices
3. Fix CI/CD pipeline to properly publish packages
4. Create case study documentation (this document)
5. Report issues to template repo if applicable

## Solutions

### 1. Fix npm Publishing (Critical)

The `publish-to-npm.mjs` script needs a fallback to token-based authentication when OIDC publishing fails with 404. This is the approach used by the reference repos.

**Fix**: Add `NODE_AUTH_TOKEN`-based fallback when OIDC publish returns 404, and improve error messaging to distinguish between OIDC configuration issues and actual publish failures.

### 2. Update Dependencies

- Update `lino-arguments` from `^0.2.5` to `^0.3.0` in `js/package.json`
- Enable `browser-commander` in `rust/Cargo.toml` (uncomment and set to latest version)
- Add `lino-arguments` to `rust/Cargo.toml` dependencies

### 3. Align CI/CD Workflows

Key improvements from reference repos (browser-commander, lino-arguments):
- Add `cancel-in-progress: true` to concurrency settings
- Add global env variables (`CARGO_TERM_COLOR`, `RUSTFLAGS`)
- Add cache `restore-keys` for partial cache hits
- Add `--verbose` flags to test commands
- Add `changelog-pr` manual release mode for Rust workflow

## CI Log Files

- [ci-run-24275913722-failed.txt](./ci-run-24275913722-failed.txt) - Failed job logs from the release workflow
