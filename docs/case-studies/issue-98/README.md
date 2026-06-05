# Case Study: Issue #98 - JavaScript release version-specific badge broken

- Issue: https://github.com/link-assistant/web-capture/issues/98
- Pull request: https://github.com/link-assistant/web-capture/pull/99
- Branch: `issue-98-c765b5595cf4`

## Summary

The JavaScript release notes attached a version-specific npm badge of the form
`https://img.shields.io/badge/npm-js-v1.7.12-blue.svg`. shields.io responds to
that URL with the SVG "404: badge not found" because the
`/badge/<label>-<message>-<color>` path treats every unescaped `-` as a field
separator. The broken badge was visible at
https://github.com/link-assistant/web-capture/releases/tag/js-v1.7.12 and on
every JS release back to `js-v1.7.9`.

The Rust release notes used the same `/badge/` template but passed a clean
numeric version, so they rendered correctly.

The release titles were also asymmetric with the tag naming scheme - `JS v1.7.12`
vs. tag `js-v1.7.12` mixes language and version in the same field. The issue
asked for explicit `[JavaScript]` / `[Rust]` prefixes so the language is
unambiguous on the releases page.

## Data preserved

- `data/issue.json` - issue body, labels, author, timestamps.
- `data/pr-99.json` - the prepared pull request for this issue.
- `data/release-*.json` - release body and title for every live release that
  touched the badge or title asymmetry (4 JS + 8 Rust).
- `reference/broken-badge-before.svg` - the shields.io response for the broken
  URL, showing "404: badge not found".
- `reference/fixed-badge-after.svg` - the shields.io response after stripping
  the `js-v` prefix, showing "npm: 1.7.12".

## Timeline

| Date       | Event                                                                                                                                                          |
| ---------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 2026-04-14 | First Rust release `rust-v0.1.0` uses `Rust v0.1.0` title and a numeric-only badge, which happens to render.                                                   |
| 2026-04-20 | First per-language JS release `js-v1.7.9` runs `format-release-notes.mjs` which ships a `/badge/npm-js-v1.7.9-blue.svg` URL. Badge renders as "404 not found". |
| 2026-04-21 | Release `js-v1.7.12` reproduces the same broken badge. User files issue #98 pointing at the release tag page as evidence.                                      |
| 2026-04-21 | PR #99 strips the language prefix in `format-release-notes.mjs`, prefixes release titles with `[JavaScript]` / `[Rust]`, and repairs already-published release bodies/titles via `scripts/fix-existing-release-badges.mjs`. |

## Requirements

| ID  | Requirement                                                                         | Status in PR #99 |
| --- | ----------------------------------------------------------------------------------- | ---------------- |
| R1  | Version-specific badge on JS release tag pages must render                          | Fixed. `format-release-notes.mjs` now strips `js-` / `rust-` prefixes and a leading `v` before interpolating into the shields URL. Already-published JS release bodies were patched in place to point at `/badge/npm-<version>-blue.svg`. |
| R2  | Symmetric badge features for JS and Rust                                            | Both language release flows now use the same numeric version in the version-specific badge. Release titles use language-in-brackets prefix on both sides. `README.md`, `js/README.md`, and `rust/README.md` already have matching badge rows; no asymmetry there. |
| R3  | Use `[JavaScript]` and `[Rust]` prefixes in release titles                          | Fixed. `create-github-release.mjs` and `rust-create-github-release.mjs` now produce `[JavaScript] v<ver>` and `[Rust] v<ver>`. Every existing release has been renamed in place. |
| R4  | Apply best practices from `link-foundation/js-ai-driven-development-pipeline-template` and `link-foundation/rust-ai-driven-development-pipeline-template`; report the same bug upstream if found. | The JS template ships the same `version.replace(/^v/, '')` logic, but the template repo itself does not prefix tags with `js-` so the bug is latent there. The Rust template computes the badge dynamically from crates.io which sidesteps the issue entirely. See "Upstream follow-up" below for the reporting plan. |
| R5  | Compile all issue logs/data into `./docs/case-studies/issue-98`                     | Done in this directory. |
| R6  | Preserve verbose/debug output to support future debugging                           | The badge rendering is an external (shields.io) concern. `scripts/fix-existing-release-badges.mjs` logs every rename/rewrite it does, and prints a `Dry run:` summary when invoked with `--dry-run`. `experiments/test-release-badge-encoding.mjs` is a standalone regression test for the version-normalization regex. |

## Root cause

`scripts/format-release-notes.mjs` is called from `scripts/format-github-release.mjs`:

```js
// scripts/format-github-release.mjs:77
await $`node ../scripts/format-release-notes.mjs --release-id "${releaseId}" --release-version "${tag}" --repository "${repository}" --commit-sha "${commitSha}"`;
```

The caller passes `tag` (for example `js-v1.7.12`) as `--release-version`.
`format-release-notes.mjs` then built the shields URL with:

```js
// scripts/format-release-notes.mjs:191 (before)
const versionWithoutV = version.replace(/^v/, '');
```

`version.replace(/^v/, '')` only strips a leading single `v`. Given
`js-v1.7.12`, `versionWithoutV` stays `js-v1.7.12`, and the next line
interpolates it into

