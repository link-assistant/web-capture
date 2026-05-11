---
'@link-assistant/web-capture': patch
---

Fix `stripBase64Images` (used by `--keep-original-links`) dropping every base64 image with empty alt text instead of leaving a visible placeholder. Google Docs HTML exports emit `<img alt="" src="data:image/png;base64,...">` for every image, so the previous behaviour silently deleted all images from the rendered markdown. Empty-alt now renders as `![]()` (a valid empty image reference); non-empty alt continues to render as `*[image: <alt>]*`.
