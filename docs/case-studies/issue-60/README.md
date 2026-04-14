# Case Study: Issue #60 — False Negative at JavaScript CI/CD

## Summary

npm OIDC trusted publishing fails with E404 (`PUT 404 Not Found`) when publishing `@link-assistant/web-capture@1.7.0`, despite the package existing on npm and having trusted publisher correctly configured.

## Timeline

- **2026-04-14T14:43:42Z** — Release job starts, npm version is `10.9.7` (broken, missing `promise-retry`)
- **2026-04-14T14:43:47Z** — Strategy 1 (`npm install -g npm@11`) fails with `MODULE_NOT_FOUND`
- **2026-04-14T14:43:47Z** — Strategy 2 (curl tarball) succeeds, npm updated to `11.4.2`
- **2026-04-14T14:43:48Z** — Changeset flow detects version `1.6.0`, bumps to `1.7.0`, commits and pushes
- **2026-04-14T14:43:56Z** — `npm view @link-assistant/web-capture@1.7.0` returns E404 (expected — not published yet)
- **2026-04-14T14:43:56Z** — `npm publish --provenance --access public` starts
- **2026-04-14T14:43:58Z** — Provenance statement signed successfully via GitHub Actions OIDC
- **2026-04-14T14:43:59Z** — `PUT https://registry.npmjs.org/@link-assistant%2fweb-capture` returns **404 Not Found**
- **2026-04-14T14:43:59Z** — Script detects E404 and exits with error, suggesting manual first-time publish

## Root Cause Analysis

### Primary Root Cause: Node.js 22 OIDC Incompatibility

The workflow uses `node-version: '22.x'` which ships with npm 10.x. While the `setup-npm.mjs` script successfully upgrades npm to 11.4.2, **Node.js 22's runtime environment interferes with the OIDC token exchange for npm trusted publishing**.

Evidence from the npm community (multiple independent reports):

1. **[npm/cli#8730](https://github.com/npm/cli/issues/8730)** — OIDC publish failing from GitHub Actions (Dart Sass `@sass/types` affected)
2. **[npm/cli#8976](https://github.com/npm/cli/issues/8976)** — OIDC trusted publishing E404 with scoped packages via changesets
3. **[npm/cli#8678](https://github.com/npm/cli/issues/8678)** — Publishing with OIDC fails for scoped packages

**Consensus fix from the community**: Upgrade to **Node.js 24**, which ships with npm 11.x natively and has full OIDC trusted publishing support.

Key quotes from npm/cli#8730:
- *"Using Node version 24 (instead of version 20) and passing `--provenance` to `npm publish` work for me."*
- *"If you are using `registry-url` in `actions/setup-node` (which auto-generates one) — the npm CLI prioritizes that file over OIDC."*
- *"To make OIDC work from GitHub to NPM, we must: set `id-token: write`, update npm to 11.5.1+, update to Node 24 (not documented, contradicting examples)."*

### Contributing Factor: `.npmrc` Interference

The `actions/setup-node` with `registry-url: 'https://registry.npmjs.org'` generates a `.npmrc` file that includes `NODE_AUTH_TOKEN`. On Node 22 with upgraded npm 11, this `.npmrc` can cause npm to attempt traditional token authentication instead of OIDC, leading to the token being invalid and the PUT request receiving a 404.

From the CI logs:
```
NPM_CONFIG_USERCONFIG: /home/runner/work/_temp/.npmrc
NODE_AUTH_TOKEN: XXXXX-XXXXX-XXXXX-XXXXX
```

### Why the Error Message is Misleading

The npm registry returns `404 Not Found` instead of a proper authentication error when OIDC token exchange fails silently. This is a known npm registry issue — it should return `401 Unauthorized` or `403 Forbidden` with a descriptive message. The `404` makes it appear as if the package doesn't exist, when in reality the authentication handshake failed.

## Affected Versions

- Only versions `1.1.2` and `1.4.2` are published on npm
- Versions `1.5.0` through `1.7.0` were never published due to this bug
- The version-and-commit step successfully bumped and pushed to `main`, but publish always failed

## Solution

### Fix Applied

1. **Upgrade Node.js from 22.x to 24.x** in the workflow — Node 24 ships with npm 11.x natively and has full OIDC support
2. **Add `--verbose` flag** to `npm publish` command in `publish-to-npm.mjs` for better OIDC diagnostics
3. **Add OIDC token exchange diagnostic logging** to detect silent authentication failures before they manifest as cryptic E404 errors
4. **Upgrade `actions/setup-node` from v4 to v6** to match the template repository

### Template Comparison

The upstream template repository (`link-foundation/js-ai-driven-development-pipeline-template`) already uses Node 24.x and `actions/setup-node@v6`. The `web-capture` repository was behind on this upgrade.

## References

- [npm Trusted Publishing Documentation](https://docs.npmjs.com/trusted-publishers/)
- [npm/cli#8730 — OIDC publish failing](https://github.com/npm/cli/issues/8730)
- [npm/cli#8976 — OIDC E404 with scoped packages](https://github.com/npm/cli/issues/8976)
- [npm/cli#8678 — Publishing with OIDC fails](https://github.com/npm/cli/issues/8678)
- [npm documentation fix PR#1820](https://github.com/npm/documentation/pull/1820)
- [npm documentation fix PR#1869](https://github.com/npm/documentation/pull/1869)
- [GitHub Actions runner-images#13883 — broken npm 10.9.7](https://github.com/actions/runner-images/issues/13883)
- [CI run log](https://github.com/link-assistant/web-capture/actions/runs/24405153693)
- [npm package settings screenshot](./npm-trusted-publisher-settings.png)
