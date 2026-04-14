# web-capture (JavaScript/Node.js)

[![npm version](https://img.shields.io/npm/v/@link-assistant/web-capture?label=npm&color=blue)](https://www.npmjs.com/package/@link-assistant/web-capture)
[![npm downloads](https://img.shields.io/npm/dm/@link-assistant/web-capture?label=downloads&color=blue)](https://www.npmjs.com/package/@link-assistant/web-capture)
[![GitHub Release](https://img.shields.io/github/v/release/link-assistant/web-capture?label=GitHub%20Release)](https://github.com/link-assistant/web-capture/releases)
[![CI - JavaScript](https://img.shields.io/github/actions/workflow/status/link-assistant/web-capture/js.yml?branch=main&label=CI)](https://github.com/link-assistant/web-capture/actions/workflows/js.yml)
[![License: Unlicense](https://img.shields.io/badge/license-Unlicense-green)](https://unlicense.org)

A CLI and microservice to fetch URLs and render them as:

- **Markdown**: Converted from HTML with image extraction (default)
- **HTML**: Rendered page content
- **PNG/JPEG screenshot**: Viewport or full-page capture with theme support
- **ZIP archive**: Markdown + locally downloaded images
- **PDF**: Print-quality document with embedded images
- **DOCX**: Word document with embedded images

## Installation

### From npm

```bash
npm install -g @link-assistant/web-capture
```

### From Source

```bash
cd js
npm install
```

## Quick Start

### CLI Usage

```bash
# Capture a URL as Markdown (default format)
# Output auto-derived to ./data/web-capture/<host>/<path>/document.md
web-capture https://example.com

# Capture as Markdown to a specific file
web-capture https://example.com -o page.md

# Write to stdout explicitly
web-capture https://example.com -o -

# Capture as HTML
web-capture https://example.com --format html -o page.html

# Take a PNG screenshot
web-capture https://example.com --format png -o screenshot.png

# Take a JPEG screenshot with custom quality
web-capture https://example.com --format jpeg --quality 60 -o screenshot.jpg

# Dark theme full-page screenshot
web-capture https://example.com --format png --theme dark --fullPage -o dark.png

# Custom viewport size
web-capture https://example.com --format png --width 1920 --height 1080 -o wide.png

# Download as PDF
web-capture https://example.com --format pdf -o page.pdf

# Download as DOCX
web-capture https://example.com --format docx -o page.docx

# Create a ZIP archive (default: zip format)
web-capture https://example.com --archive

# Create a ZIP archive with specific format
web-capture https://example.com --archive zip -o site.zip
web-capture https://example.com --archive tar.gz -o site.tar.gz

# Keep images inline as base64 (opt-in)
web-capture https://example.com --embed-images -o page.md

# Custom images directory
web-capture https://example.com --images-dir assets -o page.md

# Disable specific features
web-capture https://example.com --no-extract-latex --no-post-process -o page.md

# Start as API server
web-capture --serve

# Start server on custom port
web-capture --serve --port 8080
```

### Google Docs

```bash
# Capture public Google Doc as Markdown
web-capture https://docs.google.com/document/d/DOC_ID/edit

# Capture private Google Doc with API token
web-capture https://docs.google.com/document/d/DOC_ID/edit --apiToken YOUR_TOKEN
```

## API Endpoints (Server Mode)

Start the server with `web-capture --serve` and use the endpoints below.

### HTML Endpoint

```
GET /html?url=<URL>&engine=<ENGINE>
```

Returns the raw HTML content of the specified URL.

| Parameter | Required | Description                          | Default   |
| --------- | -------- | ------------------------------------ | --------- |
| `url`     | Yes      | URL to fetch                         | -         |
| `engine`  | No       | Browser engine: puppeteer/playwright | puppeteer |

### Markdown Endpoint

```
GET /markdown?url=<URL>
```

Converts the HTML content of the specified URL to Markdown format. By default, original remote image URLs are preserved and base64 data URIs are stripped (clean single-file output). Use `keepOriginalLinks=false` to strip all images, or `embedImages=true` to keep base64 images inline.

| Parameter           | Required | Description                                | Default |
| ------------------- | -------- | ------------------------------------------ | ------- |
| `url`               | Yes      | URL to fetch                               | -       |
| `embedImages`       | No       | Keep base64 images inline (`true`/`false`) | `false` |
| `keepOriginalLinks` | No       | Keep original remote URLs, strip base64    | `true`  |

### Image Endpoint

```
GET /image?url=<URL>&format=png&theme=dark&width=1920&height=1080&fullPage=true
```

Returns a screenshot of the specified URL.

| Parameter       | Required | Description                              | Default         |
| --------------- | -------- | ---------------------------------------- | --------------- |
| `url`           | Yes      | URL to capture                           | -               |
| `engine`        | No       | Browser engine: puppeteer/playwright     | puppeteer       |
| `format`        | No       | Image format: `png` (lossless) or `jpeg` | png             |
| `quality`       | No       | JPEG quality 0-100 (ignored for PNG)     | 80              |
| `width`         | No       | Viewport width in pixels                 | 1280            |
| `height`        | No       | Viewport height in pixels                | 800             |
| `fullPage`      | No       | Capture full scrollable page             | false           |
| `theme`         | No       | Color scheme: `light`, `dark`            | browser default |
| `dismissPopups` | No       | Auto-close cookie/consent popups         | true            |

### Archive Endpoint

```
GET /archive?url=<URL>&localImages=true&documentFormat=markdown
```

Returns a ZIP archive containing either `document.md` or `document.html` and asset directories (`images/`, `css/`).

| Parameter           | Required | Description                                  | Default    |
| ------------------- | -------- | -------------------------------------------- | ---------- |
| `url`               | Yes      | URL to archive                               | -          |
| `localImages`       | No       | Download images locally into the archive     | `true`     |
| `documentFormat`    | No       | Document format: `markdown` or `html`        | `markdown` |
| `embedImages`       | No       | Keep base64 images inline in the document    | `false`    |
| `keepOriginalLinks` | No       | Keep original remote URLs (skip downloading) | `false`    |

**Archive structure** (with `localImages=true`):

```
archive.zip
├── document.md       # or document.html when documentFormat=html
├── images/
│   ├── image-1.png
│   ├── image-2.jpg
│   └── ...
└── css/              # only when documentFormat=html
    ├── style-1.css
    └── ...
```

### PDF Endpoint

```
GET /pdf?url=<URL>&theme=light
```

Returns a PDF document rendered by the browser engine (all images embedded).

| Parameter       | Required | Description                     | Default         |
| --------------- | -------- | ------------------------------- | --------------- |
| `url`           | Yes      | URL to convert                  | -               |
| `engine`        | No       | Browser engine                  | puppeteer       |
| `width`         | No       | Viewport width in pixels        | 1280            |
| `height`        | No       | Viewport height in pixels       | 800             |
| `theme`         | No       | Color scheme: `light`, `dark`   | browser default |
| `dismissPopups` | No       | Auto-close popups before export | true            |

### DOCX Endpoint

```
GET /docx?url=<URL>
```

Returns a DOCX document with embedded images.

| Parameter | Required | Description    | Default |
| --------- | -------- | -------------- | ------- |
| `url`     | Yes      | URL to convert | -       |

### Fetch/Stream Endpoints

```
GET /fetch?url=<URL>
GET /stream?url=<URL>
```

Proxy fetch and streaming proxy endpoints.

## CLI Reference

### Server Mode

```bash
web-capture --serve [--port <port>]
```

| Option    | Short | Description              | Default            |
| --------- | ----- | ------------------------ | ------------------ |
| `--serve` | `-s`  | Start as HTTP API server | -                  |
| `--port`  | `-p`  | Port to listen on        | 3000 (or PORT env) |

### Capture Mode

```bash
web-capture <url> [options]
```

| Option                      | Short | Description                                    | Default                             |
| --------------------------- | ----- | ---------------------------------------------- | ----------------------------------- |
| `--format`                  | `-f`  | Output format (see below)                      | `markdown`                          |
| `--output`                  | `-o`  | Output file path. Use `-o -` for stdout        | auto-derived from URL               |
| `--data-dir`                |       | Base directory for auto-derived output paths   | `./data/web-capture`                |
| `--engine`                  | `-e`  | Browser engine: `puppeteer`, `playwright`      | `puppeteer` (or BROWSER_ENGINE env) |
| `--theme`                   | `-t`  | Color scheme: `light`, `dark`, `no-preference` | browser default                     |
| `--width`                   |       | Viewport width in pixels                       | 1280                                |
| `--height`                  |       | Viewport height in pixels                      | 800                                 |
| `--quality`                 |       | JPEG quality 0-100                             | 80                                  |
| `--fullPage`                |       | Capture full scrollable page                   | false                               |
| `--embed-images`            |       | Keep images as inline base64 data URIs         | false                               |
| `--no-extract-images`       |       | Alias for `--embed-images`                     | false                               |
| `--keep-original-links`     |       | Keep original remote URLs, strip base64        | false                               |
| `--images-dir`              |       | Subdirectory name for extracted images         | `images`                            |
| `--archive`                 |       | Create archive: `zip`, `7z`, `tar.gz`, `tar`   | -                                   |
| `--document-format`         |       | Document format in archive: `markdown`, `html` | `markdown`                          |
| `--localImages`             |       | Download images locally in archive mode        | true                                |
| `--extract-latex`           |       | Extract LaTeX formulas                         | true                                |
| `--no-extract-latex`        |       | Disable LaTeX extraction                       | -                                   |
| `--extract-metadata`        |       | Extract article metadata                       | true                                |
| `--no-extract-metadata`     |       | Disable metadata extraction                    | -                                   |
| `--post-process`            |       | Apply post-processing                          | true                                |
| `--no-post-process`         |       | Disable post-processing                        | -                                   |
| `--detect-code-language`    |       | Detect code block languages                    | true                                |
| `--no-detect-code-language` |       | Disable code language detection                | -                                   |

**Supported formats:**

| Format            | Description                              |
| ----------------- | ---------------------------------------- |
| `markdown` / `md` | Markdown conversion (default)            |
| `html`            | Rendered HTML                            |
| `image` / `png`   | PNG screenshot (lossless)                |
| `jpeg`            | JPEG screenshot (configurable quality)   |
| `pdf`             | PDF with embedded images                 |
| `docx`            | Word document with embedded images       |
| `archive` / `zip` | ZIP archive with markdown + local images |

## Configuration

Configuration values are resolved with the following priority (highest to lowest):

1. **CLI arguments**: `--port 8080`
2. **Environment variables**: `PORT=8080`
3. **Default .lenv file**: `.lenv` in the project root
4. **Built-in defaults**

### Environment Variables

| Variable                           | Description                         | Default              |
| ---------------------------------- | ----------------------------------- | -------------------- |
| `PORT`                             | Server port                         | `3000`               |
| `BROWSER_ENGINE`                   | Browser engine                      | `puppeteer`          |
| `API_TOKEN`                        | API token for authenticated capture | -                    |
| `WEB_CAPTURE_DATA_DIR`             | Base directory for output           | `./data/web-capture` |
| `WEB_CAPTURE_EMBED_IMAGES`         | `0`/`1` — keep images inline        | `0`                  |
| `WEB_CAPTURE_KEEP_ORIGINAL_LINKS`  | `0`/`1` — keep original remote URLs | `0`                  |
| `WEB_CAPTURE_IMAGES_DIR`           | Subdirectory for extracted images   | `images`             |
| `WEB_CAPTURE_EXTRACT_LATEX`        | `0`/`1` — extract LaTeX             | `1`                  |
| `WEB_CAPTURE_EXTRACT_METADATA`     | `0`/`1` — extract metadata          | `1`                  |
| `WEB_CAPTURE_POST_PROCESS`         | `0`/`1` — post-processing           | `1`                  |
| `WEB_CAPTURE_DETECT_CODE_LANGUAGE` | `0`/`1` — detect code langs         | `1`                  |

## Browser Engine Support

The service supports both **Puppeteer** and **Playwright** browser engines:

- **Puppeteer**: Default engine, mature and well-tested
- **Playwright**: Alternative engine with similar capabilities

**Supported engine values:**

- `puppeteer` or `pptr` - Use Puppeteer
- `playwright` or `pw` - Use Playwright

## Popup/Modal Dismissal

By default, the image, PDF, and archive endpoints automatically dismiss common popups before capture:

- Google Funding Choices consent dialogs
- Cookie consent banners
- Generic modals and overlays
- Fixed-position overlays covering content

Set `dismissPopups=false` to disable this behavior.

## Docker

```bash
# Build and run using Docker Compose
docker compose up -d

# Or manually
docker build -t web-capture-js .
docker run -p 3000:3000 web-capture-js
```

## Development

### Available Commands

- `npm run dev` - Start the development server with hot reloading
- `npm run start` - Start the service using Docker Compose
- `npm test` - Run all unit tests
- `npm run lint` - Check code with ESLint
- `npm run format` - Format code with Prettier

### Testing

```bash
npm test                    # Run unit and integration tests
npm run test:e2e            # Run end-to-end tests
npm run test:all            # Run all tests including build
```

## Built With

- Express.js for the web server
- Puppeteer and Playwright for headless browser automation
- Turndown for HTML to Markdown conversion
- archiver for ZIP creation
- docx for DOCX generation
- Jest for testing

## Library Usage

You can also use web-capture as a Node.js library:

```javascript
import {
  fetchHtml,
  convertHtmlToMarkdown,
} from '@link-assistant/web-capture/src/lib.js';
import { createBrowser } from '@link-assistant/web-capture/src/browser.js';
import { dismissPopups } from '@link-assistant/web-capture/src/popups.js';

// Fetch and convert to markdown
const html = await fetchHtml('https://habr.com/en/articles/895896/');
const markdown = convertHtmlToMarkdown(
  html,
  'https://habr.com/en/articles/895896/'
);

// Take a themed screenshot
const browser = await createBrowser('playwright', { colorScheme: 'dark' });
const page = await browser.newPage();
await page.setViewport({ width: 1920, height: 1080 });
await page.goto('https://habr.com/en/articles/895896/', {
  waitUntil: 'networkidle0',
});
await dismissPopups(page);
const buffer = await page.screenshot({ type: 'png', fullPage: true });
await browser.close();
```

## License

[Unlicense](../LICENSE) — This is free and unencumbered software released into the public domain. You are free to copy, modify, publish, use, compile, sell, or distribute this software for any purpose, commercial or non-commercial, and by any means. See [https://unlicense.org](https://unlicense.org) for details.
