---
'@link-assistant/web-capture': patch
---

Fix remaining Google Docs capture gaps from issue #92 in both the JS and
Rust CLIs:

- Browser capture now keeps multi-column table rows intact, renders
  ordered lists with sequential `1. 2. 3.` numbering, and joins same-list
  items with a single newline so tight-list markdown matches the source
  document.
- Archive mode downloads `docs-images-rt/...` image URLs into the
  archive's `images/` directory and rewrites markdown/html references so
  exports are self-contained.
- API mode (`--capture api`) runs the export HTML through a shared
  preprocessor that hoists inline bold / italic / strikethrough spans to
  semantic tags, strips Google Docs' heading-numbering spans and empty
  anchor wrappers, unwraps `google.com/url?q=` redirects, and normalizes
  non-breaking spaces.
