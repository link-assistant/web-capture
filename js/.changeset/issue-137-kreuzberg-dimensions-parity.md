---
'@link-assistant/web-capture': patch
---

Keep JS/Rust kreuzberg parity for the html-to-markdown 3.6 image dimensions
change (issue #137). Export `normalizeStructuredKeys` and add regression tests
asserting inline image `dimensions` are exposed as `{ width, height }`, mirroring
the Rust `inline_image_to_json` fix.
