# Case Study: Add Google Docs (Document to Markdown) Support

**Issue:** [#36 – Add Google Docs (document to markdown) support](https://github.com/link-assistant/web-capture/issues/36)

## Summary

This case study analyzes the requirements for adding Google Docs document capture
support to the `@link-assistant/web-capture` package. The goal is to enable
capturing Google Docs documents and converting them to Markdown, HTML, and other
supported formats — using both browser-based and API-based capture methods.

---

## Context

Google Docs is a widely-used document editing platform. Users frequently need to
convert Google Docs documents to Markdown for use in Git repositories, static
site generators, and documentation platforms. Currently, `web-capture` (v1.2.0)
can capture arbitrary web pages but has no specific support for Google Docs URL
patterns or export formats.

### Test Document

The issue references a test document for validation:
- [Google Docs Test Document](https://docs.google.com/document/d/1yn5AWdus0Rh5xRr6voNy-g2wNzdC4bM0CV7SQWch9H4/edit?tab=t.0)

---

## Requirements Analysis

### R1: Configurable Capture Methods

The issue specifies three capture approaches:

| Method | Description | Authentication | Use Case |
|--------|-------------|----------------|----------|
| **Playwright** | Browser-based capture via Playwright engine | None for public docs | Full rendering fidelity |
| **Puppeteer** | Browser-based capture via Puppeteer engine | None for public docs | Full rendering fidelity |
| **API** | Google Docs export URL (`/export?format=`) | Optional API token | Lightweight, no browser needed |

#### Google Docs Export URL Pattern

Google Docs supports direct export via URL manipulation:

```
https://docs.google.com/document/d/{DOCUMENT_ID}/export?format={FORMAT}
```

Supported formats:
- `html` — HTML document (images as base64 data URIs)
- `txt` — Plain text
- `md` — Markdown (native Google Docs Markdown export, added July 2024)
- `pdf` — PDF document
- `docx` — Microsoft Word document
- `epub` — EPUB ebook format
- `zip` — Zipped HTML with images

**Key insight:** For publicly shared documents, the export URL works without
authentication. For private documents, an API token (OAuth Bearer token) must be
provided in the Authorization header.

### R2: API Token Support

The issue requires:
- API token passed via CLI option (`--api-token`) or environment variable
  (`API_TOKEN`)
- Token must NOT be stored — only used transiently for the current request
- For the API server, the token should be passed in request headers
  (`Authorization: Bearer <token>` or custom `X-Api-Token` header)

### R3: Best Practices for Dependencies

The issue requires verification that:
- **lino-arguments**: Current `^0.2.1` → Latest `0.2.5` (needs update)
- **browser-commander**: Current `^0.8.0` → Latest `0.8.0` (up to date)

### R4: JavaScript and Rust Parity

Both JavaScript and Rust implementations must support the same Google Docs
capture functionality with identical behavior.

### R5: Case Study Documentation

Compile research data, requirements, and solution plans into
`./docs/case-studies/issue-36/`.

---

## Solution Architecture

### Google Docs URL Detection

A Google Docs URL follows these patterns:
```
https://docs.google.com/document/d/{DOCUMENT_ID}/edit
https://docs.google.com/document/d/{DOCUMENT_ID}/edit?tab=t.0
https://docs.google.com/document/d/{DOCUMENT_ID}/
```

The document ID can be extracted using a regex:
```
/docs\.google\.com\/document\/d\/([a-zA-Z0-9_-]+)/
```

### Capture Flow

```
Input URL (Google Docs)
        │
        ├─► isGoogleDocsUrl(url) → true
        │
        ├─► extractDocumentId(url) → document ID
        │
        ├─► Choose capture method:
        │   ├─► "api" → fetch export URL directly
        │   │   ├─► Public doc: no auth needed
        │   │   └─► Private doc: add Authorization header
        │   │
        │   └─► "browser" → use browser-commander
        │       └─► Navigate to export URL, get content
        │
        └─► Convert to target format (markdown, html, etc.)
```

### API-Based Capture

For API-based capture, the flow is:
1. Detect Google Docs URL → extract document ID
2. Construct export URL: `https://docs.google.com/document/d/{id}/export?format=html`
3. Fetch the export URL with optional Authorization header
4. Convert the resulting HTML to Markdown using existing `convertHtmlToMarkdown()`

### Browser-Based Capture

For browser-based capture (Playwright/Puppeteer), the existing capture pipeline
handles Google Docs pages. The export URL is used to get clean HTML without the
Google Docs editor UI.

---

## Implementation Plan

### Phase 1: Core Module (JavaScript)
- Create `js/src/gdocs.js` with Google Docs URL detection and export functions
- Add `--api-token` CLI option and `API_TOKEN` env variable support
- Register `/gdocs` endpoint in API server
- Update CLI to auto-detect Google Docs URLs

### Phase 2: Core Module (Rust)
- Create `rust/src/gdocs.rs` with matching Rust implementation
- Add `--api-token` CLI arg and `API_TOKEN` env support
- Register `/gdocs` endpoint in Axum router

### Phase 3: Testing
- Unit tests for URL detection, document ID extraction, export URL construction
- Integration tests with the test document (public, no auth needed)
- Mock tests for authenticated scenarios

### Phase 4: Dependency Updates
- Update `lino-arguments` from `^0.2.1` to `^0.2.5`

---

## Existing Tools and Libraries

### Google Docs Export (No External Library Needed)

The export URL pattern (`/export?format=html`) is a built-in Google Docs feature
that works without any external libraries. This is the simplest and most reliable
approach.

### Alternative Libraries Considered

| Library | Language | Description | Decision |
|---------|----------|-------------|----------|
| `docs-markdown` (npm) | JS | Convert Google Docs API response to Markdown | Not needed — we use HTML export + Turndown |
| `gdocs2md` (npm) | JS | Google Docs to Markdown via Apps Script | Too complex, requires Apps Script setup |
| Google Drive API | JS/Rust | Full Google Drive API with export endpoints | Overkill for document export |

**Decision:** Use the simple export URL pattern with HTTP fetch. No additional
dependencies needed.

---

## Risk Assessment

| Risk | Mitigation |
|------|------------|
| Google may change export URL format | URL pattern has been stable for 10+ years |
| Rate limiting on export URLs | Implement retry with exponential backoff (already exists) |
| Private docs require OAuth | Support API token via CLI/ENV, document clearly |
| Export HTML quality varies | Test with multiple document types, use existing HTML→MD pipeline |

---

## References

- [Google Docs URL Parameters](https://youneedawiki.com/blog/posts/google-doc-url-parameters.html)
- [Google Workspace Markdown Import/Export (July 2024)](https://workspaceupdates.googleblog.com/2024/07/import-and-export-markdown-in-google-docs.html)
- [lino-arguments npm](https://www.npmjs.com/package/lino-arguments)
- [browser-commander npm](https://www.npmjs.com/package/browser-commander)
