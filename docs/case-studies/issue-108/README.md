# Issue 108 Case Study: Google Docs Browser List Semantics

## Summary

Issue 108 reported that Google Docs browser capture rendered real ordered lists as unordered lists and misclassified an indented continuation paragraph as a blockquote. Both bugs reproduced in the JavaScript and Rust implementations because both parsers relied on the same `DOCS_modelChunk` heuristics.

The fix keeps the browser model as the main source for document text, inline styles, tables, and images, but augments paragraph semantics with the document's exported HTML. The export contains real `<ol>`, `<ul>`, and `<blockquote>` structure, so the parsers can align those semantic hints to model paragraphs by normalized text order instead of guessing from Google-internal list ids or indents.

## Timeline

- 2026-04-27 05:16 UTC: Issue 108 opened with a public v2 Google Docs reproducer and exact browser/API markdown differences.
- 2026-04-27 06:09 UTC: Issue comment requested adding the v2 document to the live `GDOCS_INTEGRATION` matrix for JS and Rust.
- 2026-04-27 06:16 UTC: Issue comment requested a repository-local case study with downloaded logs/data and online research.
- 2026-04-27 06:17 UTC: PR 109 was opened as a draft from branch `issue-108-a4baf412d9cb`; initial CI on commit `4a745f662a4329eb753ca2fb097c5491769917da` passed.
- 2026-04-27: Investigation downloaded issue, PR, CI, related issue/PR data, a live `DOCS_modelChunk` dump, the v2 export HTML, and local verification logs into this case-study folder.

## Captured Artifacts

- `data/issue.json`, `data/issue-comments.json`: original issue and follow-up requirements.
- `data/pr-109.json`, `data/pr-109-comments.json`, `data/pr-109-review-comments.json`, `data/pr-109-reviews.json`: draft PR state and discussions.
- `data/ci-runs.json`, `logs/javascript-checks-and-release-24979603248.log`, `logs/rust-checks-and-release-24979603264.log`: initial PR CI state.
- `data/related-issue-100.json`, `data/related-issue-106.json`, `data/related-pr-101.json`, `data/related-pr-107.json`, `data/related-merged-prs.json`: nearby Google Docs parser work.
- `data/code-search-DOCS_modelChunk.json`: related code search results.
- `experiments/model-dump/model-data.json`: live browser `DOCS_modelChunk` capture from the public v2 document.
- `experiments/model-dump/summary.json` and `experiments/model-analysis.json`: reduced model analysis used for the fix.
- `experiments/markdown-test-document-v2-export.html`: exported HTML from the same v2 document.
- `logs/model-dump.log`: model dump command log.

## Requirements

- Fix browser-mode Google Docs capture for ordered lists in both JavaScript and Rust.
- Preserve unordered lists in the same Section 15 reproducer.
- Prevent the continuation paragraph after `Step one` from becoming a blockquote.
- Keep the existing public fixture coverage intact while adding the v2 reproducer to JS and Rust live integration tests.
- Add a failing regression test before or with the fix.
- Download and commit issue/PR/CI/research data under `docs/case-studies/issue-108/`.
- Search for relevant online facts and document whether an upstream issue is needed.
- Keep diagnostic or experiment scripts in `experiments/` for reuse.

## Root Causes

### Ordered Lists

`DOCS_modelChunk` exposes list ids, nesting, paragraph indents, and style records, but the captured Section 15 records did not include a stable ordered-vs-unordered marker signal. The old implementations tried to infer ordered lists from a hardcoded id allowlist plus fixture-specific item text such as "Parent item" and "ordered". That matched the previous public fixture but failed on ordinary content like `Apple`, `Banana`, and `Cherry`.

The v2 model dump shows the problem directly: Section 15 ordered list items use generated ids such as `kix.irei0efbjnvi`; the unordered control list uses `kix.t2auk5oln5j6`. Both shapes have similar list style metadata, so id/content inference is not defensible.

The original public fixture also showed a second export-alignment detail: a nested HTML `<li>`'s full text includes descendant list-item text. Semantic extraction must use a list item's own text while skipping nested `<ol>`/`<ul>` descendants, otherwise parent items such as `Parent item 1` will not align to the browser-model paragraph.

### Continuation Paragraph

The continuation paragraph has no list record, but its paragraph indent resembles quote-like content. The previous blockquote heuristic treated the equal left/first-line indent as a blockquote. In the export HTML, that same text is a plain `<p>`, so the browser model's indent alone was insufficient evidence.

### HTML Entity Decoding

The v2 document contains literal explanatory text with escaped HTML tags, including examples such as `&lt;ol&gt;` and `&lt;blockquote&gt;`. The API/export path decoded all HTML payloads before parsing, which could turn escaped text into real elements and corrupt markdown conversion. HTML format responses must be parsed as HTML, not globally entity-decoded first.

### Inherited Inline Styles

The model dump also exposed inherited italic ranges over Section 15 (`ts_it: true` with `ts_it_i: true`). Treating inherited true flags as explicit styles italicized content that was not italic in the document. The parser now only applies bold/italic/strike when the value is true and the inherited flag is not true.

## Online Research

