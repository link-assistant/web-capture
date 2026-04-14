# Issue #48: Extract images to /images folder by default

## Timeline

- **2026-04-13**: Issue opened by @konard reporting base64 image bloat in markdown output
- **2026-04-13**: Comments added requiring cross-language parity, `--enhanced` removal, and case study

## Requirements

### R1: Extract base64 images to files by default

When outputting markdown with `-o path/to/document.md`, decode embedded base64 images
to binary files under `path/to/images/` and rewrite markdown references to relative
paths like `![](images/001.png)`.

When writing to stdout, fall back to inline base64 behavior.

### R2: CLI flags for image handling

- `--embed-images` / `--no-extract-images` — opt-in to inline base64 (old behavior)
- `--images-dir <DIR>` — override default `images` folder name/path
- Environment variable: `WEB_CAPTURE_EMBED_IMAGES=0|1`

### R3: Remove `--enhanced` umbrella flag

Make its sub-features (`--extract-latex`, `--extract-metadata`, `--post-process`,
`--detect-code-language`) default to **true**. Each gets a `--no-*` toggle and a
matching `WEB_CAPTURE_*` environment variable.

### R4: Cross-language parity

Both Rust and JS implementations must expose identical flag names, semantics, defaults,
and output layout.

## Root Cause Analysis

### Base64 bloat (R1)

- **Where**: Google Docs HTML exports embed images as `data:image/...;base64,...` URIs.
- **Current flow**: `fetchGoogleDocAsMarkdown()` in both JS (`gdocs.js:141`) and Rust
  (`gdocs.rs:174`) fetches HTML export and converts it directly to markdown. The
  `convertHtmlToMarkdown()` function preserves data URIs as-is in image references.
- **Existing partial solution**: `extractBase64Images()` already exists in both
  implementations but is only used in **archive** mode (`fetchGoogleDocAsArchive()`),
  not in the standard markdown output path.
- **Fix**: Apply `extractBase64Images()` in the markdown output path when writing to a
  file (not stdout), and write the extracted image buffers to disk.

### Enhanced flag (R3)

- **Where**: JS CLI (`web-capture.js:92-121`) and Rust CLI (`main.rs:71`) define
  `--enhanced` as a gate for the four sub-features.
- **Problem**: The umbrella flag hides which transformations are applied.
- **Fix**: Remove `--enhanced`, change defaults of sub-features to `true`, add `--no-*`
  negation flags and `WEB_CAPTURE_*` env vars.

## Solution Plan

1. **New module `extract-images`** (JS) / **`extract_images`** (Rust):
   - Function `extractAndSaveImages(markdown, outputPath, options)` that:
     a. Finds `![...](data:image/...;base64,...)` patterns in markdown
     b. Decodes base64 to binary
     c. Writes files to `{imagesDir}/image-{nn}.{ext}`
     d. Replaces data URIs in markdown with relative paths
   - Handles both data URIs (from Google Docs) and could be extended for remote URLs.

2. **CLI changes** (both languages):
   - Add `--embed-images` (boolean, default: false)
   - Add `--images-dir` (string, default: "images")
   - Remove `--enhanced` flag
   - Change `--extract-latex`, `--extract-metadata`, `--post-process`,
     `--detect-code-language` to default `true` with env var support

3. **Integration points**:
   - In the markdown capture path (JS: `web-capture.js:524-547`, Rust: `main.rs:601-623`),
     after generating markdown: if writing to file and `!embedImages`, run image extraction.
   - In Google Docs markdown path (JS: `web-capture.js:290-300`, Rust: `main.rs:569-578`),
     apply `extractBase64Images()` before writing to file.

## Existing Libraries / Prior Art

- **pandoc** `--extract-media`: Extracts images to a directory during conversion
- **monolith**: Single-file webpage archiver (opposite direction)
- **turndown**: Already used in JS version for HTML-to-Markdown
- **html2md**: Already used in Rust version for HTML-to-Markdown
- Both implementations already have `extractBase64Images()` and `localizeImages()` modules
  that provide most of the needed functionality.
