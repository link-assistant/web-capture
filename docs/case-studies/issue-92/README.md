# Case Study: Issue #92 — Google Docs capture remaining issues across all modes (v0.3.2 / v1.7.9)

Issue: <https://github.com/link-assistant/web-capture/issues/92>
Pull request: <https://github.com/link-assistant/web-capture/pull/93>
Public test document: <https://docs.google.com/document/d/1f5zI2xOFpKa90v0GjamO_t7lqSdzMlaM/edit>
Reference gist: <https://gist.github.com/konard/f9533797242666c03097440fd3e30ad5>

## Data preserved

All artefacts referenced in the issue are committed alongside this README so
the analysis is fully reproducible from this repository:

- `data/issue.json`, `data/issue-comments.json` — issue body and comments at
  capture time.
- `data/pr-93.json`, `data/pr-93-comments.json`,
  `data/pr-93-review-comments.json`, `data/pr-93-reviews.json` — pull request
  metadata and any review activity.
- `data/related-merged-prs.json` — merged pull requests matching
  "gdocs/google docs/markdown/capture" for context.
- `data/issue-90.json`, `data/issue-72.json`, `data/issue-80.json`,
  `data/issue-81.json` — the four issues referenced from #92.
- `data/pr-75.json`, `data/pr-91.json` — the PRs that shipped the current
  model-based capture pipeline (the starting point of this investigation).
- `reference/markdown-test-document.md` — ground-truth markdown source pulled
  from the reference gist.
- `reference/captured-js-api-v1.7.9.md`,
  `reference/captured-js-browser-v1.7.9.md`,
  `reference/captured-rust-api-v0.3.2.md` — the three captured outputs from the
  reference gist. These are the snapshots that #92 quotes in its bug table.
  The gist filenames use the version names `v1.7.9` / `v0.3.2` from the issue,
  but the file contents were last updated when the gist was populated for
  #90; see *Reference output provenance* below.

## Timeline

1. **2026-04-10T16:20:43Z** — PR #37 introduces Google Docs auto-detection and
   the public `/export?format=...` capture path for both CLIs.
2. **2026-04-14T10:38:43Z** — PR #54 fixes Google Docs archive and image
   handling while keeping the export-based capture.
3. **2026-04-16T09:47:43Z** — Issue #72 reports that `--capture browser` is
   silently routed through the public export endpoint.
4. **2026-04-16T10:49:21Z** — PR #75 (for #72) adds capture-method selection,
   a `DOCS_modelChunk` browser parser, and the Docs REST API path.
5. **2026-04-18** — JS v1.7.6 ships the `--capture` semantics; v1.7.7/v1.7.8
   follow with unrelated fixes.
6. **2026-04-19** — Issue #90 requests a reference markdown round-trip
   document and reports the gaps from v1.7.8 / v0.3.1.
7. **2026-04-20 (morning)** — PR #91 lands with full editor-model rendering in
   both JS and Rust: headings, inline formatting, blockquotes, nested lists,
   tables, horizontal rules and CID-resolved image URLs are now produced from
   `DOCS_modelChunk` data. JS is released as v1.7.9 with a live integration
   test; Rust tags v0.3.2 with the same fix.
8. **2026-04-20 (afternoon)** — Issue #92 is filed. It audits the v1.7.9 /
   v0.3.2 outputs against the reference and splits the remaining gaps into
   five priority-ordered work items (Rust browser markdown, JS browser tables
   / ordered-list numbering / image download, and API-mode formatting).
9. **2026-04-20 (this PR update)** — Issue data, reference files and related
   PR metadata are archived under `docs/case-studies/issue-92/`, a deep
   case study is written with root-cause analysis for each requirement, and
   the three non-upstream root causes are mapped to concrete code locations
   for the follow-up implementation.

## Requirements (extracted verbatim from issue #92)

The "Priority order" section of the issue lists six explicit work items.
Each is given a short identifier so the implementation PR and this case study
can cross-reference them.

