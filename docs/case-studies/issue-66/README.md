# Case Study: Issue #66 — JavaScript CI/CD Fails

## Timeline

1. **2026-04-15T06:27:41Z**: GitHub Actions run [#24439870541](https://github.com/link-assistant/web-capture/actions/runs/24439870541) starts on `main`.
2. **2026-04-15T06:34:26Z**: `JS - Release` decides version `1.7.1` is not on npm because `npm view @link-assistant/web-capture@1.7.1 version` returns `E404`.
3. **2026-04-15T06:34:28Z**: First `npm publish --provenance --access public --verbose` succeeds and OIDC token exchange succeeds.
4. **2026-04-15T06:34:32Z**: The script begins post-publish verification.
5. **2026-04-15T06:34:38Z**: Verification still sees `E404`, so the script treats the publish as failed.
6. **2026-04-15T06:34:48Z**: Second publish attempt fails with `You cannot publish over the previously published versions: 1.7.1.`
7. **2026-04-15T06:35:01Z**: Third publish attempt fails the same way and the job exits with code 1.

## Requirements From The Issue

1. Fix the JavaScript CI/CD failure.
2. Download logs and preserve them in the repository.
3. Produce a case-study analysis under `docs/case-studies/issue-66/`.
4. Compare behavior with the CI/CD template direction and reuse best practices where relevant.

## Root Cause

The publish itself succeeded. The failure was in the verification logic immediately after publish.

`scripts/publish-to-npm.mjs` waited 5 seconds and then ran one verification request:

```text
npm view "@link-assistant/web-capture@1.7.1" version
```

In run [#24439870541](https://github.com/link-assistant/web-capture/actions/runs/24439870541), npm returned a transient `E404` even though the preceding publish already succeeded:

- `docs/case-studies/issue-66/ci-run-24439870541.log:2609` shows the successful OIDC token exchange.
- `docs/case-studies/issue-66/ci-run-24439870541.log:2613` shows provenance publication.
- `docs/case-studies/issue-66/ci-run-24439870541.log:2624` shows the transient verification `E404`.
- `docs/case-studies/issue-66/ci-run-24439870541.log:2749` shows the duplicate publish failure.

This means the registry package metadata was not yet visible through `npm view` when the script verified the publish. The script then retried the entire publish operation instead of retrying only the verification step.

## Fix

Updated `scripts/publish-to-npm.mjs` to:

1. Separate publish retries from verification retries.
2. Poll `npm view` multiple times before declaring verification failure.
3. Avoid re-publishing the same version while npm registry metadata is still propagating.

The new behavior matches the actual failure mode from the logs: a successful publish followed by delayed metadata visibility.

## Validation

- Saved CI logs to [ci-run-24439870541.log](/tmp/gh-issue-solver-1776236700447/docs/case-studies/issue-66/ci-run-24439870541.log)
- Added regression experiment: [test-publish-verification.mjs](/tmp/gh-issue-solver-1776236700447/experiments/test-publish-verification.mjs)
- Syntax check: `node --check scripts/publish-to-npm.mjs`
- Targeted unit test: `cd js && npm test -- --runTestsByPath tests/unit/cli.test.js`

## Template Comparison Notes

The repository already had the broader release structure from prior CI template sync work, including:

- npm OIDC trusted publishing
- release-needed detection against npm registry
- release case-study documentation pattern

The missing best practice here was resilience to eventual consistency after successful npm publish. The Rust release flow already models this class of problem better by distinguishing existence checks from publish attempts. This fix brings the JavaScript publish flow closer to that standard.
