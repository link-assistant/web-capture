# Integration Analysis: kreuzberg-dev/html-to-markdown

## Overview

This document analyzes the best experiences from [kreuzberg-dev/html-to-markdown](https://github.com/kreuzberg-dev/html-to-markdown) (v3.1.0) and how they have been integrated into the web-capture project.

## Key Features of html-to-markdown

| Feature | Description | Integration Value |
|---------|-------------|-------------------|
| **High Performance** | 150-280 MB/s throughput, Rust-powered core | High - replaces slower JS/Rust converters |
| **Structured Results** | `ConversionResult` with content, metadata, tables, images, warnings | High - enriches our API responses |
| **Metadata Extraction** | Title, links, headings, images, JSON-LD, Microdata, RDFa, Open Graph | High - replaces custom metadata logic |
| **Table Extraction** | Structured cell data with headers, alignment, rendered markdown | Medium - enhances table handling |
| **Visitor Pattern** | Custom callbacks for content filtering, URL rewriting | Medium - enables extensibility |
| **HTML Sanitization** | Built-in sanitization via ammonia | Medium - replaces manual cleaning |
| **Multiple Output Formats** | Markdown, Djot, Plain Text | Low - we primarily need Markdown |
| **12 Language Bindings** | Consistent output across Rust, Node.js, Python, etc. | High - both our JS and Rust use same core |
| **CommonMark Compliance** | Standards-based markdown output | Medium - improves output quality |

## What We Integrated

### 1. Node.js: `@kreuzberg/html-to-markdown-node` (v3.1.0)

**Package**: `@kreuzberg/html-to-markdown-node`

Added as an optional, high-performance converter that can be selected via configuration or query parameter. The existing Turndown-based converter remains as the default for backward compatibility.

**Benefits**:
- 10-80x faster conversion than Turndown
- Structured results with metadata, tables, images
- Built-in HTML sanitization
- CommonMark compliant output

### 2. Rust: `html-to-markdown-rs` (v3.1.0)

**Crate**: `html-to-markdown-rs`

Replaces the basic `html2md` crate with the much more capable `html-to-markdown-rs`, providing feature parity with the Node.js implementation.

**Benefits**:
- Same Rust core as the Node.js binding (consistent output)
- Structured conversion results
- Built-in metadata extraction
- Better table handling

### 3. Structured Conversion Results

Both implementations now return structured results including:
- `content`: The converted markdown
- `metadata`: Extracted page metadata (title, description, links, headings, images)
- `tables`: Structured table data extracted during conversion
- `warnings`: Any non-fatal processing warnings

### 4. Enhanced Metadata Extraction

The html-to-markdown library extracts richer metadata than our custom implementation:
- Open Graph tags (og:title, og:description, og:image)
- Twitter Card metadata
- JSON-LD structured data
- Microdata (itemscope, itemtype, itemprop)
- RDFa markup
- Link classification (internal, external, anchor, email, phone)

## What We Kept

- **Custom LaTeX extraction**: html-to-markdown doesn't handle LaTeX formula extraction from Habr, KaTeX, or MathJax - our custom implementation remains
- **Custom post-processing**: Unicode normalization, LaTeX spacing, bold formatting fixes remain for the Turndown path
- **URL absolutification**: Our runtime JS hook for dynamic URLs is unique to web-capture
- **Browser automation**: The fetching and rendering layer is independent of conversion

## API Changes

### Query Parameter: `converter`

Both `/markdown` and enhanced endpoints now accept a `converter` query parameter:

- `converter=turndown` (default) - Use existing Turndown-based conversion
- `converter=kreuzberg` - Use html-to-markdown for high-performance conversion with structured results

### Response Format

When using the `kreuzberg` converter, the `/markdown` endpoint can optionally return JSON with structured results:

```
GET /markdown?url=https://example.com&converter=kreuzberg&format=json
```

```json
{
  "content": "# Example\n\nThis is the page content...",
  "metadata": {
    "title": "Example Domain",
    "links": [...],
    "headings": [...],
    "images": [...]
  },
  "tables": [...],
  "warnings": []
}
```

## Performance Comparison

| Metric | Turndown (JS) | html2md (Rust) | html-to-markdown |
|--------|---------------|----------------|------------------|
| Throughput | ~5-10 MB/s | ~20-40 MB/s | 150-280 MB/s |
| Structured results | No | No | Yes |
| Metadata extraction | Custom | None | Built-in |
| Table extraction | GFM plugin | Basic | Structured |
| Sanitization | Manual (Cheerio) | Manual (scraper) | Built-in (ammonia) |
| CommonMark | Partial | Partial | Full |

## References

- [html-to-markdown GitHub](https://github.com/kreuzberg-dev/html-to-markdown)
- [html-to-markdown Documentation](https://docs.html-to-markdown.kreuzberg.dev)
- [npm: @kreuzberg/html-to-markdown-node](https://www.npmjs.com/package/@kreuzberg/html-to-markdown-node)
- [crates.io: html-to-markdown-rs](https://crates.io/crates/html-to-markdown-rs)
