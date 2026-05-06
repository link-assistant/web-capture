# @link-assistant/web-capture

## 1.7.23

### Patch Changes

- 6b36b5b: Fix `<br><br>` collapsing into two CommonMark hard breaks (`  \n  \n`) instead of a paragraph break (`\n\n`). Google Docs export-html marks paragraph boundaries with `<br><br>`, which Turndown faithfully emitted as two trailing-two-space-newline pairs. Renderers (GitHub, MkDocs, Pandoc) then joined the surrounding lines into a single `<p>` with a `<br>`, cramming captions against images with no vertical spacing, and the "blank" separator line in the markdown source actually carried trailing whitespace that polluted diffs. Two or more adjacent hard breaks now coalesce to `\n\n` after Turndown runs, restoring true paragraph breaks. Applied in both `convertHtmlToMarkdown` (used by `--capture api`) and `convertHtmlToMarkdownEnhanced`.

## 1.7.22

### Patch Changes

- a339ca2: Fix `--capture api` collapsing `<br>`-separated lines inside list items into one run. The Google Docs export-html path lost line breaks when a `<br>` was the leading or trailing child of an inline element (e.g. a `<span>` between bold runs), because Turndown trims inner content of inline elements with edge whitespace. The HTML pre-processing now hoists those edge `<br>`s out of their inline parents before Turndown sees them, restoring CommonMark hard breaks. Additionally, the post-processor's double-space collapse no longer eats the two trailing spaces that mark a hard break.

## 1.7.21

### Patch Changes

- b8ad97d: Number consecutive top-level `<ol>`s continuously across the document (1, 2, 3, ... N) so JS and Rust HTML→Markdown converters agree. `<ol start="N">` resets the counter and is honoured by both implementations. Nested ordered lists keep their own per-list numbering.

## 1.7.20

### Patch Changes

- 5a3e588: Preserve hierarchical heading numbering (e.g. 13, 13.1) in API-path Markdown conversion. Numbered headings wrapped in `<ol><li><hN>` no longer get renumbered to 1, and sub-numbered headings render with their original number on a clean line.

## 1.7.19

### Patch Changes

- 3a483aa: Fix Google Docs public-export Markdown for multi-paragraph table cells.

## 1.7.18

### Patch Changes

- 2c69a73: Fix Google Docs browser capture list semantics and continuation paragraph handling.

## 1.7.17

### Patch Changes

- 86b6fc5: Wait for Google Docs browser-model chunks to quiesce before parsing captures.

## 1.7.16

### Patch Changes

- bf7eaec: Keep Google Docs browser-model soft line breaks outside inline mark tags and preserve image dimensions in HTML output.

## 1.7.15

### Patch Changes

- bf7eaec: Improve Google Docs public-export Markdown fidelity for headings, strikethrough, blockquotes, nested lists, and tables.

## 1.7.14

### Patch Changes

- b2a57f5: Fix Google Docs browser-model capture for live table separators, nested ordered lists, and archive image localization.

## 1.7.13

### Patch Changes

- Auto-release unreleased changes

## 1.7.12

### Patch Changes

- ed70bc8: Fix Google Docs browser-model markdown regressions around table separators,
  blockquote continuation, nested inline markers, final newlines, and
  public-export style preprocessing.

## 1.7.11

### Patch Changes

