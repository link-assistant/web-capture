# web-capture

A CLI and microservice to fetch URLs and render them as:

- **HTML**: Rendered page content
- **Markdown**: Converted from HTML
- **PNG screenshot**: Full page capture

## Language Implementations

This repository contains two implementations with compatible APIs:

| Implementation | Directory | Package | Status |
|---------------|-----------|---------|--------|
| **JavaScript/Node.js** | [`./js`](./js) | [@link-assistant/web-capture](https://www.npmjs.com/package/@link-assistant/web-capture) | Production |
| **Rust** | [`./rust`](./rust) | [web-capture](https://crates.io/crates/web-capture) | Production |

Both implementations provide the same CLI interface and HTTP API endpoints, allowing you to choose based on your deployment preferences.

## Quick Start

### JavaScript

```bash
cd js
npm install
npm run dev
```

### Rust

```bash
cd rust
cargo run -- --serve
```

## API Endpoints

Both implementations expose the same API:

| Endpoint | Description |
|----------|-------------|
| `GET /html?url=<URL>` | Get rendered HTML content |
| `GET /markdown?url=<URL>` | Get Markdown conversion (default: Turndown) |
| `GET /markdown?url=<URL>&converter=kreuzberg` | High-performance Markdown conversion via [html-to-markdown](https://github.com/kreuzberg-dev/html-to-markdown) |
| `GET /markdown?url=<URL>&converter=kreuzberg&format=json` | Structured result with metadata, tables, and warnings |
| `GET /image?url=<URL>` | Get PNG screenshot |
| `GET /fetch?url=<URL>` | Proxy fetch content |
| `GET /stream?url=<URL>` | Stream content |

## CLI Usage

```bash
# Capture a URL as HTML (output to stdout)
web-capture https://example.com

# Capture as Markdown and save to file
web-capture https://example.com --format markdown --output page.md

# Take a screenshot
web-capture https://example.com --format png --output screenshot.png

# Start as API server
web-capture --serve

# Start server on custom port
web-capture --serve --port 8080
```

## CLI Options

| Option | Short | Description | Default |
|--------|-------|-------------|---------|
| `--serve` | `-s` | Start as HTTP API server | - |
| `--port` | `-p` | Port to listen on | 3000 |
| `--format` | `-f` | Output format: `html`, `markdown`/`md`, `image`/`png` | `html` |
| `--output` | `-o` | Output file path | stdout (text) or auto-generated (images) |
| `--engine` | `-e` | Browser engine (JS only): `puppeteer`, `playwright` | `puppeteer` |

## Docker

### JavaScript

```bash
cd js
docker build -t web-capture-js .
docker run -p 3000:3000 web-capture-js
```

### Rust

```bash
cd rust
docker build -t web-capture-rust .
docker run -p 3000:3000 web-capture-rust
```

## Project Structure

```
web-capture/
├── js/                          # JavaScript/Node.js implementation
│   ├── src/                     # Source code
│   ├── bin/                     # CLI entry point
│   ├── tests/                   # Test files
│   ├── examples/                # Usage examples
│   ├── package.json             # npm package manifest
│   ├── Dockerfile               # Docker build file
│   └── README.md                # JavaScript-specific docs
│
├── rust/                        # Rust implementation
│   ├── src/                     # Source code
│   │   ├── lib.rs               # Library exports
│   │   ├── main.rs              # CLI/server entry point
│   │   ├── browser.rs           # Browser automation
│   │   ├── html.rs              # HTML processing
│   │   └── markdown.rs          # Markdown conversion
│   ├── tests/                   # Test files
│   ├── examples/                # Usage examples
│   ├── Cargo.toml               # Cargo package manifest
│   ├── Dockerfile               # Docker build file
│   └── README.md                # Rust-specific docs
│
├── scripts/                     # Shared build/release scripts
│   ├── *.mjs                    # JavaScript-specific scripts
│   └── rust-*.mjs               # Rust-specific scripts
│
├── .github/workflows/
│   ├── js.yml                   # JavaScript CI/CD
│   └── rust.yml                 # Rust CI/CD
│
└── README.md                    # This file
```

## Development

### JavaScript

```bash
cd js
npm install
npm run dev          # Start dev server
npm test             # Run tests
npm run lint         # Run linter
```

### Rust

```bash
cd rust
cargo build          # Build
cargo test           # Run tests
cargo clippy         # Run linter
cargo fmt            # Format code
```

## Features

- **HTML Rendering**: Fetch and render HTML with JavaScript support via headless browsers
- **Markdown Conversion**: Clean HTML-to-Markdown conversion with proper formatting, with optional high-performance [kreuzberg html-to-markdown](https://github.com/kreuzberg-dev/html-to-markdown) backend (150-280 MB/s, structured results)
- **Screenshots**: Capture PNG screenshots of web pages
- **URL Normalization**: Convert relative URLs to absolute
- **Encoding Detection**: Automatic charset detection and UTF-8 conversion
- **Proxy Support**: Fetch and stream content through the service

## Browser Engines

### JavaScript Version

The JavaScript implementation supports two browser engines:

- **Puppeteer** (default): Mature, well-tested Chrome automation
- **Playwright**: Cross-browser automation with similar capabilities

### Rust Version

The Rust implementation uses:

- **browser-commander**: A Rust crate for browser automation using chromiumoxide

## License

[Unlicense](LICENSE) — This is free and unencumbered software released into the public domain. You are free to copy, modify, publish, use, compile, sell, or distribute this software for any purpose, commercial or non-commercial, and by any means. See [https://unlicense.org](https://unlicense.org) for details.

## Markdown Converters

web-capture supports two HTML-to-Markdown converters:

| Converter | Selection | Throughput | Structured Results | Used In |
|-----------|-----------|------------|-------------------|---------|
| **Turndown** (default) | `converter=turndown` | ~5-10 MB/s | No | JS implementation |
| **html2md** (default) | N/A (Rust only) | ~20-40 MB/s | No | Rust implementation |
| **kreuzberg** | `converter=kreuzberg` | 150-280 MB/s | Yes (metadata, tables) | Both JS and Rust |

The kreuzberg converter is powered by [html-to-markdown](https://github.com/kreuzberg-dev/html-to-markdown) and uses the same Rust core across both implementations, ensuring consistent output. See [integration analysis](docs/html-to-markdown-integration.md) for details.

## Related Projects

- [browser-commander](https://github.com/link-foundation/browser-commander) - Browser automation library used in Rust implementation
- [turndown](https://github.com/mixmark-io/turndown) - HTML to Markdown converter used in JS implementation
- [html2md](https://github.com/nickyc975/html2md-rs) - HTML to Markdown converter used in Rust implementation
- [html-to-markdown](https://github.com/kreuzberg-dev/html-to-markdown) - High-performance HTML to Markdown converter (kreuzberg), integrated as optional converter