| ID   | Requirement |
|------|-------------|
| **R1** | Rust `--capture browser` — apply the parsed editor-model data during markdown generation so bold / italic / strikethrough, headings, blockquotes, lists, links, tables, images and horizontal rules all render. The model is already extracted (121 blocks, 5 tables, 4 CID URLs parsed for the reference document). |
| **R2** | JS `--capture browser` tables — render multi-column tables as `\| A \| B \| C \|` rather than collapsing to a single column. |
| **R3** | JS `--capture browser` ordered list numbering — sequential `1. 2. 3.` instead of every item being marked `1.`. |
| **R4** | JS `--capture browser` list item spacing — remove the extra blank line between consecutive list items introduced by the paragraph joiner. |
| **R5** | JS `--capture browser` image downloading — in archive mode (`--format archive`) download the `docs-images-rt` URLs into the archive's `images/` directory and rewrite markdown/html links to the local copies. |
| **R6** | Both `--capture api` paths — map Google Drive's export HTML (`font-weight:700`, `text-decoration:line-through`, indented `<p>` blockquotes, `<h1>` with leading `<span>N.</span>` numbering) to semantic markdown, decode `&nbsp;`, and unwrap the `google.com/url?q=` redirect wrappers on links. |
| **R7** | *(Supporting, not in the issue body)* — preserve issue comments, PR metadata, reference outputs and logs in `docs/case-studies/issue-92/` so the investigation is reproducible (see the comment on the issue). |
| **R8** | *(Supporting)* — Do a deep case study with timeline, requirements, root causes, solution plans and a survey of existing components that could help. |
| **R9** | *(Supporting)* — When data is insufficient for root-cause analysis, add debug output / verbose mode so the next iteration can find the real cause. |
| **R10** | *(Supporting)* — If any root cause traces back to another repository we can file issues against, file those issues with reproducers, workarounds and code suggestions. |

## Reference output provenance

`reference/captured-js-api-v1.7.9.md`, `captured-js-browser-v1.7.9.md` and
`captured-rust-api-v0.3.2.md` are verbatim copies of the files currently
hosted in the reference gist. The gist was last refreshed for issue #90 and
the filenames were renamed to the new version numbers for #92, but the
content itself predates the v1.7.9 / v0.3.2 releases from PR #91 — it
reflects the v1.7.8 / v0.3.1 outputs.

This creates an ambiguity in the issue's bug table: several rows describe
behaviour that was already fixed in PR #91 (for example, "Rust browser
renders plain text with no formatting" is true of v0.3.1 but not of v0.3.2).
For each claim we cross-checked the current `main` branch code to decide
whether it is a **live** defect that still needs a code change, or a **stale
observation** that disappears as soon as the captures are regenerated. The
"Root cause analysis" section below calls out each one explicitly.

## Supported URL variations

Unchanged from #90. Each of these URLs must resolve to the same document ID
`1f5zI2xOFpKa90v0GjamO_t7lqSdzMlaM`:

```
https://docs.google.com/document/d/1f5zI2xOFpKa90v0GjamO_t7lqSdzMlaM
https://docs.google.com/document/d/1f5zI2xOFpKa90v0GjamO_t7lqSdzMlaM/edit
https://docs.google.com/document/d/1f5zI2xOFpKa90v0GjamO_t7lqSdzMlaM/edit?usp=sharing
https://docs.google.com/document/d/1f5zI2xOFpKa90v0GjamO_t7lqSdzMlaM/edit?usp=sharing&ouid=102030405060708090100&rtpof=true&sd=true
https://docs.google.com/document/d/1f5zI2xOFpKa90v0GjamO_t7lqSdzMlaM/edit?tab=t.0
```

## Online research notes

- **Google Docs publishing endpoints**. `/edit` (canvas renderer),
  `/preview` (static HTML snapshot of the last published revision),
  `/mobilebasic` (stripped HTML), `/pub` (only when "Publish to the web" is
  enabled), and `/export?format=...` (Drive export). `preview` and
  `mobilebasic` return semantic HTML without requiring the editor JS bundle
  to execute; they are the only alternatives to `DOCS_modelChunk` capture
  that do not require OAuth. References:
  <https://support.google.com/docs/answer/183965>,
  <https://developers.google.com/workspace/drive/api/guides/manage-downloads>.
