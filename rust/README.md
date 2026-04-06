# web-capture (Rust)

A CLI and microservice to fetch URLs and render them as:

- **HTML**: Rendered page content
- **Markdown**: Converted from HTML
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

### API Endpoints (Server Mode)

- **HTML**: GET /html?url=<URL>
- **Markdown**: GET /markdown?url=<URL>
- **PNG screenshot**: GET /image?url=<URL>

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

| Option     | Short | Description                                           | Default                                  |
| ---------- | ----- | ----------------------------------------------------- | ---------------------------------------- |
| `--format` | `-f`  | Output format: `html`, `markdown`/`md`, `image`/`png` | `html`                                   |
| `--output` | `-o`  | Output file path                                      | stdout (text) or auto-generated (images) |

### Examples

```bash
# Capture HTML to stdout
web-capture https://example.com

# Capture Markdown to file
web-capture https://example.com -f markdown -o page.md

# Take screenshot
web-capture https://example.com -f png -o screenshot.png

# Pipe HTML to another command
web-capture https://example.com | grep "title"
```

## Docker

```bash
# Build and run
docker build -t web-capture-rust .
docker run -p 3000:3000 web-capture-rust
```

## Library Usage

Add to your `Cargo.toml`:

```toml
[dependencies]
web-capture = "0.1"
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

## API Endpoints

### HTML Endpoint

```bash
GET /html?url=<URL>
```

Returns the raw HTML content of the specified URL.

**Parameters:**

- `url` (required): The URL to fetch

### Markdown Endpoint

```bash
GET /markdown?url=<URL>
```

Converts the HTML content of the specified URL to Markdown format.

### Image Endpoint

```bash
GET /image?url=<URL>
```

Returns a PNG screenshot of the specified URL.

**Parameters:**

- `url` (required): The URL to capture

## Configuration

### Environment Variables

```bash
# Set port via environment variable
export PORT=8080
web-capture --serve

# Enable debug logging
export RUST_LOG=web_capture=debug
web-capture --serve
```

## Built With

- [Axum](https://github.com/tokio-rs/axum) - Web framework
- [browser-commander](https://github.com/link-foundation/browser-commander) - Browser automation
- [html2md](https://github.com/nickyc975/html2md-rs) - HTML to Markdown conversion
- [scraper](https://github.com/causal-agent/scraper) - HTML parsing
- [Tokio](https://tokio.rs/) - Async runtime

## License

[Unlicense](../LICENSE) — This is free and unencumbered software released into the public domain. You are free to copy, modify, publish, use, compile, sell, or distribute this software for any purpose, commercial or non-commercial, and by any means. See [https://unlicense.org](https://unlicense.org) for details.
