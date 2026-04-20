# Case Study: Issue #90 — Markdown round-trip test document for Google Docs capture validation

Issue: https://github.com/link-assistant/web-capture/issues/90
Pull request: https://github.com/link-assistant/web-capture/pull/91
Public test document: https://docs.google.com/document/d/1f5zI2xOFpKa90v0GjamO_t7lqSdzMlaM/edit
Reference gist: https://gist.github.com/konard/f9533797242666c03097440fd3e30ad5

## Data preserved

All artefacts referenced in the issue are committed alongside this README so the
analysis is fully reproducible from this repository:

- `issue.json`, `issue-comments.json` — issue body and comments at capture time.
- `pr-91.json`, `pr-91-comments.json`, `pr-91-review-comments.json`,
  `pr-91-reviews.json` — pull request metadata and any review activity.
- `related-merged-prs.json` — merged pull requests matching "gdocs", "google
  docs" or "markdown" to place this change in context.
- `reference/markdown-test-document.md` — ground-truth markdown source.
- `reference/captured-rust-api.md`, `reference/captured-js-api.md`,
  `reference/captured-js-browser.md` — the three outputs captured by the
  author with Rust v0.3.1 and JS v1.7.8.
- `reference/archive/markdown-test-document.docx`,
  `reference/archive/markdown-test-document.md`,
  `reference/archive/markdown-test-document.zip`,
  `reference/archive/media/test-image-{a,b,1,2}.png` — the authoring archive
  extracted from the GitHub attachment. These are the inputs uploaded to
  Google Docs before producing the public document ID.

Local validation logs produced by this pull request are stored next to this
file. See the *Validation* section below for the manifest.

## Timeline

1. **2026-04-10T16:20:43Z** — PR #37 introduces Google Docs auto-detection and
   the `/export?format=...` public-export capture path for both CLIs.
2. **2026-04-14T10:38:43Z** — PR #54 fixes Google Docs archive and image
   handling while keeping the export-based capture.
3. **2026-04-16T09:47:43Z** — Issue #72 reports that `--capture browser` is
   silently routed through the public export endpoint for Google Docs URLs.
4. **2026-04-16T10:49:21Z** — PR #75 (for issue #72) adds capture-method
   selection, a `DOCS_modelChunk` browser parser, and the Docs REST API path.
5. **2026-04-18T00:00:00Z** — JS v1.7.6 publishes the new `--capture`
   semantics, which are in turn released as v1.7.7 and v1.7.8 with only
   unrelated fixes.
6. **2026-04-19/20 (issue creation)** — Issue #90 lands with a hand-authored
   markdown test document uploaded as a public Google Doc and four captures
   (`rust api`, `js api`, `js browser`) demonstrating the remaining gaps that
   the existing implementation does not yet close. It also attaches the
   authoring DOCX and images as a reproducible archive.
7. **2026-04-20 (this PR update)** — The public document was loaded in a real
   browser, the live `DOCS_modelChunk` shape was captured, and both JS and Rust
   browser-model capture paths were updated to render the public document's
   headings, inline formatting, links, blockquotes, lists, horizontal rules and
   named images from editor model data.

## Requirements (extracted verbatim from issue #90)

The "What needs to happen" section lists four explicit requirements, plus
supporting requirements scattered through the issue body. Each is given a
short identifier so the test suite and this case study can cross-reference
them.

