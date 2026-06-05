# Case Study: Issue #53 — Google Docs archive and image extraction bugs

## Timeline

1. **v0.2.0 release** — Google Docs support added with `--archive zip` and image extraction features
2. **Issue #53 filed** — Six bugs discovered in the Google Docs capture path

## Requirements from Issue

1. `--archive zip` must produce a real ZIP archive (not raw HTML)
2. Default markdown mode must extract base64 images to `images/` directory (not strip them)
3. `WEB_CAPTURE_KEEP_ORIGINAL_LINKS=false` must be honored on the Google Docs path
4. Auto-derived archive path must use correct extension (`document.zip`, not `document.archive`)
5. Auto-derived archive path must also produce a real ZIP (same root cause as #1)
6. `--archive` without `-o` must still write under `./data/web-capture/<host>/<path>/`
7. Cross-language parity: Rust and JavaScript must behave identically

## Root Causes

### Bug 1 & 5: Archive writes raw HTML instead of ZIP

**Rust (`rust/src/main.rs`):** `capture_url()` receives `"archive"` as the format string (set by the `--archive` flag handler at line 211). However, the Google Docs match in `capture_url()` only handled `"markdown" | "md"` — the `_` catch-all arm called `fetch_google_doc()` with format `"archive"`, which Google's export API doesn't understand, so it fell back to HTML. The raw HTML response was then written to the output path verbatim.

The library already had `fetch_google_doc_as_archive()` and `create_archive_zip()` functions that correctly create ZIP archives, but `capture_url()` never called them for the CLI path.

**JavaScript (`js/bin/web-capture.js`):** Identical structural issue — the `isGoogleDocsUrl()` block only handled `'markdown'`/`'md'`, with the `else` branch writing raw HTML. The non-Google-Docs archive path (which uses `archiver` library) worked correctly but was never reached for Google Docs URLs.

### Bug 2: Default markdown strips all images

**Root cause:** When `embed_images` is false (the default), both Rust and JS called `strip_base64_images()` which removes all base64 data URIs and replaces them with text placeholders. For Google Docs exports, which contain **only** base64-encoded images (no remote URLs), this effectively discards every image.

The correct behavior is to call `extract_and_save_images()` which decodes the base64 data to actual PNG/JPG files in an `images/` directory and rewrites the markdown references to point to those files.

### Bug 3: keep_original_links ignored

**Root cause:** The code checked `!embed_images` but never consulted `keep_original_links`. The logic should be:
- `embed_images=true` → keep base64 inline
- `keep_original_links=true` → strip base64 (no original URL to keep)
- Both false (default) → extract to files

## Fix Summary

### Rust changes (`rust/src/main.rs`)
- Added `"archive"` match arm for Google Docs: calls `fetch_google_doc_as_archive()` + `create_archive_zip()`
- Added `"archive"` match arm for regular URLs: uses `extract_base64_to_buffers()` + `create_archive_zip()`
- Fixed markdown image handling: three-way branch (embed → keep inline, keep_original_links → strip, default → extract to files)
- Fixed archive extension: passes actual format (`zip`/`7z`/`tar.gz`/`tar`) to `derive_output_path()`

### JavaScript changes (`js/bin/web-capture.js`, `js/src/markdown.js`)
- Added `'archive'`/`'zip'` handling for Google Docs using `fetchGoogleDocAsArchive()`
- Fixed markdown image handling: same three-way branch as Rust
- Removed unused `keepOriginalLinks` variable from API markdown handler

### Tests added
- Rust: `test_create_archive_zip_produces_valid_zip`, `test_create_archive_zip_empty_images`
- JS: 4 tests for image extraction pipeline (HTML extraction, disk extraction, stripping, buffer extraction)