- **Chrome `--dump-dom`**. Prints the serialized DOM immediately after the
  `load` event. It does *not* wait any extra time for subsequent JavaScript
  to finish populating global variables. For Google Docs editors this is
  on the edge of what works: the first `DOCS_modelChunk` is assigned very
  early, but the remainder of the style `ty: "as"` records can arrive after
  `load`. Chromium discussion: <https://chromium-review.googlesource.com/c/chromium/src/+/2347364>.
  Practical guidance suggests adding `--virtual-time-budget=<ms>` to keep
  virtual time running until scripts settle.
- **`DOCS_modelChunk`**. The editor bootstrap assigns one or more chunks that
  contain both the text (`ty: "is"`, `ty: "iss"`) and the style spans
  (`ty: "as"`) keyed by 1-based UTF-16 offsets. Community write-ups:
  <https://gist.github.com/mowings/80aaccdd9b4aaa8a67a5ea0a3a33c75c>,
  <https://issuetracker.google.com/issues/36756087>.
- **Export HTML caveats**. `/export?format=html` ships Google's stable HTML
  (optimised for Drive viewers): bold runs become `<span style="font-weight:700">`,
  italics become `<span style="font-style:italic">`, strikethrough becomes
  `<span style="text-decoration:line-through">`, blockquotes are indented
  `<p>` with CSS-only styling, and every hyperlink is wrapped in
  `https://www.google.com/url?q=…&sa=D&source=editors&usg=…`. The default
  Turndown / html2md rules strip inline styles before emitting markdown, so
  inline formatting is lost unless we add a pre-processing pass.
- **`docs-images-rt` URLs**. Google serves editor-rendered images from
  `https://docs.google.com/docs-images-rt/<doc_id>/<cid>` with short-lived
  signed query strings. Download requires the same cookies / user agent as
  the editor page; `node-fetch` works as long as the URL is dereferenced on
  the fly during archive creation. Long-term caching is not possible because
  URLs expire.
- **Existing libraries that solve similar problems**.
  - <https://github.com/mixmark-io/turndown> + <https://github.com/laurent22/joplin-turndown-plugin-gfm>
    — Turndown rule hooks can match inline styles via `filter(node) { ... }`
    and emit `**…**`, `*…*`, `~~…~~`. We already depend on Turndown in JS.
  - <https://github.com/suntong/html2md> / <https://docs.rs/html2md> —
    Rust crate we already use; custom rules can be registered via
    `html2md::Tag`.
  - <https://github.com/evbacher/gd2md-html> (Apps Script) and
    <https://github.com/johnsmilga/googledocs-md> (TypeScript) — prior art
    for detecting ordered vs. unordered lists and rewriting heading prefixes
    in Docs output.
  - <https://github.com/googleworkspace/node-samples/tree/main/docs> —
    Google's own reference for consuming the Docs REST API. Useful if we
    ever broaden the `--capture api` path to use OAuth by default.

## Root cause analysis

### R1 — Rust browser: formatting not applied

**Verdict**: already fixed in PR #91. The claim in the issue that the Rust
browser path emits plain text reflects v0.3.1 / captured-rust-api (API mode)
output. The current implementation:

- `rust/src/gdocs.rs:488` (`fetch_google_doc_from_model`) launches real
  Chrome via `crate::browser::render_html` (`rust/src/browser.rs:62`, uses
  `--dump-dom`), extracts chunks via `extract_model_chunks_from_html`
  (`rust/src/gdocs.rs:507`) and `cid_urls` via
  `extract_cid_urls_from_html` (`rust/src/gdocs.rs:520`).
- `parse_model_chunks` (`rust/src/gdocs.rs:845`) builds the same block/table
  model as the JS side, including UTF-16 → char position remapping.
