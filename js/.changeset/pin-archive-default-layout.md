---
'@link-assistant/web-capture': patch
---

Pin the default `--format archive` layout contract so the zip always contains exactly `document.md` + `document.html` + `images/` (issue #113). The markdown-format archive endpoint previously bundled only `document.md` and `images/`, omitting the reference `document.html`; it now includes it on every path. Adds a reusable `buildArchiveFromHtml(html, baseUrl)` helper and an integration test that pins the layout so a future refactor cannot regress it.