- Google documents can be exported as byte content using Drive export mechanisms, and Google documents support web page/HTML export formats. See Google Drive API docs for [download/export behavior](https://developers.google.com/workspace/drive/api/guides/manage-downloads), [`files.export`](https://developers.google.com/workspace/drive/api/reference/rest/v3/files/export), and [export MIME formats](https://developers.google.com/workspace/drive/api/guides/ref-export-formats).
- Google Docs export HTML represents ordered-list markers through normal HTML list structure and CSS counters. MDN documents that ordered lists have an implicit `list-item` counter and that `counter()`/`counters()` render counter values in generated content: [Using CSS counters](https://developer.mozilla.org/en-US/docs/Web/CSS/Guides/Counter_styles/Using_counters).
- The existing browser capture flow instruments pages before Google Docs scripts load. Chrome DevTools Protocol documents `Page.addScriptToEvaluateOnNewDocument` as running scripts in frames before frame scripts execute: [CDP Page domain](https://chromedevtools.github.io/devtools-protocol/1-3/Page/#method-addScriptToEvaluateOnNewDocument).

No upstream issue was filed. The failure was in this repository's interpretation of captured Google Docs data, not a demonstrated defect in Google Docs, Chrome DevTools Protocol, `cheerio`, or `scraper`.

## Solution Considered

The rejected path was to expand the list-id allowlist or text regex. That would remain unstable because Google list ids are document-local and item text is arbitrary.

The implemented path extracts semantic hints from export HTML:

- Parse export HTML with `cheerio` in JS and `scraper` in Rust.
- Walk paragraph/list item/blockquote text in document order.
- For `<li>` hints, use only the list item's own text and skip nested lists.
- Normalize whitespace for robust matching.
- Align hints to model paragraphs using a forward-only cursor, so repeated nearby text does not match earlier content out of order.
- Use matching hints to set `ordered`, `quote`, or plain paragraph semantics.
- Keep browser-model extraction as the source of content and use export HTML only for semantics the model does not expose reliably.
- Fall back to existing behavior when export HTML is unavailable, while removing the hardcoded ordered-list allowlist.

This approach reuses already-present dependencies and standard HTML parsers. It avoids implementing CSS counter evaluation because the DOM already distinguishes `<ol>` from `<ul>` before marker rendering.

## Implemented Changes

- JavaScript:
  - `captureGoogleDocWithBrowser` fetches export HTML from the same public document page and passes it to `parseGoogleDocsModelChunks`.
  - `parseGoogleDocsModelChunks` applies export semantic hints before rendering.
  - HTML-format fetches are no longer globally entity-decoded.
  - inherited true inline-style flags are ignored for bold/italic/strike.
  - v2 public doc coverage was added for API and browser live integration tests.

- Rust:
  - `fetch_google_doc_from_model` fetches public export HTML and applies semantic hints during model parsing.
  - `parse_model_chunks_with_export_html` was added for deterministic unit/integration tests.
  - HTML-format fetches are no longer globally entity-decoded.
  - inherited true inline-style flags are ignored for bold/italic/strike.
  - v2 public doc coverage was added for API and browser live integration tests.

- Tests:
  - JS and Rust regression tests reproduce Section 15's ambiguous ordered list, continuation paragraph, unordered list, and inherited italic records.
  - Existing ordered-list and nested-list model tests now supply export HTML hints instead of relying on hardcoded ids.
  - Live integration tests include the v2 public document in both JS and Rust when `GDOCS_INTEGRATION` is enabled.

## Verification

Local checks were run with logs saved under `ci-logs/` and copied into this case-study `logs/` directory before finalizing.

- `npm test -- --runTestsByPath tests/unit/gdocs.test.js --runInBand`
- `npm test -- --runTestsByPath tests/integration/gdocs-public-doc.test.js --runInBand`
- `npm test -- --testPathIgnorePatterns="docker.test.js"`
- `GDOCS_INTEGRATION=true BROWSER_ENGINE=puppeteer npm test -- --runTestsByPath tests/integration/gdocs-public-doc.test.js --runInBand --testNamePattern "issue #108 v2"`
- `GDOCS_INTEGRATION=true npm test -- --testPathPattern="gdocs-public-doc" --testTimeout=120000`
- `cargo test --test integration gdocs:: -- --nocapture`
- `cargo test --test integration gdocs_public_doc:: -- --nocapture`
- `GDOCS_INTEGRATION=1 cargo test --test integration issue_108_v2 -- --nocapture`
- `GDOCS_INTEGRATION=1 cargo test --test integration gdocs_public_doc::live -- --nocapture`
- `cargo test --all-features --verbose`
- `npm run format:check`
- `npm run lint`
- `npm run check:duplication`
- `node scripts/validate-changeset.mjs`
- `cargo fmt --all -- --check`
- `cargo clippy --all-targets --all-features -- -D warnings`

Local notes:

- `npm ci` completed with a Node engine warning because this machine has Node 20.20.2 and the package expects Node >=22 <23.
- The first JS live browser attempt used the default Playwright engine and failed because the local Playwright browser binary is not installed. The integration helper now honors `GDOCS_BROWSER_ENGINE`/`BROWSER_ENGINE`; the v2 live browser test passed locally with `BROWSER_ENGINE=puppeteer`. CI can continue using its default configured engine.

## Follow-Up Risks

- Export HTML is fetched for public browser captures. Private/authenticated Google Docs browser capture may not always have a public export URL available from the unauthenticated HTTP client. The current implementation logs and falls back if export HTML cannot be fetched.
- Alignment is text-order based. It is intentionally conservative, but repeated identical paragraphs could still be ambiguous. The forward cursor makes this less likely than global text matching.
- Future Google Docs model schema changes may expose better list marker metadata. If that happens, the semantic-hint layer can become a fallback instead of the primary ordered/unordered signal.
