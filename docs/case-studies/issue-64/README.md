# Case Study: Issue #64 — JavaScript CI/CD Failed

## Timeline of Events

1. **2026-04-14T15:19:43Z**: CI run [#24407389441](https://github.com/link-assistant/web-capture/actions/runs/24407389441) triggered on push to `main` branch.
2. **2026-04-14T15:19:45Z**: `JS - Detect Changes` job completed successfully. Change detection found only `.gitkeep` was modified, so `js-code-changed=false`.
3. **2026-04-14T15:26:05Z**: `JS - Release` job started on `ubuntu-latest` (Ubuntu 24.04).
4. **2026-04-14T15:26:47Z**: `npm publish --provenance --access public --verbose` failed with HTTP 422 error.
5. **2026-04-14T15:27:00Z**: After 3 retry attempts, the release job failed with exit code 1.

## Root Cause Analysis

### Primary Root Cause: Missing `repository` field in `js/package.json`

The npm registry's sigstore provenance verification requires the `repository.url` field in `package.json` to match the GitHub repository from which the publish action originates.

**Error message** (from CI logs line 3241):

```
npm error 422 Unprocessable Entity - PUT https://registry.npmjs.org/@link-assistant%2fweb-capture
  - Error verifying sigstore provenance bundle: Failed to validate repository information:
    package.json: "repository.url" is "", expected to match
    "https://github.com/link-assistant/web-capture" from provenance
```

The `js/package.json` had no `repository` field at all. When npm reads a package without this field, it treats `repository.url` as an empty string `""`, which fails sigstore's provenance validation against the expected GitHub repository URL.

**Evidence**: Line 3241 of `ci-logs/js-release-errors.log` shows the exact npm error. The `Cargo.toml` for the Rust package already had `repository = "https://github.com/link-assistant/web-capture"` set correctly (line 7), confirming this was a JS-specific oversight.

### Secondary Root Cause: Divergence from template best practices

The repository's CI/CD scripts had diverged from the upstream templates in several ways:

1. **No `js-paths.mjs` utility** — The JS template (`js-ai-driven-development-pipeline-template`) includes a `scripts/js-paths.mjs` module for auto-detecting single-language vs multi-language repository layouts. This repo's scripts used hardcoded relative paths.

2. **Outdated concurrency settings** — Both `js.yml` and `rust.yml` used `cancel-in-progress: true` unconditionally, which cancels PR check runs on force-pushes. The template uses `cancel-in-progress: ${{ github.ref == 'refs/heads/main' }}` to only cancel on main.

3. **Outdated action versions** — `peter-evans/create-pull-request@v7` instead of `@v8`.

4. **Missing failure detection patterns** — The `publish-to-npm.mjs` script lacked the template's `FAILURE_PATTERNS` array for detecting and reporting specific npm publish failures.

## Requirements from Issue

1. Fix the CI/CD failure
2. Compare all CI/CD files with template repositories
3. Apply best practices from templates
4. Download logs and create case study analysis
5. Report issues in template repos if found

## Solutions Applied

### Fix 1: Add `repository` field to `js/package.json`

```json
"repository": {
  "type": "git",
  "url": "https://github.com/link-assistant/web-capture"
}
```

### Fix 2: Add `scripts/js-paths.mjs` utility

Ported from the JS template to auto-detect JavaScript root directory in multi-language repos.

### Fix 3: Update scripts to use `js-paths.mjs`

Updated `publish-to-npm.mjs`, `check-release-needed.mjs`, `validate-changeset.mjs`, and `instant-version-bump.mjs` to use the path detection utility instead of hardcoded paths.

### Fix 4: Add failure detection patterns to `publish-to-npm.mjs`

Added `FAILURE_PATTERNS` array and `detectPublishFailure()` helper for better error reporting.

### Fix 5: Update workflow concurrency settings

Changed `cancel-in-progress` from `true` to `${{ github.ref == 'refs/heads/main' }}` in both `js.yml` and `rust.yml`.

### Fix 6: Update `peter-evans/create-pull-request` to v8

Updated from v7 to v8 in both workflow files.

## Template Comparison Summary

### Compared against:
- [js-ai-driven-development-pipeline-template](https://github.com/link-foundation/js-ai-driven-development-pipeline-template) (JS template)
- [rust-ai-driven-development-pipeline-template](https://github.com/link-foundation/rust-ai-driven-development-pipeline-template) (Rust template)

### Key differences found and addressed:

| Feature | This Repo (Before) | JS Template | Action |
|---------|-------------------|-------------|--------|
| `repository` in package.json | Missing | Present | **Fixed** |
| `js-paths.mjs` utility | Missing | Present | **Added** |
| Concurrency cancel-in-progress | Always `true` | Only on `main` | **Fixed** |
| `create-pull-request` version | v7 | v8 | **Updated** |
| Failure detection in publish | Missing | Present | **Added** |

### Features in templates not yet ported (future work):

| Feature | JS Template | Rust Template |
|---------|-------------|---------------|
| `check-file-line-limits.sh` | Yes | Yes (as .rs) |
| `check-mjs-syntax.sh` | Yes | N/A |
| `simulate-fresh-merge.sh` | Yes | N/A |
| `version-check` job | Yes | Yes |
| `validate-docs` job | Yes | N/A |
| `secretlint` | Yes | N/A |
| `links.yml` workflow | Yes | N/A |
| Multi-runtime test matrix | Node/Bun/Deno | N/A |

## References

- Failed CI run: https://github.com/link-assistant/web-capture/actions/runs/24407389441
- npm sigstore provenance docs: https://docs.npmjs.com/generating-provenance-statements
- npm trusted publishers: https://docs.npmjs.com/trusted-publishers
- JS template: https://github.com/link-foundation/js-ai-driven-development-pipeline-template
- Rust template: https://github.com/link-foundation/rust-ai-driven-development-pipeline-template