| ID       | Requirement |
|----------|-------------|
| **R1**   | `--capture browser` should use `DOCS_modelChunk` interception (per issue #72) to extract text, formatting, images and structure from the `/edit` page. |
| **R2**   | `--capture api` should improve HTML-to-markdown conversion so inline formatting, blockquotes and heading styles from the export HTML survive. |
| **R3**   | The reference markdown test document should be added to **automated** tests. CI captures the public Google Doc and diffs the output against `markdown-test-document.md`. |
| **R4**   | All documented Google Docs URL variations must be accepted and the same document ID must be extracted from each. |
| **R5**   | The document itself covers 14 feature sections (see table in the issue); every section should have explicit coverage in the fixture. |
| **R6**   | Issue comments and logs must be preserved in `docs/case-studies/issue-90/`. |
| **R7**   | Do a deep case study with timeline, requirements, root causes, solution options, and a survey of existing components that could help. |
| **R8**   | Both CLIs must support real browser capture with no fallbacks when `--capture browser` is used. |
| **R9**   | When data is insufficient for root-cause analysis, add debug output / a verbose mode so the next iteration can find the real cause. |
| **R10**  | If any problem traces back to another repository we can file issues in, file those issues with reproducers, workarounds and code suggestions. |

### Supported URL variations (R4)

Each of these URLs must resolve to the same document ID
`1f5zI2xOFpKa90v0GjamO_t7lqSdzMlaM`:

```
https://docs.google.com/document/d/1f5zI2xOFpKa90v0GjamO_t7lqSdzMlaM
https://docs.google.com/document/d/1f5zI2xOFpKa90v0GjamO_t7lqSdzMlaM/edit
https://docs.google.com/document/d/1f5zI2xOFpKa90v0GjamO_t7lqSdzMlaM/edit?usp=sharing
https://docs.google.com/document/d/1f5zI2xOFpKa90v0GjamO_t7lqSdzMlaM/edit?usp=sharing&ouid=102030405060708090100&rtpof=true&sd=true
https://docs.google.com/document/d/1f5zI2xOFpKa90v0GjamO_t7lqSdzMlaM/edit?tab=t.0
```

### Feature coverage (R5)

The fourteen categories the fixture exercises (matching the issue table):

1. Headings H1–H6
2. Inline formatting: bold, italic, bold+italic, strikethrough
3. Paragraphs
4. Blockquotes, including multi-paragraph
5. Unordered lists nested 3 levels deep
6. Ordered lists nested 3 levels deep
7. Mixed ordered + unordered lists
8. Tables — simple, aligned, with formatted content
9. Links, including a link with inline formatting
10. Four embedded PNG images with alt text
11. Horizontal rules between sections
12. Special characters and emoji
13. Nested inline formatting edge cases
14. Empty and minimal table cells

## Online research notes

- **Google Docs publishing endpoints**. The public document URL exposes several
  routes: `/edit` (canvas renderer), `/preview` (static HTML snapshot rendered
  from the last published revision), `/mobilebasic` (stripped HTML), `/pub`
  (if the doc is published to the web), and `/export?format=...` (Drive
  export). `preview` and `mobilebasic` are the only routes that return
  document structure as HTML without requiring the editor JS bundle to run;
  `pub` only works once a document is explicitly "Published to the web".
  References:
  <https://support.google.com/docs/answer/183965> (publishing),
  <https://developers.google.com/workspace/drive/api/guides/manage-downloads>
  (export endpoint).
- **Docs REST API**. `documents.get` returns a structured body
  (`StructuralElement` tree) with `paragraphStyle.namedStyleType` for
  headings, `textStyle.bold` / `italic` / `strikethrough` spans, and
  `inlineObjectElement` references for images that resolve to
  `inlineObjects[...].inlineObjectProperties.embeddedObject.imageProperties.contentUri`.
  The API needs OAuth (`documents.readonly` scope), so it is only usable when
  `--apiToken` is provided.
  Reference: <https://developers.google.com/workspace/docs/api/reference/rest/v1/documents/get>.
- **`DOCS_modelChunk`**. The Google Docs editor bootstraps by assigning a
  serialized `DOCS_modelChunk = {"chunk":[...]}` object for this public
  document. The capture hook must also wrap array `push(...)` because Google
  Docs has used that shape in other editor boots. The live issue document
  exposes one large `ty: "is"` text run plus hundreds of sibling `ty: "as"`
  records for paragraph, text, link, list, table and horizontal-rule metadata.
  A chunk parser that only reads `ty: "is"` / `ty: "iss"` captures text but
  drops style spans, which matches the empirical result in
  `reference/captured-js-browser.md`. Community write-ups that document the
  chunk shape: <https://gist.github.com/mowings/80aaccdd9b4aaa8a67a5ea0a3a33c75c>,
  <https://issuetracker.google.com/issues/36756087> (Google-acknowledged
  absence of a public editor-side export API).
- **Existing libraries that solve similar problems**.
  - <https://github.com/googleworkspace/node-samples/tree/main/docs> — official
    Docs API samples for Node; good reference for paragraph/style rendering.
  - <https://github.com/evbacher/gd2md-html> — Apps Script that converts a
    live Google Doc to Markdown/HTML. Runs *inside* the document and has full
    access to the model, so it sees every style attribute. Not usable from
    outside the editor but demonstrates the ground truth we should aim for.
  - <https://github.com/mangini/gdocs2md> — older Apps Script that inspired
    most third-party exporters.
  - <https://www.npmjs.com/package/@googleapis/docs> — Google's official
    Docs API client for Node. Would let us replace the hand-rolled HTTP call
    in `fetchGoogleDocFromDocsApi`.
  - <https://github.com/johnsmilga/googledocs-md> — TypeScript-based renderer
    for Docs API JSON that we can borrow style-span heuristics from.
  - <https://crates.io/crates/google-docs1> — Rust client for the Docs API
    generated from the same Discovery document.

## Root cause analysis

### Export HTML loses inline formatting (R2)

`/export?format=html` returns Google's "stable" HTML which is optimised for
fidelity with Drive viewers, not for downstream markdown conversion:

- Headings are emitted as `<h1>` but with an empty `<a id>` anchor and a
  leading number like `<span>1.</span>`. The current Turndown pipeline
  escapes the dot to `1\.` which survives in
  `reference/captured-js-api.md:22`.
- Bold/italic/strikethrough runs are marked with inline `style="font-weight:700"`
  or `text-decoration:line-through`, not semantic `<strong>`/`<em>`/`<del>`
  tags. The default Turndown/markdown-it rules ignore inline-style formatting
  and therefore drop it (visible on
  `reference/captured-js-api.md:25-28`).