- `render_paragraph_markdown` (`rust/src/gdocs.rs:1232`) emits headings from
  `HEADING_N` / `TITLE` / `SUBTITLE`, lists with 2-space nesting
  (`render_paragraph_markdown:1269`), blockquotes with `> ` prefix
  (`render_paragraph_markdown:1253`), and horizontal rules as `---`
  (`render_paragraph_markdown:1239`).
- `render_content_markdown` (`rust/src/gdocs.rs:1310`) applies
  bold / italic / strike from the parsed `ts_bd`, `ts_it`, `ts_st` flags
  via `render_marked_text` (`rust/src/gdocs.rs:1364`) and emits links and
  CID-resolved images.

**Live regression risk**: `--dump-dom` finishes as soon as the `load` event
fires. The editor frequently keeps pushing `ty: "as"` style records into
`DOCS_modelChunk` afterwards. If the Rust capture runs on a fast network
and happens to snapshot the DOM before the style spans land, it will
capture text-only chunks and produce the plain-text output described in
the issue. R9 (debug output) is the way to detect this cheaply.

**Fix proposal (if any live gap is observed after re-capture)**:
1. Pass `--virtual-time-budget=8000` plus `--run-all-compositor-stages-before-draw`
   to the `Command::new(&chrome)` call at `rust/src/browser.rs:75-83`, or
2. Switch to `chromiumoxide` / `headless_chrome` crates so we can inject a
   `window.__captured_chunks` hook equivalent to
   `installDocsModelCapture` (`js/src/gdocs.js:437` area). Option 1 is a
   single-line change; option 2 is more future-proof but also what would
   be needed to add an API-token–aware capture.

### R2 — JS browser tables collapse to one column

**Verdict**: live bug, but more subtle than the issue suggests.

`parseGoogleDocsModelChunks` (`js/src/gdocs.js:634-680`) splits text on four
control codes:
- `0x10` opens a new table,
- `0x11` closes the table,
- `0x12` starts a new row,
- `0x1c` starts a new cell,
- `0x0a` within a table currently flushes the row (`js/src/gdocs.js:658-665`).

In the live reference document, Docs emits cell boundaries as `0x0b`
(vertical tab) in some configurations rather than `0x1c`. When only
`0x0a`/`0x0b` appear between two cells, the current parser treats the
newline as a row separator, so each cell becomes its own row and the table
collapses to one column. (`0x0b` is already recognised as a hard line
break inside a cell at `js/src/gdocs.js:666-669`, so we can't just swap
its meaning.)

The renderer (`renderTableMarkdown`, `js/src/gdocs.js:1026`) already pads
short rows to the widest row with `max(row.cells.length)`, so the defect
is upstream of rendering: cells are never produced.

**Fix proposal**: during table parsing, track `row.cells.length` against
the *maximum* cell count seen so far for the table. If we see a `0x0a`
inside a table and the running row has fewer cells than that maximum,
treat the newline as an implicit `0x1c` (cell separator). Add a debug log
with the control-character histogram per table so we can confirm the fix
against the live document.

The same fix must land in Rust `parse_model_chunks`
(`rust/src/gdocs.rs:920-963`).

### R3 — JS browser: every ordered list item marked "1."

**Verdict**: live bug.

`renderParagraphMarkdown` hard-codes the ordered marker:

```js
// js/src/gdocs.js:1014
const marker = block.list.ordered ? '1.' : '-';
```

There is no state tracking to remember the running counter per list id /
level. GFM technically renders any `N.` marker as a sequential list, but
the reference document uses `1. 2. 3.` explicitly and several downstream
tools (`pandoc`, some static site generators) respect the literal
numbers.

**Fix proposal**: replace the hard-coded literal with a counter keyed by
`(list.id, list.level)`. The counter resets on:
1. A new list id,
2. A level-0 parent (so sibling sub-lists reset),
3. An unordered marker interrupting the same list.

Same fix in Rust `render_paragraph_markdown` (`rust/src/gdocs.rs:1269`).

### R4 — JS browser: extra blank lines between list items

**Verdict**: live bug.

`renderBlocksMarkdown` joins *all* blocks with `\n\n`:

