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
7. **Now (this PR)** — Case study, reference data and automated regression
   tests are added so future changes to Google Docs capture can be validated
   against the public document instead of relying on local reproductions.

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
- **`DOCS_modelChunk`**. The Google Docs editor bootstraps by calling
  `DOCS_modelChunk.push(...)` with serialized runs of the `kix` model. Each
  run carries its own text but the *style spans* live in sibling chunks
  keyed by `ty: "ss_r"` / `ty: "ss_s"` etc. A chunk parser that only reads
  `ty: "is"` / `ty: "iss"` — which is what the current implementation does —
  captures text but drops the style spans, which matches the empirical
  result in `reference/captured-js-browser.md`. Community write-ups that
  document the chunk shape: <https://gist.github.com/mowings/80aaccdd9b4aaa8a67a5ea0a3a33c75c>,
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

### Canvas renderer drops everything on the `/edit` page (R1 / R8)

When the editor is loaded the DOM only contains a `<canvas>` element;
Puppeteer's `page.content()` would return no meaningful text. PR #75 solved
the "no text" problem by installing an `init` script that intercepts
`DOCS_modelChunk` assignments. However:

- `parseGoogleDocsModelChunks` only inspects `ty: "is"` and `ty: "iss"` items,
  which are the raw text runs. Style metadata (`ty: "ss_r"`, `ty: "s_sl"`,
  `ty: "spacers_r"`) is not inspected, so bold/italic spans are invisible to
  the parser. This matches the observed output in
  `reference/captured-js-browser.md` where every span is plain text.
- Images that live in a chunk are recognised via `ty: "ae"`/`ase`, but the
  suggested-edit image handling assumes one image per CID. A document with
  four different embedded PNGs exposes only the first CID mapping; the
  remaining images collapse to `*` (see the "Blue/Red/Green/Yellow" image
  sections in the captured-js-browser output).
- The Rust implementation calls this same parser but fetches `/edit`
  over plain HTTP (`fetch_google_doc_from_model`). Google serves a
  different, stripped response to non-browser user agents that does not
  contain the `DOCS_modelChunk` assignments, so the Rust path errors with
  *"Google Docs editor HTML did not contain DOCS_modelChunk data"*. This is
  the *silent fallback* behaviour that R8 asks us to remove.

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

## Solution plan

Requirements R6, R7, R9 are about the case study artefact itself and are
solved by this pull request. The remaining requirements form a backlog:

- **R3 (primary deliverable of this PR).** Wire the public test document into
  the JS and Rust test suites:
  - JS: a new Jest integration test (`tests/integration/gdocs-public-doc.test.js`)
    gated behind `GDOCS_INTEGRATION=true` that matches the `habr-article`
    pattern. It covers the URL-variation suite, document-ID extraction,
    capture-method selection, `--capture api` round-trip against the public
    document, and a fixture-driven feature checklist that inspects the
    captured markdown for every section's headline text. The test is *not*
    run by default so ordinary PR CI remains hermetic; `js.yml` will pick it
    up behind a dedicated step mirroring `HABR_INTEGRATION`.
  - Rust: a matching live test (`tests/integration/gdocs_public_doc.rs`) gated
    behind `GDOCS_INTEGRATION=1` that exercises `fetch_google_doc_as_markdown`
    against the same public document and verifies every section appears.
  - Both tests load the reference markdown from this case study directory so
    any future change that drops an entire section is caught immediately.
- **R4.** Unit-level URL-variation coverage is added for both CLIs against
  the public document ID so the regex and extraction logic remains locked
  down. No code change is needed today because all variants already pass.
- **R1 / R2.** Improving the model-chunk style parser and the export-HTML to
  markdown converter are follow-up bodies of work that the new tests now
  unblock. The recommended next steps (too invasive for this PR) are:
  1. Extend `parseGoogleDocsModelChunks` to consume `ty: "ss_*"` style runs
     and emit `bold`/`italic`/`strikethrough` spans; render them as
     `**`/`*`/`~~` in Markdown and `<strong>`/`<em>`/`<del>` in HTML.
  2. Add heading detection from the paragraph-style chunk (`ps_hd`).
  3. Teach the HTML-to-markdown pipeline to recognise Google Drive's
     inline-style spans (`font-weight:700`, `text-decoration:line-through`)
     and its redirected `https://www.google.com/url?q=` links. The Rust
     `html` / `markdown` modules already have a post-processor to plug
     these rules into.
- **R8.** Make both CLIs refuse to silently fall back when `--capture browser`
  is requested:
  - JS: already launches a real browser through `browser-commander`. Add an
    explicit error when no binary is discoverable instead of whatever
    `launchBrowser` raises. Surface the error through the CLI entry point.
  - Rust: the `browser.rs` implementation is a plain HTTP fetch
    (see lines 59-68). It should either be replaced with a genuine
    `chromiumoxide`/`browser-commander` call or fail fast when `--capture
    browser` is requested. Until then the new Rust integration test gates
    itself behind `GDOCS_INTEGRATION=1` and skips the browser path.
- **R10.** No upstream issue is warranted yet. The remaining defects are
  inside our own HTML-to-markdown pipeline and editor-model parser; we do
  not have evidence of bugs in Drive, the Docs API, browser-commander or
  Turndown that would justify an external report. Once R1/R2 are tackled
  we can open an upstream issue against `browser-commander` if the chunk
  interception requires API changes, and against `turndown` for Drive-
  specific HTML quirks, each with a reproducible example.

## Validation

- `js-gdocs-issue90.log` — Jest output for the new integration suite run in
  "skip live" mode. Confirms the URL-variation and feature-checklist tests
  pass without needing network access, and confirms the live block is
  gated by `GDOCS_INTEGRATION=true`.
- `rust-gdocs-issue90.log` — `cargo test --test integration gdocs::` run
  showing the newly added URL-variation cases for the public document ID
  pass locally.

If any of these logs do not yet exist, the PR was opened before validation
completed and the failure should be investigated immediately — see the PR
description for the live status.