```
https://img.shields.io/badge/npm-js-v1.7.12-blue.svg
```

shields.io parses `/badge/<path>` as three hyphen-separated fields. Extra
unescaped `-` characters shift the boundaries, producing either an invalid
color parse or an unknown message. Shields returns a valid SVG, but the SVG
says "404: badge not found" (preserved as `reference/broken-badge-before.svg`).

The fix normalizes the passed tag into a bare semantic version before
interpolation:

```js
// scripts/format-release-notes.mjs:191 (after)
const versionWithoutV = version.replace(/^[a-z]+-/i, '').replace(/^v/i, '');
```

## Solutions shipped

### 1. Strip language prefix before building the badge

`scripts/format-release-notes.mjs` now removes an optional `[a-z]+-` prefix
and a leading `v` before interpolation. The fix is conservative: semver
`MAJOR.MINOR.PATCH` is kept as-is, and pre-release tags with inner hyphens
(for example `1.2.3-rc.1`) continue to round-trip because the regex is
anchored to the beginning of the string.

### 2. Use `[JavaScript]` and `[Rust]` release titles

`scripts/create-github-release.mjs` now names releases
`[JavaScript] v<version>`. `scripts/rust-create-github-release.mjs` uses
`[Rust] v<version>`. Both match the existing `js-v` / `rust-v` tag scheme
and remove the previous `JS v` / `Rust v` shorthand that made the title look
the same as the tag.

### 3. Repair already-published releases in place

`scripts/fix-existing-release-badges.mjs` walks `/repos/<owner>/<repo>/releases`,
rewrites any badge URL that still contains the language prefix, rewrites the
matching npmjs package-link target that uses the same broken prefix, and
renames the release to the `[JavaScript] v<version>` / `[Rust] v<version>`
format. It supports `--dry-run` and can be re-run safely (rewrites are
idempotent). Twelve existing releases were updated:

- JS: `js-v1.7.12`, `js-v1.7.11`, `js-v1.7.10`, `js-v1.7.9` - title + body
- Rust: `rust-v0.3.4`, `rust-v0.3.3`, `rust-v0.3.2`, `rust-v0.3.1`,
  `rust-v0.3.0`, `rust-v0.2.1`, `rust-v0.2.0`, `rust-v0.1.0` - title only

### 4. Regression test

`experiments/test-release-badge-encoding.mjs` is a Node-assert script that
asserts `normalizeVersion` strips `js-v` / `rust-v` / `v` prefixes for every
tag shape we produce today, and that the resulting shields URL uses exactly
three `-`-separated fields (`npm-<semver>-blue.svg`).

## Upstream follow-up

The JS template (https://github.com/link-foundation/js-ai-driven-development-pipeline-template)
has the same `version.replace(/^v/, '')` in `scripts/format-release-notes.mjs`.
The template is intended to be reused by multi-language repos that tag
releases as `js-v<version>`; in those callers the bug is latent. The Rust
template (https://github.com/link-foundation/rust-ai-driven-development-pipeline-template)
avoids the problem because its badge uses the dynamic shields endpoint
`https://img.shields.io/crates/v/<name>` which reads the latest version from
crates.io and does not depend on the tag string.

A follow-up upstream issue should describe:

- The shields.io `/badge/<label>-<message>-<color>` escaping contract and why
  extra `-` characters break it ("404: badge not found" SVG).
- Reproduction: invoke `format-release-notes.mjs` with `--release-version
  "js-v1.7.12"`, observe the `https://img.shields.io/badge/npm-js-v1.7.12-blue.svg`
  URL in the resulting release body.
- Proposed fix: switch the static `/badge/` URL to the dynamic
  `/npm/v/<package>/<version>` endpoint, or normalize the version by
  stripping `[a-z]+-` prefixes and a leading `v` before interpolation.
- Alternative: encourage downstream repos to pass the clean numeric version
  (`steps.publish.outputs.published_version`) rather than the tag.

## Related components / libraries

- shields.io static badge syntax reference: https://shields.io/badges/static-badge
- shields.io npm dynamic badges: https://shields.io/badges/npm-version
- shields.io crates.io dynamic badges: https://shields.io/badges/crates-io-version
- Node `node:assert/strict` - used for the regression test.
- `use-m`, `command-stream`, `lino-arguments` - the shared release scripting
  stack already used by this repo, reused by `fix-existing-release-badges.mjs`.

## Verification

Regression test:

```bash
node experiments/test-release-badge-encoding.mjs
```

Output: `OK: release badge encoding regression test passes.`

Live badge checks (after running `fix-existing-release-badges.mjs`):

```bash
curl -sS "https://img.shields.io/badge/npm-1.7.12-blue.svg" | head -c 200
```

Renders `aria-label="npm: 1.7.12"` (see `reference/fixed-badge-after.svg`).

```bash
gh release view js-v1.7.12 --repo link-assistant/web-capture --json name,body
```

Returns `"name":"[JavaScript] v1.7.12"` and the badge URL now reads
`https://img.shields.io/badge/npm-1.7.12-blue.svg`.
