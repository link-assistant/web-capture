# Case Study: Issue #102 - Google Docs public-export Markdown fidelity

- Issue: https://github.com/link-assistant/web-capture/issues/102
- Pull request: https://github.com/link-assistant/web-capture/pull/103
- Branch: `issue-102-7f05baee1eea`
- Public test document: https://docs.google.com/document/d/1f5zI2xOFpKa90v0GjamO_t7lqSdzMlaM/edit

## Data Preserved

This directory keeps the investigation reproducible:

- `data/issue-102.json` and `data/issue-102-comments.json` preserve the issue
  body and comments.
- `data/pr-103*.json` preserve the prepared pull request, discussion, reviews,
  and review comments.
- `data/related-issue-90.json`, `data/related-issue-92.json`,
  `data/related-issue-100.json`, and `data/related-pr-101.json` preserve the
  prior Google Docs capture work this issue follows.
- `reference/public-export.html` is the raw live Google Docs HTML export used to
  identify the source markup shapes.
- `reference/js-api-before.md` and `reference/rust-api-before.md` reproduce the
  degraded public-export Markdown.
- `reference/js-api-after.md` and `reference/rust-api-after.md` preserve the
  fixed public-export Markdown.
- `logs/*` preserves install logs, live capture logs, targeted test logs,
  lint/format/clippy logs, and broader test attempts.

## Timeline

| Date       | Event                                                                                                                                                                           |
| ---------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 2026-04-19 | Issue #90 added the public Google Docs Markdown feature fixture.                                                                                                                |
| 2026-04-20 | PR #91 and PR #93 improved editor-model capture and public-export preprocessing.                                                                                                |
| 2026-04-24 | PR #101 fixed browser-model regressions, leaving public-export fidelity as the next gap.                                                                                        |
| 2026-04-24 | Issue #102 reported that `--capture browser` was now high fidelity, while `--capture api` remained degraded in both CLIs.                                                       |
| 2026-04-24 | This PR preserved the issue data, reproduced the defects, fixed public-export normalization in JS and Rust, tightened live API assertions, and recorded before/after artifacts. |

## Requirements

| ID  | Requirement                                                                                                                        | Status                                                                                                                                                            |
| --- | ---------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| R1  | Bring `--capture api` output closer to `--capture browser` for headings, inline formatting, tables, blockquotes, and nested lists. | Fixed.                                                                                                                                                            |
| R2  | Remove public-export escape normalizers from live tests and assert actual API fidelity.                                            | Fixed.                                                                                                                                                            |
| R3  | Preserve issue data, logs, and analysis under `docs/case-studies/issue-102`.                                                       | Done.                                                                                                                                                             |
| R4  | Search online for relevant export/conversion facts and existing components.                                                        | Done.                                                                                                                                                             |
| R5  | Report upstream issues if the root cause belongs to another project.                                                               | Not needed. The observed converter outputs are expected for the malformed or CSS-driven export HTML; the fix is app-specific semantic recovery before conversion. |

## Root Causes

### R1 - Google Docs public-export HTML encodes semantics in CSS

The public export contains useful content, but several Markdown semantics are
not represented as simple semantic HTML:

- Nested lists are emitted as consecutive top-level `<ul>` or `<ol>` blocks.
  Their nesting level is only available through class styles such as
  `margin-left:36pt`, `72pt`, and `108pt`.
- Blockquotes are regular `<p>` elements with symmetric left and right margins.
- Inline formatting is class-based. Heading defaults can also look italic in the
  export CSS, which should not become literal Markdown emphasis.
- Tables contain paragraph-wrapped cell content and malformed empty `<tbody>`
  elements inside header rows.

Generic HTML-to-Markdown converters cannot infer these document-model
semantics without a Google Docs-specific preprocessing step.

### R2 - Converter defaults were visible in public API output

JS Turndown was already configured for ATX headings and `-` bullets, but it
escaped leading numeric heading prefixes and emitted single-tilde strike from
the GFM plugin. Rust `html2md` emitted setext headings, `*` bullets, padded
tables, extra blockquote blank lines, and closed ATX headings.

Those are reasonable generic converter choices, but the project contract for
Google Docs capture is stable Markdown that is close to the browser-model
renderer. The fix adds a Google Docs public-export Markdown normalization pass
after conversion in both runtimes.

