---
'@link-assistant/web-capture': minor
---

Extract base64 images to files by default instead of embedding inline in markdown.
Remove --enhanced umbrella flag; make sub-features (extract-latex, extract-metadata, post-process, detect-code-language) default to true.
Add --embed-images, --images-dir, --no-extract-images, --archive, --data-dir, --keep-original-links flags.
Add embedImages and keepOriginalLinks query params to /markdown and /archive API endpoints.
Change default format from html to markdown.
Auto-derive output directory from URL when -o is omitted.
Use content-hash filenames for extracted images instead of positional numbering.
Replace process.env ternaries with lino-arguments getenv() helper.
Add `WEB_CAPTURE_*` environment variable support for all feature flags.
