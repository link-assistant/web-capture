# web-capture (JavaScript/Node.js)

A CLI and microservice to fetch URLs and render them as:

- **HTML**: Rendered page content
- **Markdown**: Converted from HTML
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
# or
yarn install
```

## Quick Start

### CLI Usage

```bash
# Capture a URL as HTML (output to stdout)
web-capture https://example.com

# Capture as Markdown and save to file
web-capture https://example.com --format markdown --output page.md

# Take a PNG screenshot
web-capture https://example.com --format png --output screenshot.png

# Take a JPEG screenshot with custom quality
web-capture https://example.com --format jpeg --quality 60 --output screenshot.jpg

# Dark theme full-page screenshot
web-capture https://example.com --format png --theme dark --fullPage --output dark.png

# Custom viewport size
web-capture https://example.com --format png --width 1920 --height 1080 -o wide.png

# Download as PDF
web-capture https://example.com --format pdf --output page.pdf

# Download as DOCX
web-capture https://example.com --format docx --output page.docx

# Download as ZIP archive with local images
web-capture https://example.com --format archive --output site.zip

# Start as API server
web-capture --serve

# Start server on custom port
web-capture --serve --port 8080
```

### Downloading Habr Articles

The service is tested against real Habr.com articles. Here are examples for each format:

```bash
# Markdown (default: remote image links)
web-capture https://habr.com/en/articles/895896/ -f markdown -o article.md

# ZIP archive with local images (markdown format, default)
web-capture https://habr.com/en/articles/895896/ -f archive -o article.zip

# ZIP archive with local images (HTML format with CSS)
web-capture https://habr.com/en/articles/895896/ -f archive --documentFormat html -o article-html.zip

# Light theme full-page PNG
web-capture https://habr.com/en/articles/895896/ -f png --theme light --fullPage -o light.png

# Dark theme full-page PNG
web-capture https://habr.com/en/articles/895896/ -f png --theme dark --fullPage -o dark.png

# JPEG with 90% quality
web-capture https://habr.com/en/articles/895896/ -f jpeg --quality 90 -o article.jpg

# PDF with dark theme
web-capture https://habr.com/en/articles/895896/ -f pdf --theme dark -o article.pdf

# DOCX with embedded images
web-capture https://habr.com/en/articles/895896/ -f docx -o article.docx
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

Converts the HTML content of the specified URL to Markdown format.

| Parameter | Required | Description  | Default |
| --------- | -------- | ------------ | ------- |
| `url`     | Yes      | URL to fetch | -       |

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

Returns a ZIP archive containing either `article.md` or `article.html` and asset directories (`images/`, `css/`).

| Parameter        | Required | Description                              | Default    |
| ---------------- | -------- | ---------------------------------------- | ---------- |
| `url`            | Yes      | URL to archive                           | -          |
| `localImages`    | No       | Download images locally into the archive | true       |
| `documentFormat` | No       | Document format: `markdown` or `html`    | `markdown` |

**Archive structure** (with `localImages=true`):

```
archive.zip
├── article.md        # or article.html when documentFormat=html
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

| Option             | Short | Description                                    | Default                                  |
| ------------------ | ----- | ---------------------------------------------- | ---------------------------------------- |
| `--format`         | `-f`  | Output format (see below)                      | `html`                                   |
| `--output`         | `-o`  | Output file path                               | stdout (text) or auto-generated (images) |
| `--engine`         | `-e`  | Browser engine: `puppeteer`, `playwright`      | `puppeteer` (or BROWSER_ENGINE env)      |
| `--theme`          | `-t`  | Color scheme: `light`, `dark`, `no-preference` | browser default                          |
| `--width`          |       | Viewport width in pixels                       | 1280                                     |
| `--height`         |       | Viewport height in pixels                      | 800                                      |
| `--quality`        |       | JPEG quality 0-100                             | 80                                       |
| `--fullPage`       |       | Capture full scrollable page                   | false                                    |
| `--localImages`    |       | Download images locally in archive mode        | true                                     |
| `--documentFormat` |       | Document format in archive: `markdown`, `html` | `markdown`                               |

**Supported formats:**

| Format            | Description                              |
| ----------------- | ---------------------------------------- |
| `html`            | Rendered HTML (default)                  |
| `markdown` / `md` | Markdown conversion                      |
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

```bash
# Set port via environment variable
export PORT=8080
web-capture --serve

# Set browser engine
export BROWSER_ENGINE=playwright
web-capture https://example.com --format png
```

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
