# FormalAI Web Capture Contract

This document defines the stable HTTP and CLI surface that FormalAI can depend
on when using `web-capture` as an optional capture/search component.

The contract covers the shared endpoints requested in issue 135:

- `GET /fetch`
- `GET /html`
- `GET /txt`
- `GET /markdown`
- `GET /image`
- `GET /archive`
- `GET /stream`
- `GET /search`

The JavaScript package is published as `@link-assistant/web-capture`. The Rust
crate is published as `web-capture`, but the Rust crate currently declares
`rust-version = "1.88"`. On June 12, 2026 the maintainer clarified that this
project should use the latest stable Rust. FormalAI currently declaring Rust
1.70 should integrate through the CLI or HTTP service unless FormalAI raises
its Rust toolchain or this project explicitly introduces a lower-MSRV library
target later.

## Contract Rules

Capture endpoints return the requested artifact directly. They do not wrap
successful `/html`, `/txt`, `/markdown`, `/image`, `/archive`, `/fetch`, or
`/stream` responses in JSON because consumers need the raw text or bytes.

The structured response exceptions are:

- `/search`, which returns normalized JSON by default.
- `/markdown?converter=kreuzberg&format=json`, which returns the structured
  converter output.

For reproducible FormalAI integration:

- Use HTTP when FormalAI runs `web-capture` as a sidecar or remote service.
- Use CLI with `-o -` for text-like outputs (`html`, `txt`, `markdown`) when a
  process boundary is simpler than HTTP.
- Use CLI `--output <file>` for binary outputs such as screenshots and archives.
- Parse timestamps as RFC 3339 strings. JavaScript currently emits
  millisecond-precision ISO strings for `/search`; Rust emits second-precision
  `Z` timestamps.
- Treat content type and status code as part of the contract.

## HTTP Endpoints

| Endpoint    | Required query | Stable success shape                                                                                                                                                |
| ----------- | -------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `/fetch`    | `url`          | Proxies upstream status, content type, selected headers, and response bytes.                                                                                        |
| `/stream`   | `url`          | Streams or proxies upstream status, content type, selected headers, and response bytes.                                                                             |
| `/html`     | `url`          | `200`, `Content-Type: text/html; charset=utf-8`, rendered or fetched HTML with relative URLs normalized to absolute URLs where supported.                           |
| `/txt`      | `url`          | `200`, `Content-Type: text/plain; charset=utf-8`, `Content-Disposition` attachment, plain text body.                                                                |
| `/markdown` | `url`          | `200`, `Content-Type: text/markdown`, Markdown body.                                                                                                                |
| `/image`    | `url`          | `200`, `Content-Type: image/png` by default or `image/jpeg` when requested, binary image bytes.                                                                     |
| `/archive`  | `url`          | `200`, `Content-Type: application/zip`, ZIP bytes. Default archive contains `document.md` and `document.html`; local assets use relative folders such as `images/`. |
| `/search`   | `q` or `query` | `200`, `Content-Type: application/json` by default, normalized search JSON.                                                                                         |

Common HTTP parameters:

| Parameter        | Endpoints                | Meaning                                                                               |
| ---------------- | ------------------------ | ------------------------------------------------------------------------------------- |
| `url`            | Capture endpoints        | Source URL. Host-only values are normalized by the implementations where supported.   |
| `engine`         | Browser-backed endpoints | Browser engine where supported, usually `puppeteer` or `playwright` in JavaScript.    |
| `embedImages`    | `/markdown`, `/archive`  | Keep base64 images inline when supported.                                             |
| `localImages`    | `/archive`               | Download images into the archive, default `true` unless original links are requested. |
| `documentFormat` | `/archive`               | `markdown` by default or `html`.                                                      |

Error shape for artifact endpoints:

- Missing required query parameters return `400` with a short text error.
- Capture/conversion failures return `500` with a short text error.
- `/fetch` and `/stream` preserve upstream HTTP status when an upstream response
  exists; transport failures return `500`.

FormalAI should normalize artifact-endpoint failures into its own diagnostic
object using the request URL as `sourceUrl`, the HTTP status as `status`, and
the text response body as `error`. Generic capture endpoints do not guarantee
CAPTCHA classification because they return raw artifacts; use `/search` when
provider block/CAPTCHA diagnostics are required.

## Search Contract