- Blockquotes are emitted as indented paragraphs without the `<blockquote>`
  wrapper, so they become plain text
  (`reference/captured-js-api.md:44-48`).
- Hyperlinks are wrapped in a tracking redirect
  (`https://www.google.com/url?q=...`).
- Repeated `&nbsp;` are not collapsed back into real spaces, which is why the
  captures show `"mixed&nbsp;formatting"`.

The root cause is not a bug in the CLI but the combination of (a) Google
Drive's HTML-export fidelity policy and (b) the generic HTML-to-markdown
converter having no Drive-specific rules.

### Canvas renderer needs editor-model capture (R1 / R8)

When the editor is loaded the DOM only contains a `<canvas>` element;
Puppeteer's `page.content()` would return no meaningful text. The fix is to
capture the editor model before rendering rather than scraping the canvas.

- JS now installs a non-configurable `DOCS_modelChunk` accessor before page
  scripts run, captures direct assignments, wraps array `push(...)`, and falls
  back to the final `window.DOCS_modelChunk` only when no chunks were already
  captured. This avoids duplicate chunks and handles both bootstrap shapes.
- The JS and Rust model parsers now consume `ty: "as"` style records for text
  styling, links, headings, lists, blockquotes and horizontal rules. Image
  anchors are treated as one-based positions and alt text is read from
  `epm.ee_eo.eo_ad`.
- The live model uses UTF-16 code-unit positions. JS string indexing already
  matches that convention; Rust now maps UTF-16 model positions to Rust char
  positions before applying styles, paragraph metadata or image anchors.
- Rust no longer fetches `/edit` as plain HTTP for browser-model capture. It
  launches Chrome/Chromium in headless mode with `--dump-dom`, then extracts
  `DOCS_modelChunk` and image CID mappings from the real browser-rendered DOM.

### Google Docs URL variations (R4)

`GDOCS_URL_PATTERN = /docs\.google\.com\/document\/d\/([a-zA-Z0-9_-]+)/` in
both CLIs correctly anchors on the document path segment. All five URL
variants listed in the issue already produce the same document ID, which is
why we only add regression tests for them rather than code changes.

### Missing upstream debug signal (R9)

The JS code gained structured `log?.debug?.(...)` breadcrumbs in PR #75; the
Rust code uses `tracing::{debug, info}`. What was missing was *a reproducible
document* to point the verbose output at. That is solved by committing the
public test document URL and reference outputs alongside this case study.

## Solution implemented

- **R1 / R8.** `--capture browser` now performs real browser-model capture in
  both CLIs. JS uses `browser-commander`/Playwright-Puppeteer page injection;
  Rust launches a real Chrome/Chromium process and parses the DOM produced by
  `--dump-dom`. The browser path no longer relies on public-export fallback.
- **R3 / R4 / R5.** JS and Rust integration suites cover the public document,
  every documented URL variation, capture-method selection, reference fixture
  integrity, and live public-doc capture. The live browser tests assert
  headings, inline formatting, links, blockquotes, horizontal rules and the
  four named images from `DOCS_modelChunk` output.
- **R6 / R7 / R9.** The issue/PR metadata, reference material, root-cause notes,
  experiment script and validation logs are preserved under this case-study
  directory so the investigation can be repeated.
- **R2.** The public-export `--capture api` path still has Drive
  HTML-to-Markdown limitations around inline CSS styles and escaped ordered
  headings. The live API tests intentionally guard section/content
  preservation; full export-HTML formatting parity remains separate from the
  browser-model fix.
- **R10.** No upstream issue is warranted from this investigation. The root
  causes were in local browser capture, model parsing and Rust browser
  execution rather than Google Docs, browser-commander or Turndown defects.

## Validation

- `logs/gdocs-model-debug.log` and `logs/gdocs-model-debug.json` — Playwright
  browser run against the public `/edit` URL proving that the real editor page
  exposes `DOCS_modelChunk` and four Docs image CID mappings.
- `logs/gdocs-style-ranges.txt` — summary of the live model style ranges and
  one-based positions used to drive the parser changes.
- `logs/js-gdocs-unit-after.log` — offline Jest gdocs parser/integration suite.
- `logs/js-gdocs-live-after.log` — `GDOCS_INTEGRATION=1` Jest run against the
  public Google Doc, including browser-model capture.
- `logs/js-test-after.log` — broader JS test suite excluding the Docker-only
  test file.
- `logs/rust-gdocs-unit-after.log` — Rust gdocs parser suite including the
  UTF-16 position regression test.
- `logs/rust-gdocs-live-after.log` — `GDOCS_INTEGRATION=1` Rust live test run
  against the public Google Doc, including browser-model capture.
- `logs/rust-test-after.log` — full Rust `cargo test --all-features --verbose`
  run.
- `logs/js-lint-after.log`, `logs/js-format-after.log`, `logs/rust-clippy-after.log`
  and `logs/rust-fmt-after.log` — local quality gates run before pushing.