```js
// js/src/gdocs.js:983-994
return blocks
  .map((block) => {
    if (block.type === 'table') return renderTableMarkdown(block);
    return renderParagraphMarkdown(block);
  })
  .filter(Boolean)
  .join('\n\n')
  .trimEnd();
```

That is correct for paragraphs but wrong for consecutive list items in the
same list, which should be `\n`-joined (GFM loose list behaviour aside,
tight lists are what the reference uses).

**Fix proposal**: walk the blocks and choose the separator per-pair:
`\n\n` between paragraphs or when list id/level change, `\n` between two
list blocks that share the same list id. Symmetric change in Rust
`render_blocks_markdown` (`rust/src/gdocs.rs:1202`).

### R5 — JS browser: images not downloaded in archive mode

**Verdict**: live bug.

The archive writer is explicitly called with `images: []`:

```js
// js/bin/web-capture.js:529-531
if (normalizedFormat === 'archive' || normalizedFormat === 'zip') {
  await writeGoogleDocsArchive({
    archiveResult: { ...result, images: [] },
```

`writeGoogleDocsArchive` already knows how to add `images/<filename>` to
the zip when the array is populated (`js/bin/web-capture.js:396-398`), and
`captureGoogleDocWithBrowser` already returns `capture.images` with
resolved `docs-images-rt` URLs (`js/src/gdocs.js:385-388`, 551-576). The
link is missing between the two.

**Fix proposal**: when the format is `archive`, fetch each
`capture.images[i].url`, write it as `images/image-<n>.<ext>`, and rewrite
the markdown so image nodes point at the local filename. Reuse
`localize-images.js:localizeImages` (`js/src/localize-images.js:102`) which
already handles this for the browser pipeline.

### R6 — `--capture api` drops inline formatting, escapes heading numbers, leaves `&nbsp;`, keeps redirect URLs

**Verdict**: live, shared across JS and Rust.

Both CLIs fetch `/export?format=html` (JS: `fetchGoogleDoc` at
`js/src/gdocs.js:127`; Rust: `fetch_google_doc` at `rust/src/gdocs.rs:291`)
and then hand the HTML to a generic HTML-to-markdown converter:

- JS → `convertHtmlToMarkdown` in `js/src/lib.js` uses Turndown plus
  `turndown-plugin-gfm`. The cleaning pass strips every inline `style`
  attribute (`js/src/lib.js:46` area — `$('[style]').removeAttr('style')`),
  which deletes the only signal we have for bold/italic/strike in the
  export HTML.
- Rust → `convert_html_to_markdown` in `rust/src/markdown.rs:28` uses the
  `html2md` crate and has no inline-style rules either.

Export HTML also emits numbered headings as `<h1><a id="…"/><span>1. </span>Headings</h1>`.
Turndown escapes the dot (`1\.`) in
`reference/captured-js-api-v1.7.9.md:7`, and html2md keeps the dot but
renders the empty anchor as `[]()` in
`reference/captured-rust-api-v0.3.2.md:1,10,17,…`.

**Fix proposal**: add a Google-Docs-export pre-processor that runs *before*
the generic HTML-to-markdown step:

1. Before stripping `style`, convert every span matching
   `font-weight:(700|bold)` to `<strong>`, `font-style:italic` to `<em>`
   and `text-decoration:line-through` to `<del>`. Cheerio in JS, scraper
   in Rust.
2. Unwrap `<p style="margin-left:…">…</p>` runs that look like
   blockquotes into `<blockquote>…</blockquote>` (heuristic: indent >
   36 points without being a list item).
3. Strip leading `<a id="…"></a>` and `<span>N.</span>` inside `<h1..6>`
   elements so the heading text is clean. Remove the empty-anchor residue
   that html2md otherwise turns into `[]()`.
4. Replace `href="https://www.google.com/url?q=<URL>&sa=D&source=editors&usg=…"`
   with `href="<URL>"` after URL-decoding. (`&sa=`, `&source=`, `&usg=`
   are always appended.)
