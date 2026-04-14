# Case Study: Issue #58 — v0.2.1 Archive Quality Bugs

## Timeline

| Date | Event |
|------|-------|
| 2026-04-14 | Issue #58 filed after testing `web-capture v0.2.1` against Google Docs test documents |
| 2026-04-14 | Comment from maintainer requesting deep case study analysis with root causes |

## Summary

After the v0.2.1 release (which fixed the ZIP container issues from #53), five new quality bugs were discovered in the archive output. While the ZIP is now a valid archive with real images, the content inside has several usability problems.

## Requirements Traced from Issue

| ID | Requirement | Acceptance Criteria |
|----|-------------|-------------------|
| A | Markdown image refs must use relative paths | `document.md` image refs use `images/image-NN.ext` (relative), not fabricated absolute URLs |
| B | Image count parity between md and html | Markdown and HTML inside the same archive reference the exact same set of images |
| C | HTML output must be pretty-printed | HTML output has indentation by default; opt-out via `--no-pretty-html` / env var |
| D | HTML entities decoded to Unicode | Text content in all formats uses Unicode, not raw entities. Structural escaping preserved. |
| E | Filenames: `document.*` not `article.*` | All internal filenames use `document.md`, `document.html`; no `article.*` anywhere |
| Parity | JS implementation matches Rust | All fixes applied identically in both implementations |

## Root Cause Analysis

### Bug A: Fabricated Image URLs in Markdown

**Root cause**: In `rust/src/gdocs.rs:fetch_google_doc_as_archive()` (line 316-317), the HTML-to-Markdown conversion is called with `result.export_url` as the base URL. The `convert_html_to_markdown` function in `rust/src/markdown.rs:27-33` calls `convert_relative_urls(html, base)` which converts the already-localized `images/image-01.png` paths back to absolute URLs using the Google Docs export URL as base, producing fabricated URLs like `https://docs.google.com/document/d/<ID>/images/image-01.png`.

**Same issue in JS**: `js/src/gdocs.js:216` passes `result.exportUrl` as base URL to `convertHtmlToMarkdown(localHtml, result.exportUrl)`.

**Fix**: Pass `None`/`null` as the base URL when converting already-localized HTML to Markdown in the archive pipeline. The relative `images/` paths are already correct and should not be resolved against any base URL.

### Bug B: Image Count Mismatch

**Root cause**: Related to Bug A. When `convert_html_to_markdown` processes the HTML with a base URL, it calls `convert_relative_urls` which may alter or break some image references. The `html2md` crate (Rust) or Turndown (JS) may also drop certain images during conversion — e.g., images inside certain HTML structures (tables, nested divs) that the Markdown converter doesn't handle. The fix for Bug A (passing no base URL) should resolve most of the mismatch. Any remaining discrepancy is due to the HTML-to-Markdown converter not handling all `<img>` tags.

### Bug C: No HTML Pretty-Printing

**Root cause**: The HTML content from Google Docs export is written directly to the archive without any formatting. In `rust/src/gdocs.rs:352-353`, `archive.html` is written as `archive.html.as_bytes()` — the raw HTML string. In `js/src/gdocs.js:290`, `archiveResult.html` is appended as-is. Neither implementation applies any indentation or pretty-printing.

**Fix**: Add an HTML pretty-printer step before writing HTML to archives and standalone files. Rust has no built-in pretty-printer in the current deps, but a simple regex-based or tag-aware indenter can be added. JS can use a lightweight formatter.

### Bug D: Incomplete HTML Entity Decoding

**Root cause**: The entity decoding in `rust/src/gdocs.rs:148-151` decodes the raw Google Docs export content. However, `decode_html_entities` is applied *before* the HTML is parsed for image extraction and Markdown conversion. The Markdown converter (`html2md`) may re-introduce entities during conversion. Additionally, in `rust/src/markdown.rs:43`, `decode_html_entities` is called on the Markdown output, but `html2md::parse_html` can produce entities that `html_escape::decode_html_entities` doesn't fully handle (e.g., `&nbsp;` → non-breaking space should become a regular space in Markdown context).

**Fix**: Ensure the decode step happens as the final post-processing step on the output content, and handle `&nbsp;` specifically (replace with regular space in Markdown).

### Bug E: `article.*` vs `document.*` Filenames

**Root cause**: The original codebase was designed with Habr.com article capture in mind, so the default filenames used `article.*`. The rename to `document.*` was partially done in `main.rs:946` (`derive_output_path` returns `document.{ext}`) but not in the archive internals or batch configuration.

**Affected locations** (exhaustive):

| File | Line(s) | Current | Target |
|------|---------|---------|--------|
| `rust/src/gdocs.rs` | 297-298, 348, 352 | `article.md`, `article.html` | `document.md`, `document.html` |
| `rust/src/batch.rs` | 147-149 | `article.md`, `article-light.png`, `article-dark.png` | `document.md`, `document-light.png`, `document-dark.png` |
| `js/src/gdocs.js` | 197-199, 289-290 | `article.md`, `article.html` | `document.md`, `document.html` |
| `js/src/batch.js` | 142-144 | `article.md`, `article-light.png`, `article-dark.png` | `document.md`, `document-light.png`, `document-dark.png` |
| `js/src/archive.js` | 1-16, 144, 179 | `article.md`, `article.html` | `document.md`, `document.html` |
| Tests (Rust & JS) | various | assert `article.*` | assert `document.*` |

## Solutions Implemented

See the pull request diff for the complete implementation.

### Libraries Considered for Bug C (HTML Pretty-Printing)

- **Rust**: No standalone HTML pretty-printer crate was ideal. Implemented a lightweight tag-aware indenter using string processing, which handles the common case of Google Docs HTML output.
- **JS**: Used a simple regex-based approach matching the Rust implementation for parity.

### Libraries Considered for Bug D (Entity Decoding)

- **Rust**: Already using `html-escape` crate — it handles named and numeric entities. Added `&nbsp;` → space normalization as a post-processing step.
- **JS**: Already using `he` library — comprehensive entity decoder. Same `&nbsp;` normalization added.
