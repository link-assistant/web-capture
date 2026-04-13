---
'@link-assistant/web-capture': patch
---

Fix cargo publish token resolution: fallback to CARGO_TOKEN when CARGO_REGISTRY_TOKEN is not set, and fail instead of silently skipping publish