`GET /search?q=<QUERY>&provider=<PROVIDER>&limit=<N>&format=json|markdown`

CLI equivalent:

```bash
web-capture search "<QUERY>" --provider <PROVIDER> --limit <N>
web-capture search "<QUERY>" --provider <PROVIDER> --format markdown
```

JSON response:

```json
{
  "query": "formal methods",
  "provider": "wikipedia",
  "captureMode": "fetch",
  "capturedAt": "2026-05-18T20:30:00.000Z",
  "results": [
    {
      "rank": 1,
      "title": "Formal methods",
      "url": "https://en.wikipedia.org/wiki/Formal_methods",
      "snippet": "mathematically rigorous techniques"
    }
  ],
  "diagnostics": {
    "status": 200,
    "blockedByCors": false,
    "blockedByCaptcha": false,
    "sourceUrl": "https://en.wikipedia.org/w/rest.php/v1/search/page?q=formal%20methods&limit=10"
  }
}
```

`diagnostics.error` is present when a transport or provider capture failure is
recorded. Search transport failures are reported in this JSON object with an
empty `results` array instead of being silently discarded.

Provider catalog:

| Provider     | Default | Source                     | Notes                                                                     |
| ------------ | ------- | -------------------------- | ------------------------------------------------------------------------- |
| `wikipedia`  | Yes     | Wikipedia REST search API  | Preferred CORS-friendly provider.                                         |
| `duckduckgo` | No      | `html.duckduckgo.com/html` | Parsed from provider HTML server-side.                                    |
| `google`     | No      | Google Search HTML         | Best-effort parser; CAPTCHA/block pages are reported through diagnostics. |
| `bing`       | No      | Bing Search HTML           | Best-effort parser.                                                       |
| `brave`      | No      | Brave Search HTML          | Best-effort parser.                                                       |

Provider IDs are a strict allow-list. Unknown providers return `400` over HTTP
or a non-zero CLI exit.

## web-search Relationship

`web-capture` currently owns the five-provider `/search` catalog above. No
`web-search`-backed provider catalog is implemented in this repository as of
June 12, 2026.

If a future `web-search` integration is added for broader provider coverage, it
should preserve this response shape and either:

- expose additional providers through an explicit catalog, or
- delegate internally while keeping the existing provider IDs stable.

FormalAI should not assume that providers outside this allow-list exist until
they are documented or exposed by a machine-readable catalog.

## CLI Contract

Capture mode:

```bash
web-capture <URL> --format markdown -o -
web-capture <URL> --format html -o -
web-capture <URL> --format txt -o -
web-capture <URL> --archive zip --output capture.zip
web-capture <URL> --format png --output screenshot.png
```

Stable CLI behavior:

| Format            | Recommended FormalAI invocation                          | Output shape                                 |
| ----------------- | -------------------------------------------------------- | -------------------------------------------- |
| `markdown` / `md` | `web-capture <URL> --format markdown -o -`               | Markdown on stdout.                          |
| `html`            | `web-capture <URL> --format html -o -`                   | HTML on stdout.                              |
| `txt` / `text`    | `web-capture <URL> --format txt -o -`                    | Plain text on stdout.                        |
| `archive` / `zip` | `web-capture <URL> --archive zip --output capture.zip`   | ZIP file bytes at the output path.           |
| `image` / `png`   | `web-capture <URL> --format png --output screenshot.png` | PNG file bytes at the output path.           |
| `jpeg`            | JavaScript implementation                                | JPEG file bytes at the output path.          |
| `search`          | `web-capture search "<QUERY>" --provider wikipedia`      | Normalized search JSON on stdout by default. |

CLI failures use a non-zero exit code and a human-readable stderr message.
FormalAI should normalize the CLI diagnostic with:

- `status`: process exit code.
- `sourceUrl`: requested URL or search provider URL when available from the
  search JSON.
- `error`: stderr text for failed processes, or `diagnostics.error` from
  successful `/search` JSON with empty results.
- `blockedByCaptcha`: `/search.diagnostics.blockedByCaptcha` when using search;
  otherwise unknown.

## Smoke Tests

The contract is covered by smoke tests in:

- `js/tests/integration/formalai-contract.test.js`
- `js/tests/unit/cli.test.js`

These tests assert the stable HTTP content types, binary signatures, ZIP
contents, search JSON diagnostics, provider allow-list, and CLI output shapes
that FormalAI should depend on.