5. After the markdown pass, replace the literal string `&nbsp;` with a
   regular space (JS) or U+00A0 (Rust) per the desired output style.

`turndown-plugin-gfm` already ships the `strikethrough` rule; we need to
register an additional rule that matches our newly-injected `<strong>` /
`<em>` / `<del>` ahead of the default.

### R9 — Debug / verbose support

**Verdict**: already present; add fine-grained extras when implementing R1
and R2.

Both CLIs gate verbose output behind `--verbose`:
- JS creates a logger via `makeVerboseLog` (`js/bin/web-capture.js:14`),
  and emits structured `log?.debug?.(...)` breadcrumbs throughout
  `gdocs.js` (search for `log?.debug`).
- Rust uses `tracing`; `--verbose` sets the filter to
  `web_capture=debug,tower_http=debug` in `rust/src/main.rs:192-193`.
  `fetch_google_doc_from_model` already prints chunk/CID counts at INFO
  level and adds debug for each phase (`rust/src/gdocs.rs:501,508,522`).

When implementing R2, add a `log.debug(() => ({ event:
'gdocs.table.histogram', ... }))` that records the control-character
counts per table so we can distinguish "Docs never emitted 0x1c" from
"parser dropped it". When implementing R6, emit
`gdocs.export.style-hoist` with the number of inline-style spans
rewritten.

### R10 — Upstream issues

No upstream issues are warranted from this investigation:
- Turndown / html2md do the right thing for semantic HTML; the workaround
  lives in our export pre-processor, not in the libraries.
- Chrome's `--dump-dom` behaviour is documented; the Rust gap is fixable
  with our own launch flags.
- Google Docs' export HTML and `DOCS_modelChunk` shape are deliberate;
  there is no bug to report to Google.

## Solution plan (order of execution)

1. **R7 / R8** *(this commit)* — archive issue and PR data, reference
   outputs, and deep case-study analysis under
   `docs/case-studies/issue-92/`.
2. **R9** *(this commit)* — verify that the existing debug paths in JS
   (`log?.debug?.(...)`) and Rust (`tracing::debug!/info!`) already cover
   the chunk/CID/blocks/tables/images counts. Add table control-character
   histogram logging when R2 is implemented so the next iteration can
   distinguish parser vs. data-source bugs.
3. **Capture v1.7.9 / v0.3.2 ground truth against the reference document**
   to confirm which of R1–R6 are still observable. This unblocks
   differentiated work on the three Rust risks (R1) vs. the four live JS
   bugs (R2–R5) vs. the shared API-mode preprocessor (R6).
4. **R2, R3, R4** — JS browser fixes in `js/src/gdocs.js`, mirrored in
   `rust/src/gdocs.rs`. Add unit tests for each.
5. **R5** — image download in archive mode using the existing
   `localize-images.js` plumbing.
6. **R6** — shared export-HTML pre-processor. Register Turndown rules on
   the JS side; add `html2md` tag handlers on the Rust side.
7. **R1** — if step 3 shows the Rust browser capture still misses style
   spans, extend `render_html` with `--virtual-time-budget` or move to
   `chromiumoxide`.

## Validation (for the follow-up implementation PR)

The gates to re-run before declaring R1–R6 done:

- `yarn test` in `js/` (unit + mock suites).
- `GDOCS_INTEGRATION=1 yarn test tests/integration/gdocs-public-doc.test.js`
  against the public reference document. Extend the test to assert:
  multi-column tables are not collapsed, ordered-list items are numbered
  sequentially, list blocks are `\n`-joined, and archive mode writes
  `images/*.png`.
- `cargo test --all-features --verbose` in `rust/`.
- `GDOCS_INTEGRATION=1 cargo test --test gdocs_public_doc` for the live
  path.
- For R6, diff the `--capture api` output against `markdown-test-document.md`
  and assert that (a) there are no `font-weight`, `font-style`,
  `text-decoration` substrings, (b) there are no
  `https://www.google.com/url?q=` substrings, (c) there are no `&nbsp;`
  substrings, and (d) there are no `[]()` empty-anchor residues.
