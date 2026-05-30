---
'@link-assistant/web-capture': minor
---

Pin the default image-mode contract and route every capture path through a single image-handling chokepoint (`applyImageMode`), so the same flag behaves identically regardless of capture method (browser vs API, CLI vs server) — issue #112. Default `--format markdown` now references images by their direct remote URL (no `images/` folder, no inline base64); inline base64 (which has no remote URL to restore) is stripped to a visible placeholder with a warning instead of being silently kept as a multi-megabyte blob. `--embed-images` keeps base64 inline for a self-contained file. The new `--extract-images[=DIR]` flag extracts inline base64 **and** downloads remote images into `DIR/images/`, rewriting the markdown to reference the local files; on download failure the original remote URL is restored so references never break. `--keep-original-links` remains a back-compat alias for the default behavior.