## Solution

The JS public-export pipeline now:

- skips class-style hoisting inside headings to avoid inherited heading style
  leakage,
- groups adjacent class-indented paragraphs into one `<blockquote>`,
- rebuilds consecutive Google Docs list blocks into nested HTML lists using
  their margin classes,
- rewrites Google Docs tables into compact semantic tables before Turndown,
- normalizes escaped heading punctuation and single-tilde strikethrough after
  conversion.

The Rust public-export pipeline now:

- rebuilds split Google Docs list blocks using the same margin-class model,
- strips inherited inline style markers from headings,
- normalizes public-export Markdown to ATX headings, `-` bullets, tight nested
  list spacing, grouped blockquotes, compact tables, and unescaped punctuation.

The live public-document tests in both runtimes now assert the fixed `--capture
api` features directly instead of normalizing away escaped punctuation in the
test body.

## Online Research Notes

- Google Drive `files.export` is the official structured export method for
  Google Workspace documents and returns exported bytes for a requested MIME
  type, with a 10 MB export limit:
  https://developers.google.com/drive/api/reference/rest/v3/files/export
- Google Drive export documentation confirms that Google Docs exports include
  document text, tables, and images, but downloaded images can be lower quality:
  https://support.google.com/drive/answer/9759608
- Turndown documents converter style options such as `headingStyle`,
  `bulletListMarker`, and delimiter choices:
  https://mixmark-io.github.io/turndown/
- `turndown-plugin-gfm` adds GFM extensions including tables and strikethrough:
  https://github.com/mixmark-io/turndown-plugin-gfm
- `html2md` exposes `parse_html` as its main HTML-to-Markdown conversion entry
  point and includes modules for lists, quotes, tables, and styles:
  https://docs.rs/html2md
- The GFM spec defines table and strikethrough extensions, which is the Markdown
  dialect targeted by the normalized output:
  https://github.github.com/gfm/

## Verification

Reproductions before the fix:

```bash
cd js
node bin/web-capture.js "$URL" --capture api --format markdown \
  -o ../docs/case-studies/issue-102/reference/js-api-before.md

cd ../rust
RUST_LOG=off cargo run --quiet -- "$URL" --capture api --format markdown \
  -o ../docs/case-studies/issue-102/reference/rust-api-before.md
```

Before results reproduced the issue:

- JS had `## 1\. Headings`, single-tilde strike, split blockquotes, flattened
  nested lists, and multiline table cells.
- Rust had setext headings, `*` bullets, heading emphasis leakage, extra quoted
  blank lines, flattened nested lists, and padded tables.

Passing targeted checks after the fix:

```bash
cd js
npm test -- --runTestsByPath tests/unit/gdocs.test.js --runInBand
GDOCS_INTEGRATION=1 npm test -- \
  --runTestsByPath tests/integration/gdocs-public-doc.test.js \
  --runInBand \
  --testNamePattern='fetches the public document via --capture api'

cd ../rust
cargo test --test integration gdocs::test_public_export_markdown_normalization_issue_102 -- --nocapture
GDOCS_INTEGRATION=1 RUST_LOG=off cargo test --test integration \
  gdocs_public_doc::live_capture_of_public_document_preserves_every_section -- --nocapture
```

Results: all targeted issue #102 and live API checks passed. See
`logs/js-gdocs-unit.log`, `logs/js-gdocs-public-live-api.log`,
`logs/rust-issue-102-unit-2.log`, and
`logs/rust-gdocs-public-live-api-2.log`.

Static and broader checks:

```bash
cd js
npm run lint
npm run format:check
npm run check:duplication

cd ../rust
cargo fmt --all -- --check
cargo clippy --all-targets --all-features -- -D warnings
cargo test
```

Results: JS lint completed with existing warning-level complexity findings and
no errors, JS formatting and duplication checks passed, Rust fmt/clippy passed,
and `cargo test` passed. See the matching files in `logs/`.

Full local JS Jest attempts are preserved in `logs/js-test.log` and
`logs/js-test-nonbrowser.log`. They failed because this workspace does not have
the Playwright Chromium binary installed, and the default full suite includes
browser tests. The CI workflow installs Playwright and Puppeteer browsers before
running those suites.
