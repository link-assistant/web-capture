---
'@link-assistant/web-capture': minor
---

Markdown mode now keeps original remote image URLs and strips base64 by default (single-file output).
Archive mode downloads images to images/ folder by default (keepOriginalLinks=false, embedImages=false).
API and CLI share identical defaults for all modes.
Add --embed-images, --images-dir, --no-extract-images, --archive, --data-dir, --keep-original-links flags.
Add embedImages and keepOriginalLinks query params to /markdown and /archive API endpoints.
Change /markdown API defaults: keepOriginalLinks=true, embedImages=false.
Remove --enhanced umbrella flag; make sub-features default to true.
Change default format from html to markdown.
Auto-derive output directory from URL when -o is omitted.
Use content-hash filenames for extracted images instead of positional numbering.
Replace process.env ternaries with lino-arguments getenv() helper.
Add `WEB_CAPTURE_*` environment variable support for all feature flags.
