# Case Study: Support All Best Practices from meta-theory Web Capture Scripts

**Issue:** [#33 – Support all best practices of web capture experience from meta-theory/scripts](https://github.com/link-assistant/web-capture/issues/33)

## Summary

This case study analyzes the web capture scripts used in the
[link-foundation/meta-theory](https://github.com/link-foundation/meta-theory/tree/main/scripts)
repository and maps their capabilities to the `@link-assistant/web-capture`
package. The goal is to identify all requirements for making `web-capture` a
fully-featured library and CLI that can replace the bespoke scripts in
meta-theory, enabling [meta-theory issue #10](https://github.com/link-foundation/meta-theory/issues/10).

---

## Context

The `link-foundation/meta-theory` repository contains 8 specialized scripts for
capturing, converting, and verifying web content — primarily Habr articles. These
scripts have evolved organically to handle real-world complexities:

- Multi-language article support (Russian, English)
- LaTeX formula extraction and conversion
- Animation capture with loop detection
- Light/dark theme screenshots
- Image localization (download external images to local paths)
- Content verification against original web pages

Currently, `web-capture` (v1.2.0) supports basic HTML, Markdown, Image, PDF,
DOCX, and Archive capture — but lacks several advanced features that the
meta-theory scripts implement.

---

## Reference Scripts Analysis

### 1. `articles-config.mjs` (2.4 KB)

**Purpose:** Centralized configuration for article capture jobs.

**Key features:**
- Per-article configuration: URL, language, archive path, expected figure count
- Light/dark screenshot file naming
- Local image directory configuration
- Version-based article management

**Relevance to web-capture:** Demonstrates the need for a **batch/configuration
mode** where multiple URLs can be captured with per-URL settings.

---

### 2. `download-article.mjs` (37.8 KB)

**Purpose:** Extract article content from Habr web pages and convert to
high-quality Markdown.

**Key features:**
- **Structured content extraction:** Processes HTML elements in document order
  (headings, paragraphs, code blocks, blockquotes, lists, figures, images)
- **LaTeX formula extraction:** Detects `img.formula` elements on Habr and
  extracts the `source` attribute containing original LaTeX code; also handles
  KaTeX/MathJax annotations
- **Rich metadata extraction:** Author, publication date, reading time,
  difficulty, views, votes, comments, bookmarks, hubs, tags (with URLs),
  translation info, LD+JSON structured data
- **Code block language detection:** Extracts language from CSS classes, with
  content-based correction (e.g., detects Coq code mislabeled as MATLAB)
- **Blockquote math grouping:** Groups consecutive formula-only blockquote
  paragraphs into a single blockquote using `\displaystyle` for proper rendering
- **Post-processing pipeline:** Unicode normalization, curly quote straightening,
  em/en-dash normalization, inline LaTeX spacing fixes, bold formatting cleanup,
  GitHub percent-sign workaround (`\\%`), empty bold removal
- **Metadata block formatting:** Header and footer metadata blocks matching Habr
  article layout
- **Lazy loading support:** Scrolls through the page to trigger lazy image
  loading before extraction

**Gap analysis vs. web-capture:**

| Feature | web-capture v1.2.0 | meta-theory script |
|---------|-------------------|-------------------|
| Basic HTML→Markdown | Yes (Turndown) | Yes (custom DOM walker) |
| LaTeX formula extraction | No | Yes (Habr `img.formula` + KaTeX/MathJax) |
| Rich metadata extraction | No | Yes (20+ metadata fields) |
| Code language correction | No | Yes (content-based) |
| Blockquote math grouping | No | Yes |
| Post-processing pipeline | Partial (basic cleaning) | Comprehensive |
| Unicode normalization | No | Yes |
| Figure caption handling | Basic | Advanced (numbered, with formatting) |
| Lazy loading scroll | Yes (in popups.js) | Yes |

---

### 3. `download.mjs` (13.6 KB)

**Purpose:** Download figure images and capture themed screenshots.

**Key features:**
- **Figure image extraction:** Uses Playwright to navigate to pages, scroll to
  load lazy images, extract `<figure>` elements with captions, and download
  images with figure number naming
- **Themed screenshots:** Captures full-page screenshots in both light and dark
  themes using separate browser contexts with `colorScheme` setting
- **Popup/overlay dismissal:** Comprehensive handling of Google Funding Choices
  (FC) consent dialogs, Habr cookie banners, generic modals/overlays, fixed
  position elements, and keyboard Escape press
- **Image metadata:** Saves `metadata.json` with figure numbers, filenames, and
  captions
- **Batch processing:** Supports `--all` flag to process multiple articles
- **Multi-language figure detection:** Matches "Figure X", "Рис. X",
  "Рисунок X" in captions

**Gap analysis vs. web-capture:**

| Feature | web-capture v1.2.0 | meta-theory script |
|---------|-------------------|-------------------|
| Basic screenshots | Yes (viewport only) | Yes (full page) |
| Light/dark themed screenshots | Partial (theme option exists) | Yes (both in single run) |
| Full-page screenshot | Yes (`--fullPage` flag) | Yes (always full page) |
| Figure image extraction | No | Yes |
| Image metadata JSON | No | Yes |
| Popup dismissal | Yes (popups.js) | Yes (more comprehensive) |
| Multi-article batch mode | No | Yes (`--all`) |
| 1920x1080 viewport | No (default 1280x800) | Yes |

---

### 4. `download-markdown-images.mjs` (10.9 KB)

**Purpose:** Download external images referenced in Markdown files and update
references to local paths.

**Key features:**
- **Markdown image extraction:** Regex-based extraction of `![alt](url)` patterns
- **Selective download:** Filters to only external images (habrastorage.org, etc.)
  that haven't been localized yet
- **Retry logic:** Downloads with 3 retries, timeout handling, redirect following
- **Markdown rewriting:** Updates image references from remote URLs to local
  `images/filename` paths
- **Dry-run mode:** Preview changes without modifying files
- **Metadata tracking:** Saves mapping of original URLs to local filenames

**Gap analysis vs. web-capture:**

| Feature | web-capture v1.2.0 | meta-theory script |
|---------|-------------------|-------------------|
| Archive with local images | Yes (archive.js) | Yes |
| Markdown image localization | Partial (in archive mode) | Yes (standalone) |
| Retry with backoff | Yes (retry.js) | Yes (custom) |
| Image metadata JSON | No | Yes |
| Dry-run mode | No | Yes |
| Post-capture localization | No | Yes |

---

### 5. `capture-animation.mjs` (61.9 KB)

**Purpose:** Universal animation capture tool — converts web animations to GIF,
MP4, or WebM.

**Key features:**
- **Three capture modes:**
  - `screencast`: CDP push model (30–60 FPS), Chrome sends frames as composited
  - `beginframe`: Deterministic, frame-perfect capture via
    `HeadlessExperimental.beginFrame` (controls animation clock)
  - `screenshot`: Polling-based fallback (3–8 FPS)
- **Loop detection:** Tracks pixel similarity to first frame, detects periodic
  peaks (two consecutive peaks = one full cycle), trims to exact cycle boundaries
- **Auto-crop:** Detects content bounds across all frames, applies centered
  padding with background fill
- **Supersampling anti-aliasing:** Captures at 2x resolution and downscales with
  area-averaging for maximum quality
- **GIF encoding:** Uses `gif-encoder-2` with octree color quantization (256
  colors, no dithering blur)
- **Video output:** MP4 (H.264) and WebM (VP9) via ffmpeg
- **Real-time frame delays:** Uses actual capture timestamps for GIF frame
  timing, so playback matches original animation speed
- **Speed control:** Configurable playback speed multiplier
- **Preheat mode:** Captures twice, uses second (warmer) run for better quality
- **Key frame extraction:** Exports 3 PNG key frames for quality verification
- **Extensive configuration:** 25+ CLI options for fine-tuning capture behavior

**Gap analysis vs. web-capture:**

| Feature | web-capture v1.2.0 | meta-theory script |
|---------|-------------------|-------------------|
| Static screenshots | Yes | N/A |
| Animation capture to GIF | No | Yes |
| Animation capture to MP4/WebM | No | Yes |
| CDP screencast capture | No | Yes |
| Deterministic beginFrame capture | No | Yes |
| Loop detection | No | Yes |
| Auto-crop to content | No | Yes |
| Supersampling anti-aliasing | No | Yes |
| Speed control | No | Yes |

---

### 6. `verify.mjs` (22.8 KB)

**Purpose:** Verify captured Markdown articles against original web pages.

**Key features:**
- **Content comparison:** Extracts headings, paragraphs, code blocks, formulas,
  list items, links, and figures from both web page and Markdown file
- **Normalized comparison:** Handles Unicode normalization, LaTeX delimiters,
  arrow/multiplication sign variants, quote normalization
- **Section-by-section verification:** Checks title, headings, paragraphs, code
  blocks, formulas, links, and figures individually
- **Coverage scoring:** Reports percentage of web content found in Markdown
- **Image file verification:** Checks that referenced local images exist and
  match expected figure count

**Gap analysis vs. web-capture:**

| Feature | web-capture v1.2.0 | meta-theory script |
|---------|-------------------|-------------------|
| Capture verification | No | Yes |
| Content coverage scoring | No | Yes |
| Image reference validation | No | Yes |

---

### 7. `test-capture-quality.mjs` (15.0 KB)

**Purpose:** Automated quality tests for animation capture output.

**Key features:**
- Validates GIF89a format with correct loop structure
- Checks frame count, dimensions, and timing
- Compares browser-captured key frames vs. GIF-extracted frames
- Detects blank or identical consecutive frames
- Tests color fidelity
- Validates MP4/WebM output via ffmpeg

---

### 8. `check-file-size.mjs` (2.4 KB)

**Purpose:** Enforces maximum line count (1500 lines) on files in drafts/.

**Relevance to web-capture:** Demonstrates a CI quality gate pattern that could
be useful for validating captured content.

---

## Requirements Extracted

Based on the analysis above, here is the complete list of requirements derived
from the meta-theory scripts:

### R1: Enhanced Markdown Conversion Quality

**Priority:** High
**Description:** Improve HTML-to-Markdown conversion to handle complex content:
- LaTeX formula extraction from `img.formula` elements (Habr) and KaTeX/MathJax
- Rich article metadata extraction (author, date, views, hubs, tags, etc.)
- Code block language detection with content-based correction
- Blockquote math grouping with `\displaystyle`
- Comprehensive post-processing: Unicode normalization, quote straightening,
  dash normalization, LaTeX spacing fixes, GitHub percent workaround

### R2: Animation Capture

**Priority:** High
**Description:** Support capturing web animations as GIF, MP4, or WebM:
- Multiple capture modes (screencast, beginframe, screenshot)
- Automatic loop detection via pixel similarity
- Auto-crop to animation content
- Supersampling for high-quality output
- Configurable speed, FPS, and quality settings
- Real-time frame timing preservation

### R3: Themed Screenshot Capture

**Priority:** Medium
**Description:** Support capturing screenshots in both light and dark themes in a
single operation:
- Use separate browser contexts with `colorScheme` setting
- Full-page capture at 1920x1080 viewport
- Output separate light and dark files

### R4: Figure Image Extraction and Download

**Priority:** Medium
**Description:** Extract and download figure images from web pages:
- Detect `<figure>` elements with captions
- Multi-language figure number detection (English/Russian)
- Download images with figure-numbered filenames
- Generate image metadata JSON
- Support for lazy-loaded images via scroll triggering

### R5: Markdown Image Localization

**Priority:** Medium
**Description:** Post-process Markdown to download external images and update
references:
- Extract image URLs from Markdown syntax
- Download with retry and redirect handling
- Update Markdown references to local paths
- Dry-run mode for preview
- Generate image metadata

### R6: Content Verification

**Priority:** Medium
**Description:** Verify captured content against source web pages:
- Compare headings, paragraphs, code blocks, formulas, links, figures
- Normalized text comparison (Unicode, LaTeX, quotes)
- Coverage scoring (percentage of content captured)
- Image file existence verification

### R7: Batch Processing and Configuration

**Priority:** Low
**Description:** Support processing multiple URLs with per-URL configuration:
- Configuration file format for article definitions
- `--all` flag for batch operations
- Per-article settings: language, archive path, expected figure count, etc.

### R8: Enhanced Popup Dismissal

**Priority:** Low
**Description:** Expand popup handling beyond current capabilities:
- Google Funding Choices (FC) consent dialog handling
- Cookie banner close with site-specific selectors
- Fixed-position overlay detection and removal
- Keyboard Escape press for modal dismissal

---

## Proposed Solutions

### Solution for R1: Enhanced Markdown Conversion

**Approach:** Extend `lib.js` with a new `EnhancedMarkdownConverter` class that
wraps the existing Turndown-based conversion with pre/post-processing stages.

**Implementation plan:**

1. **LaTeX extraction preprocessor** (new file: `src/latex.js`)
   - Before Turndown conversion, scan HTML for `img.formula` elements and replace
     with `$...$` Markdown delimiters using the `source` attribute
   - Also handle KaTeX (`.katex`), MathJax (`mjx-container`), and generic
     `.math` class elements
   - Support both inline (`$...$`) and block (`$$...$$`) math

2. **Metadata extractor** (new file: `src/metadata.js`)
   - Extract structured metadata from web pages using configurable CSS selectors
   - Default selectors for Habr articles, extensible for other sites
   - Output as YAML front matter or Markdown header block

3. **Code language correction** (extend `lib.js`)
   - Add a `detectCodeLanguage(code, declaredLanguage)` function
   - Pattern-based detection for common misidentifications (Coq/MATLAB, etc.)

4. **Post-processing pipeline** (new file: `src/postprocess.js`)
   - Unicode normalization (non-breaking spaces, curly quotes, dashes, ellipsis)
   - LaTeX spacing fixes (space around `$...$` delimiters)
   - Bold formatting cleanup
   - GitHub-specific workarounds (percent sign in math)
   - Configurable pipeline with enable/disable per stage

**Existing components to leverage:**
- [Turndown](https://www.npmjs.com/package/turndown) (v7.1.1) — already used in
  web-capture for base HTML-to-Markdown conversion
- [Cheerio](https://www.npmjs.com/package/cheerio) (v1.0.0) — already used for
  HTML parsing, can be used for LaTeX extraction
- [turndown-plugin-gfm](https://www.npmjs.com/package/turndown-plugin-gfm) —
  already used for GFM table support

**External libraries to consider:**
- [rehype-katex](https://www.npmjs.com/package/rehype-katex) — KaTeX rendering
  for verification
- [remark-math](https://www.npmjs.com/package/remark-math) — math syntax
  plugin for remark/unified ecosystem

---

### Solution for R2: Animation Capture

**Approach:** Add a new `animation` capture format to both CLI and API.

**Implementation plan:**

1. **Core animation module** (new file: `src/animation.js`)
   - Implement three capture modes: `screencast`, `beginframe`, `screenshot`
   - Frame-level pixel comparison for loop detection using `pngjs`
   - Auto-crop logic with background detection and centered padding
   - Downscaling with area-averaging for supersampling quality

2. **GIF encoding** (new file: `src/gif.js`)
   - Use `gif-encoder-2` with octree quantization
   - Real-time frame delay calculation from capture timestamps
   - Speed multiplier support

3. **Video encoding** (new file: `src/video.js`)
   - MP4 (H.264) and WebM (VP9) output via `ffmpeg` (child process)
   - Fallback error message if ffmpeg not available

4. **CLI integration** (extend `bin/web-capture.js`)
   - New format options: `gif`, `mp4`, `webm`
   - New CLI options: `--fps`, `--speed`, `--max-size`, `--capture-mode`,
     `--loop-timeout`, `--min-frames`, etc.

5. **API integration** (extend `src/index.js`)
   - New endpoint: `GET /animation?url=<URL>&format=gif&maxSize=1024`
   - Streaming response for large animations

**New dependencies required:**
- [gif-encoder-2](https://www.npmjs.com/package/gif-encoder-2) — GIF encoding
  with octree color quantization
- [pngjs](https://www.npmjs.com/package/pngjs) — PNG decode/encode for pixel
  comparison and frame manipulation
- [jpeg-js](https://www.npmjs.com/package/jpeg-js) — JPEG decode for screencast
  frames (if JPEG format used)
- [sharp](https://www.npmjs.com/package/sharp) (optional) — High-performance
  image resizing as alternative to manual area-averaging

**External tools:**
- `ffmpeg` — Required for MP4/WebM output (detected at runtime, not a hard
  dependency)

---

### Solution for R3: Themed Screenshot Capture

**Approach:** Extend existing image capture with a `--themes` option.

**Implementation plan:**

1. **Extend `src/image.js`:**
   - Add `captureThemedScreenshots(url, options)` function
   - Creates separate browser contexts for each theme (light, dark)
   - Each context uses `colorScheme` at context level (most reliable for
     `prefers-color-scheme` media queries)
   - Returns multiple buffers with theme-based filenames

2. **CLI integration:**
   - `--theme light,dark` — capture both themes
   - `--theme all` — shorthand for light + dark
   - Output filenames: `{name}-light.png`, `{name}-dark.png`

3. **API integration:**
   - `GET /image?url=<URL>&theme=light,dark` returns ZIP with both screenshots
   - Or two separate requests with `theme=light` / `theme=dark`

**No new dependencies needed** — uses existing Playwright `colorScheme` context
option already available via browser-commander.

---

### Solution for R4: Figure Image Extraction

**Approach:** Add a new `figures` extraction mode.

**Implementation plan:**

1. **New module** (new file: `src/figures.js`)
   - Navigate to page with Playwright
   - Scroll to trigger lazy loading
   - Extract `<figure>` elements with `<img>` and `<figcaption>`
   - Multi-language figure number regex: `/(?:Figure|Рис\.?|Рисунок)\s*(\d+)/i`
   - Download images with retry logic (reuse `src/retry.js`)
   - Generate `metadata.json`

2. **CLI integration:**
   - `web-capture <url> --format figures --output ./images/`
   - Or as part of archive: `--format archive --extract-figures`

3. **API integration:**
   - `GET /figures?url=<URL>` returns JSON with figure metadata
   - `GET /figures?url=<URL>&download=true` returns ZIP with images

**No new dependencies needed** — uses existing Playwright, retry logic, and
archiver.

---

### Solution for R5: Markdown Image Localization

**Approach:** Add a post-processing utility for localizing images in Markdown.

**Implementation plan:**

1. **New module** (new file: `src/localize-images.js`)
   - Parse Markdown for `![alt](url)` patterns
   - Filter to external URLs only
   - Download images with retry, redirect handling, User-Agent header
   - Rewrite Markdown references to local paths
   - Support dry-run mode
   - Generate metadata JSON

2. **CLI integration:**
   - `web-capture localize --input article.md --images-dir ./images/`
   - `--dry-run` flag for preview

**No new dependencies needed** — uses existing `node-fetch` and retry logic.

---

### Solution for R6: Content Verification

**Approach:** Add a `verify` subcommand.

**Implementation plan:**

1. **New module** (new file: `src/verify.js`)
   - Extract structured content from source URL (headings, paragraphs, code,
     formulas, links, figures)
   - Extract same structure from captured Markdown file
   - Normalize both for comparison (Unicode, LaTeX, quotes, arrows)
   - Compare section by section with fuzzy matching
   - Report coverage percentage and missing items
   - Verify referenced image files exist

2. **CLI integration:**
   - `web-capture verify --url <URL> --file article.md`
   - Exit code: 0 if coverage >= threshold, 1 otherwise
   - `--threshold 0.9` — minimum acceptable coverage (default 90%)

3. **API integration:**
   - `POST /verify` with URL and Markdown body
   - Returns JSON report with coverage scores

**No new dependencies needed** — uses existing Playwright and Cheerio.

---

### Solution for R7: Batch Processing

**Approach:** Add configuration file support.

**Implementation plan:**

1. **Configuration format** (JSON or YAML):
   ```json
   {
     "articles": [
       {
         "url": "https://habr.com/...",
         "language": "en",
         "outputDir": "./archive/0.0.0",
         "formats": ["markdown", "image"],
         "themes": ["light", "dark"],
         "extractFigures": true,
         "expectedFigures": 12
       }
     ]
   }
   ```

2. **CLI integration:**
   - `web-capture batch --config articles.json`
   - `web-capture batch --config articles.json --article 0.0.2`
   - Support `--all`, `--dry-run`

**No new dependencies needed** — uses existing `lino-arguments` for config
loading.

---

### Solution for R8: Enhanced Popup Dismissal

**Approach:** Extend existing `popups.js` with additional selectors and
strategies.

**Implementation plan:**

1. **Extend `src/popups.js`:**
   - Add Google Funding Choices (FC) consent dialog selectors
   - Add Habr-specific cookie banner selectors
   - Add fixed-position overlay detection (large elements with `position: fixed`)
   - Add Escape key press for modals
   - Make selector list configurable via options

**No new dependencies needed.**

---

## Implementation Priority and Roadmap

| Phase | Requirements | Estimated Scope |
|-------|-------------|-----------------|
| **Phase 1** (MVP) | R1 (Enhanced Markdown), R8 (Popup Dismissal) | Medium — extends existing modules |
| **Phase 2** (Core) | R3 (Themed Screenshots), R4 (Figure Extraction), R5 (Image Localization) | Medium — new modules, existing deps |
| **Phase 3** (Advanced) | R2 (Animation Capture) | Large — new deps, complex logic |
| **Phase 4** (Quality) | R6 (Content Verification), R7 (Batch Processing) | Medium — new modules, testing |

---

## External Libraries and Tools Summary

### Already used in web-capture

| Library | Version | Usage |
|---------|---------|-------|
| Turndown | 7.1.1 | HTML→Markdown |
| Cheerio | 1.0.0 | HTML parsing |
| Playwright | 1.49.0 | Browser automation |
| Puppeteer | 24.8.2 | Browser automation |
| browser-commander | 0.8.0 | Unified browser API |
| Archiver | 7.0.1 | ZIP creation |
| iconv-lite | 0.6.3 | Encoding |
| node-fetch | 2.7.0 | HTTP client |

### New dependencies needed

| Library | Version | Usage | Required for |
|---------|---------|-------|-------------|
| gif-encoder-2 | ^2.0.0 | GIF encoding | R2 (Animation) |
| pngjs | ^7.0.0 | PNG manipulation | R2 (Animation) |
| jpeg-js | ^0.4.4 | JPEG decode | R2 (Animation, screencast mode) |
| sharp | ^0.33.0 | Image resize (optional) | R2 (Animation, high-quality downscale) |

### External tools (runtime, not npm)

| Tool | Usage | Required for |
|------|-------|-------------|
| ffmpeg | Video encoding | R2 (MP4/WebM output) |

---

## References

### Source scripts analyzed
- [articles-config.mjs](https://github.com/link-foundation/meta-theory/blob/main/scripts/articles-config.mjs)
- [capture-animation.mjs](https://github.com/link-foundation/meta-theory/blob/main/scripts/capture-animation.mjs)
- [download-article.mjs](https://github.com/link-foundation/meta-theory/blob/main/scripts/download-article.mjs)
- [download-markdown-images.mjs](https://github.com/link-foundation/meta-theory/blob/main/scripts/download-markdown-images.mjs)
- [download.mjs](https://github.com/link-foundation/meta-theory/blob/main/scripts/download.mjs)
- [verify.mjs](https://github.com/link-foundation/meta-theory/blob/main/scripts/verify.mjs)
- [test-capture-quality.mjs](https://github.com/link-foundation/meta-theory/blob/main/scripts/test-capture-quality.mjs)
- [check-file-size.mjs](https://github.com/link-foundation/meta-theory/blob/main/scripts/check-file-size.mjs)

### Existing web-capture documentation
- [ARCHITECTURE.md](https://github.com/link-assistant/web-capture/blob/main/ARCHITECTURE.md)
- [README.md](https://github.com/link-assistant/web-capture/blob/main/README.md)

### Related tools and libraries
- [gif-encoder-2](https://www.npmjs.com/package/gif-encoder-2) — GIF encoding with octree quantization
- [pngjs](https://www.npmjs.com/package/pngjs) — PNG decode/encode for pixel operations
- [sharp](https://www.npmjs.com/package/sharp) — High-performance Node.js image processing
- [puppeteer-capture](https://alexey-pelykh.com/blog/why-i-built-puppeteer-capture/) — Deterministic frame capture via HeadlessExperimental.beginFrame
- [HTML2GIF](https://github.com/akhi07rx/HTML2GIF) — Puppeteer + ffmpeg webpage-to-GIF converter
- [capture-website](https://www.npmjs.com/package/capture-website) — Screenshot capture library
- [scrape2md](https://github.com/tarasglek/scrape2md) — Web content to Markdown converter
- [Playwright CDPSession](https://playwright.dev/docs/api/class-cdpsession) — CDP integration for screencast
- [Playwright Screencast](https://playwright.dev/docs/api/class-screencast) — Built-in screencast API
