---
'@link-assistant/web-capture': patch
---

Fix Rust CLI `--capture browser` silently routing through direct HTTP
fetches for non-Google-Docs URLs (issue #80):

- `rust/src/main.rs` now passes `--capture browser` through
  `render_html` for markdown, archive, and html output formats so the
  flag actually launches headless Chrome instead of calling
  `fetch_html`.
- `rust/src/browser.rs` `capture_screenshot` is no longer a stub — it
  launches headless Chrome with `--screenshot` and returns real PNG
  bytes.
- Adds Rust integration tests that run a local HTTP fixture whose DOM
  is mutated by JavaScript after load and verify the rendered HTML,
  the CLI `--capture browser` markdown output, and the PNG signature
  on the screenshot bytes.

No JS package behavior changes in this patch; the Rust CLI is the only
affected surface.
