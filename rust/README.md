# web-capture (Rust)

[![crates.io version](https://img.shields.io/crates/v/web-capture?label=crates.io&color=orange)](https://crates.io/crates/web-capture)
[![crates.io downloads](https://img.shields.io/crates/d/web-capture?label=downloads&color=orange)](https://crates.io/crates/web-capture)
[![docs.rs](https://img.shields.io/docsrs/web-capture?label=docs.rs)](https://docs.rs/web-capture)
[![GitHub Release](https://img.shields.io/github/v/release/link-assistant/web-capture?label=GitHub%20Release)](https://github.com/link-assistant/web-capture/releases)
[![CI - Rust](https://img.shields.io/github/actions/workflow/status/link-assistant/web-capture/rust.yml?branch=main&label=CI)](https://github.com/link-assistant/web-capture/actions/workflows/rust.yml)
[![License: Unlicense](https://img.shields.io/badge/license-Unlicense-green)](https://unlicense.org)

A CLI and microservice to fetch URLs and render them as:

- **Markdown**: Converted from HTML with image extraction (default)
- **HTML**: Rendered page content
- **Plain text**: Raw text downloads for paste-like URLs such as xpaste.pro
- **PNG screenshot**: Full page capture

This is the Rust implementation of web-capture, providing the same API as the JavaScript version.

## Installation

### From crates.io

```bash
cargo install web-capture
```

### From Source

```bash
cd rust
cargo build --release
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
web-capture https://example.com --format html

# Capture raw paste text
web-capture https://xpaste.pro/p/t4q0Lsp0 --format txt -o paste.txt

# Capture a GitHub repository as compact text or Markdown
web-capture https://github.com/link-assistant/web-capture --format txt -o repository.txt
web-capture https://github.com/link-assistant/web-capture --format markdown -o repository.md

# Take a screenshot
web-capture https://example.com --format png -o screenshot.png

# Create a ZIP archive
web-capture https://example.com --archive

# Keep images inline (opt-in)
web-capture https://example.com --embed-images -o page.md

# Structured search-provider capture (JSON by default)
web-capture search "formal methods" --provider wikipedia

# Start as API server
web-capture --serve

# Start server on custom port
web-capture --serve --port 8080
```

### API Endpoints (Server Mode)

- **Markdown**: `GET /markdown?url=<URL>` (original links kept, base64 stripped by default)
- **Markdown (kreuzberg)**: `GET /markdown?url=<URL>&converter=kreuzberg`
- **Markdown (structured JSON)**: `GET /markdown?url=<URL>&converter=kreuzberg&format=json`
- **Markdown (base64 inline)**: `GET /markdown?url=<URL>&embedImages=true`
- **Markdown (all images stripped)**: `GET /markdown?url=<URL>&keepOriginalLinks=false`
- **HTML**: `GET /html?url=<URL>`
- **Text**: `GET /txt?url=<URL>` (xpaste.pro paste URLs normalize to `/raw`)
- **PNG screenshot**: `GET /image?url=<URL>`
- **Search**: `GET /search?q=<QUERY>&provider=<PROVIDER>&format=json|markdown`

For xpaste.pro paste URLs, `/markdown` captures the visual paste page in visible
order and appends the raw paste text as `xpaste-pro-<id>.txt` when the final
Markdown stays under 1500 lines. Larger paste pages return a ZIP containing
`index.md`, `xpaste-pro-<id>.md`, and `xpaste-pro-<id>.txt`. Canonical,
localized, and `/raw` paste URLs are normalized before capture.

For plain GitHub repository URLs such as `https://github.com/owner/repo`,
`/markdown` and `/txt` return compact repository snapshots with repository
metadata, the root file tree, and README content. GitHub subpages continue
through the regular capture path.

### Search Endpoint

```
GET /search?q=<QUERY>&provider=<PROVIDER>&format=json|markdown
```

Captures structured results from a search provider in a normalized,
machine-readable shape. `wikipedia` (default) uses the CORS-friendly REST API;
the HTML engines (`duckduckgo`, `google`, `bing`, `brave`) are parsed
server-side. Blocked or CAPTCHA-gated pages are reported through `diagnostics`.

| Parameter  | Required | Description                                          | Default     |
| ---------- | -------- | ---------------------------------------------------- | ----------- |
| `q`        | Yes      | Search query (`query` accepted as an alias)          | -           |
| `provider` | No       | `wikipedia`, `duckduckgo`, `google`, `bing`, `brave` | `wikipedia` |
| `limit`    | No       | Maximum number of results                            | `10`        |
| `format`   | No       | Response format: `json` or `markdown`                | `json`      |

The JSON shape matches the JavaScript implementation:

```json
{
  "query": "formal methods",
  "provider": "wikipedia",
  "captureMode": "fetch",
  "capturedAt": "2026-05-18T20:30:00Z",
  "results": [
    {
      "rank": 1,
      "title": "Formal methods",
      "url": "https://en.wikipedia.org/wiki/Formal_methods",
      "snippet": "mathematically rigorous techniques for the specification..."
    }
  ],
  "diagnostics": {
    "status": 200,
    "blockedByCors": false,
    "blockedByCaptcha": false,
    "sourceUrl": "https://en.wikipedia.org/w/rest.php/v1/search/page?q=formal+methods&limit=10"
  }
}
```

## CLI Reference

### Server Mode

Start the API server:

```bash
web-capture --serve [--port <port>]
```

| Option    | Short | Description              | Default            |
| --------- | ----- | ------------------------ | ------------------ |
| `--serve` | `-s`  | Start as HTTP API server | -                  |
| `--port`  | `-p`  | Port to listen on        | 3000 (or PORT env) |

### Capture Mode

Capture a URL directly:

```bash
web-capture <url> [options]
```

| Option                      | Short | Description                                                         | Default               |
| --------------------------- | ----- | ------------------------------------------------------------------- | --------------------- |
| `--format`                  | `-f`  | Output format: `markdown`/`md`, `html`, `txt`/`text`, `image`/`png` | `markdown`            |
| `--output`                  | `-o`  | Output file path. Use `-o -` for stdout                             | auto-derived from URL |
| `--capture`                 |       | Capture method: `browser` or `api`                                  | `browser`             |
| `--data-dir`                |       | Base directory for auto-derived output paths                        | `./data/web-capture`  |
| `--embed-images`            |       | Keep images as inline base64 data URIs                              | false                 |
| `--no-extract-images`       |       | Alias for `--embed-images`                                          | false                 |
| `--keep-original-links`     |       | Keep original remote URLs, strip base64                             | false                 |
| `--images-dir`              |       | Subdirectory name for extracted images                              | `images`              |
| `--archive`                 |       | Create archive: `zip`, `7z`, `tar.gz`, `tar`                        | -                     |
| `--extract-latex`           |       | Extract LaTeX formulas                                              | true                  |
| `--no-extract-latex`        |       | Disable LaTeX extraction                                            | -                     |
| `--extract-metadata`        |       | Extract article metadata                                            | true                  |
| `--no-extract-metadata`     |       | Disable metadata extraction                                         | -                     |
| `--post-process`            |       | Apply post-processing                                               | true                  |
| `--no-post-process`         |       | Disable post-processing                                             | -                     |
| `--detect-code-language`    |       | Detect code block languages                                         | true                  |
| `--no-detect-code-language` |       | Disable code language detection                                     | -                     |

### Search Mode

Capture structured search-provider results. Output defaults to JSON; pass
`--format markdown` for a human-readable document.

```bash
web-capture search "<query>" [options]
```

| Option       | Short | Description                                          | Default     |
| ------------ | ----- | ---------------------------------------------------- | ----------- |
| `--provider` |       | `wikipedia`, `duckduckgo`, `google`, `bing`, `brave` | `wikipedia` |
| `--limit`    |       | Maximum number of results                            | `10`        |
| `--format`   | `-f`  | Output format: `json` or `markdown`                  | `json`      |

### Examples

```bash
# Capture Markdown (default)
web-capture https://example.com

# Capture to specific file
web-capture https://example.com -o page.md

# Write to stdout
web-capture https://example.com -o -

# HTML format
web-capture https://example.com -f html -o page.html

# Raw paste text
web-capture https://xpaste.pro/p/t4q0Lsp0 -f txt -o paste.txt

# GitHub repository snapshot
web-capture https://github.com/link-assistant/web-capture -f markdown -o repository.md
web-capture https://github.com/link-assistant/web-capture -f txt -o repository.txt

# Google Docs live editor model
web-capture https://docs.google.com/document/d/DOC_ID/edit --capture browser

# Google Docs public export endpoint
web-capture https://docs.google.com/document/d/DOC_ID/edit --capture api

# Google Docs REST API with OAuth token
web-capture https://docs.google.com/document/d/DOC_ID/edit --capture api --api-token YOUR_TOKEN

# Tune browser-model quiescence for large or slow documents
WEB_CAPTURE_GDOCS_STABILITY_MS=2500 WEB_CAPTURE_GDOCS_MAX_WAIT_MS=60000 \
  web-capture https://docs.google.com/document/d/DOC_ID/edit --capture browser

# Screenshot
web-capture https://example.com -f png -o screenshot.png

# Pipe to another command
web-capture https://example.com -o - | grep "title"

# Structured search (JSON by default)
web-capture search "formal methods"

# Search DuckDuckGo, limit to 5 results, render as Markdown
web-capture search "formal methods" --provider duckduckgo --limit 5 --format markdown
```

## Docker

```bash
# Build and run
docker build -t web-capture-rust .
docker run -p 3000:3000 web-capture-rust
```

## Configuration

### Environment Variables

| Variable                           | Description                          | Default              |
| ---------------------------------- | ------------------------------------ | -------------------- |
| `PORT`                             | Server port                          | `3000`               |
| `API_TOKEN`                        | API token for authenticated capture  | -                    |
| `WEB_CAPTURE_DATA_DIR`             | Base directory for output            | `./data/web-capture` |
| `WEB_CAPTURE_EMBED_IMAGES`         | `0`/`1` — keep images inline         | `0`                  |
| `WEB_CAPTURE_KEEP_ORIGINAL_LINKS`  | `0`/`1` — keep original remote URLs  | `0`                  |
| `WEB_CAPTURE_IMAGES_DIR`           | Subdirectory for extracted images    | `images`             |
| `WEB_CAPTURE_EXTRACT_LATEX`        | `0`/`1` — extract LaTeX              | `1`                  |
| `WEB_CAPTURE_EXTRACT_METADATA`     | `0`/`1` — extract metadata           | `1`                  |
| `WEB_CAPTURE_POST_PROCESS`         | `0`/`1` — post-processing            | `1`                  |
| `WEB_CAPTURE_DETECT_CODE_LANGUAGE` | `0`/`1` — detect code langs          | `1`                  |
| `RUST_LOG`                         | Log level (e.g. `web_capture=debug`) | `web_capture=info`   |

## Library Usage

Add to your `Cargo.toml`:

```toml
[dependencies]
web-capture = "0.2"
```

### Example

```rust
use web_capture::{fetch_html, convert_html_to_markdown, capture_screenshot};

#[tokio::main]
async fn main() -> anyhow::Result<()> {
    // Fetch HTML from a URL
    let html = fetch_html("https://example.com").await?;
    println!("HTML length: {}", html.len());

    // Convert HTML to Markdown
    let markdown = convert_html_to_markdown(&html, Some("https://example.com"))?;
    println!("Markdown: {}", markdown);

    // Capture a screenshot
    let screenshot = capture_screenshot("https://example.com").await?;
    println!("Screenshot size: {} bytes", screenshot.len());

    Ok(())
}
```

## Testing

```bash
cargo test --all-features   # Unit and integration tests (offline)
```

Some integration suites hit live servers and are skipped by default. Enable them
with environment variables:

```bash
# Download the Wikipedia page (markdown + image) via the browser engine
WIKIPEDIA_INTEGRATION=1 cargo test --test integration wikipedia_download::live -- --nocapture

# Download a GitHub repository page as compact txt/markdown, original HTML, and screenshot
GITHUB_REPOSITORY_INTEGRATION=1 cargo test --test integration github_repository::live -- --nocapture

# Public Google Docs live suite
GDOCS_INTEGRATION=1 cargo test --test integration gdocs_public_doc::live -- --nocapture
```

## Built With

- [Axum](https://github.com/tokio-rs/axum) - Web framework
- [browser-commander](https://github.com/link-foundation/browser-commander) - Browser automation
- [html2md](https://github.com/nickyc975/html2md-rs) - HTML to Markdown conversion
- [scraper](https://github.com/causal-agent/scraper) - HTML parsing
- [Tokio](https://tokio.rs/) - Async runtime

## License

[Unlicense](../LICENSE) — This is free and unencumbered software released into the public domain. You are free to copy, modify, publish, use, compile, sell, or distribute this software for any purpose, commercial or non-commercial, and by any means. See [https://unlicense.org](https://unlicense.org) for details.