- 71e7eb9: Fall back to the Google Docs export pipeline when browser capture cannot read editor model chunks, preserving archive content and embedded images.
- 7b4d2d2: Fix Rust CLI `--capture browser` silently routing through direct HTTP
  fetches for non-Google-Docs URLs (issue #80):
  - `rust/src/main.rs` now passes `--capture browser` through
    `render_html` for markdown, archive, and html output formats so the
    flag actually launches headless Chrome instead of calling
    `fetch_html`.
  - `rust/src/browser.rs` `capture_screenshot` is no longer a stub — it
    launches headless Chrome with `--screenshot` and returns real PNG
    bytes.
  - Adds Rust integration tests that run a local HTTP fixture whose DOM
    is mutated by JavaScript after load and verify the rendered HTML,
    the CLI `--capture browser` markdown output, and the PNG signature
    on the screenshot bytes.

  No JS package behavior changes in this patch; the Rust CLI is the only
  affected surface.

## 1.7.10

### Patch Changes

- fcc031f: Fix remaining Google Docs capture gaps from issue #92 in both the JS and
  Rust CLIs:
  - Browser capture now keeps multi-column table rows intact, renders
    ordered lists with sequential `1. 2. 3.` numbering, and joins same-list
    items with a single newline so tight-list markdown matches the source
    document.
  - Archive mode downloads `docs-images-rt/...` image URLs into the
    archive's `images/` directory and rewrites markdown/html references so
    exports are self-contained.
  - API mode (`--capture api`) runs the export HTML through a shared
    preprocessor that hoists inline bold / italic / strikethrough spans to
    semantic tags, strips Google Docs' heading-numbering spans and empty
    anchor wrappers, unwraps `google.com/url?q=` redirects, and normalizes
    non-breaking spaces.

## 1.7.9

### Patch Changes

- cee7590: Add a live Google Docs integration test that captures the public markdown
  round-trip reference document
  (https://docs.google.com/document/d/1f5zI2xOFpKa90v0GjamO_t7lqSdzMlaM/edit)
  and verifies every documented URL variation, capture-method selection path,
  and feature-section heading. The test is gated behind `GDOCS_INTEGRATION=true`
  and is wired into CI so regressions in the `--capture api` HTML-to-Markdown
  pipeline surface against a real Google Doc. Addresses issue #90.

## 1.7.8

### Patch Changes

- e951b65: Fix JavaScript CLI version output when run from another npm project.
- aa4888d: Add content selector options for article-only Markdown capture while preserving full-page metadata extraction.

## 1.7.7

### Patch Changes

- 9034d01: Add Habr archive-compatible markdown controls for figure-numbered image localization and preserved code block whitespace.

## 1.7.6

### Patch Changes

- Support Google Docs capture selection through `--capture browser` editor-model parsing, public export API capture, and authenticated Docs REST API capture.

## 1.7.5

### Patch Changes

- dfaf007: Remove the unsupported `/gdocs` HTTP API route from the JavaScript and Rust server surfaces while keeping Google Docs URL capture through normal output formats.

## 1.7.4

### Patch Changes

- 494da4e: Move turndown-plugin-gfm into runtime dependencies so published CLI installs include the GFM plugin used by Markdown conversion.

## 1.7.3

### Patch Changes

- 237afeb: Fix the JavaScript CLI so strict argument parsing accepts positional capture URLs while still rejecting unknown options.

## 1.7.2

### Patch Changes

- 9c0df3c: Retry npm publish verification long enough to tolerate registry propagation delays after a successful publish.

## 1.7.1

### Patch Changes

- 3ee464b: Add heading-image parity guard rail tests to prevent <img> inside headings from being silently dropped during HTML-to-Markdown conversion

## 1.7.0

### Minor Changes

- b6d77d6: Fix archive quality bugs: relative image paths in markdown, HTML pretty-printing, entity decoding, and rename article to document filenames

## 1.5.1

### Patch Changes

- e6dea94: Fix Google Docs capture: archive produces real zip, default markdown extracts images to files instead of stripping

## 1.5.0

### Minor Changes

- a463061: Markdown mode now keeps original remote image URLs and strips base64 by default (single-file output).
  Archive mode downloads images to images/ folder by default (keepOriginalLinks=false, embedImages=false).
  API and CLI share identical defaults for all modes.
  Add --embed-images, --images-dir, --no-extract-images, --archive, --data-dir, --keep-original-links flags.
  Add embedImages and keepOriginalLinks query params to /markdown and /archive API endpoints.
  Change /markdown API defaults: keepOriginalLinks=true, embedImages=false.
  Remove --enhanced umbrella flag; make sub-features default to true.
  Change default format from html to markdown.
  Auto-derive output directory from URL when -o is omitted.
  Use content-hash filenames for extracted images instead of positional numbering.
  Replace process.env ternaries with lino-arguments getenv() helper.
  Add `WEB_CAPTURE_*` environment variable support for all feature flags.

## 1.4.3

### Patch Changes

- c9d1132: Fix cargo publish token resolution: fallback to CARGO_TOKEN when CARGO_REGISTRY_TOKEN is not set, and fail instead of silently skipping publish

## 1.4.2

### Patch Changes

- 94c1953: Update lino-arguments to ^0.3.0, fix npm publish OIDC fallback, and align CI/CD workflows with reference repo best practices

## 1.4.1

### Patch Changes

- 4570a2b: Fix CI/CD release pipeline: resolve git show path bug in version-and-commit.mjs where `git show origin/main:package.json` failed because git show uses repo-root-relative paths (should be `js/package.json`). Add npx-based fallback in setup-npm.mjs for Node.js 22.22.2 broken npm issue.

## 1.4.0

### Minor Changes

- f464988: Add Google Docs document to Markdown capture support with API token authentication

## 1.3.0

### Minor Changes

- 141458e: Implement all web capture best practices from meta-theory reference scripts (R1-R7): LaTeX formula extraction (Habr, KaTeX, MathJax), article metadata extraction, markdown post-processing pipeline, animation capture with loop detection, dual-theme screenshots, figure image extraction, markdown image localization, content verification with fuzzy matching, and batch processing with JSON/MJS configuration. Add enhanced HTML-to-markdown conversion with configurable options, 3 new API endpoints (/animation, /figures, /themed-image), and expanded CLI flags.
