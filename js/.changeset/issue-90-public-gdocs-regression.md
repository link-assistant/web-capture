---
'@link-assistant/web-capture': patch
---

Add a live Google Docs integration test that captures the public markdown
round-trip reference document
(https://docs.google.com/document/d/1f5zI2xOFpKa90v0GjamO_t7lqSdzMlaM/edit)
and verifies every documented URL variation, capture-method selection path,
and feature-section heading. The test is gated behind `GDOCS_INTEGRATION=true`
and is wired into CI so regressions in the `--capture api` HTML-to-Markdown
pipeline surface against a real Google Doc. Addresses issue #90.
