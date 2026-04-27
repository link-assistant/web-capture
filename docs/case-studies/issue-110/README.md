# Issue 110 Case Study: Google Docs Table Cell Paragraphs

## Summary

Issue 110 reported that JavaScript API-mode Google Docs capture produced invalid GitHub Flavored Markdown when a table cell contained multiple paragraphs. The public export HTML represents that shape as adjacent `<p>` children inside one `<td>`, but the JavaScript preprocessor flattened those paragraphs with single `<br>` elements. Turndown then converted each `<br>` to a hard-break newline, leaving physical newlines and blank lines inside the GFM table row.

The fix keeps Google Docs table cell paragraph separators as two `<br>` elements and adds a narrow Turndown rule that preserves `<br>` as literal inline HTML when it is inside a table cell. The resulting Markdown cell stays on one physical line and renders as one valid GFM row.

## Timeline

- 2026-04-27 07:46 UTC: Issue 110 opened with the JS/Rust parity report, a minimal public-export HTML shape, expected output, actual output, and a suggested preprocessor fix.
- 2026-04-27 07:47 UTC: Issue comment requested repository-local issue/PR data, online research, root-cause analysis, and solution notes.
- 2026-04-27 07:47 UTC: PR 111 opened as a draft from branch `issue-110-9712e1c70a94`; initial CI only ran change-detection jobs because no code had changed yet.
- 2026-04-27: Investigation archived issue, PR, CI, code search, and related PR data under this case-study folder.

## Captured Artifacts

- `data/issue.json`, `data/issue-comments.json`: original report and follow-up data requirements.
- `data/pr-111.json`, `data/pr-111-comments.json`, `data/pr-111-review-comments.json`, `data/pr-111-reviews.json`: draft PR state and discussions.
- `data/ci-runs.json`: initial PR CI runs with timestamps and head SHA.
- `data/related-merged-prs.json`, `data/related-issue-108-prs.json`: nearby Google Docs capture work.
- `data/code-search-inlineTableCellHtml.json`, `data/code-search-preprocessGoogleDocsExportHtml.json`: repository code-search results for the affected preprocessor.
- `online-sources.md`: external Markdown and Turndown references checked during analysis.

## Requirements

- Fix JS API-mode/public-export Google Docs Markdown for multi-paragraph table cells.
- Preserve all table cell content on one physical Markdown row so GFM does not terminate the table early.
- Match the Rust behavior of using inline `<br>` markup inside table cells.
- Add an automated regression test that fails before the fix.
- Preserve issue, PR, CI, related-code, and research data in `docs/case-studies/issue-110/`.
- Add a JS changeset for the publishable package change.

## Root Cause

`preprocessGoogleDocsExportHtml` normalizes Google Docs export tables before Turndown sees them. Its `inlineTableCellHtml` helper treated each non-empty top-level cell child as a part and returned `parts.join('<br>')`.

That was insufficient for two reasons:

- A single `<br>` represented only a hard line break between former paragraphs, not a paragraph break.
- Turndown's default `<br>` rule renders `<br>` as trailing spaces plus a newline. Inside a GFM table cell, those physical newlines produce invalid or truncated tables.

The GFM table rules allow inline content in cells, but not block-level content, and the table is broken by an empty line or another block-level structure. Literal inline `<br>` tags are therefore the right Markdown representation for paragraph-like breaks inside a pipe-table cell.

## Solution

- Changed `inlineTableCellHtml` to join flattened Google Docs cell parts with `<br><br>`.
- Added `preserveTableCellLineBreaks` to the shared HTML-to-Markdown converter. It overrides Turndown's default `<br>` handling only when the break is inside a `<td>` or `<th>`, returning literal `<br>` inline HTML instead of a hard-break newline.
- Applied that rule to both `convertHtmlToMarkdown` and `convertHtmlToMarkdownEnhanced`.
- Added a focused issue #110 regression test that checks the preprocessed HTML and final Markdown row.
- Added a patch changeset for `@link-assistant/web-capture`.

No upstream issue was filed. The problem was this repository's conversion policy around Google Docs table-cell paragraphs and Turndown's default line-break behavior, not a demonstrated defect in Turndown or the GFM specification.

## Verification

- Reproduced the failure with the new unit test before the conversion-layer fix. The preprocessed cell contained `<br>` separators and the Markdown still contained hard-break newlines inside the table row.
- After the fix, these local checks passed:
  - `npm test -- --runTestsByPath tests/unit/gdocs-preprocess.test.js tests/unit/gdocs.test.js --runInBand`
  - `npm test -- --runInBand tests/unit`
  - `npm test -- --testPathIgnorePatterns="docker.test.js" --runInBand`
  - `npm run lint`
  - `npm run format:check`
  - `npm run check:duplication`
  - `node ../scripts/validate-changeset.mjs`

Local environment note: `npm ci` completed with an engine warning because this machine has Node 20.20.2 while the package declares Node `>=22.0.0 <23.0.0`. CI uses Node 24.x in `.github/workflows/js.yml`.
