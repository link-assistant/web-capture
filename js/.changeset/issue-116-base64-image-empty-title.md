---
'@link-assistant/web-capture': patch
---

Fix `extractAndSaveImages` / `extractBase64ToBuffers` silently dropping base64 images when the markdown image is followed by a title attribute (e.g. `![](data:image/png;base64,... "")`). The base64 payload regex used `[^)]+`, which greedily included the trailing ` ""` and made `Buffer.from()` produce a decoded buffer that no longer matched the original image. The pattern now restricts the payload to base64 alphabet characters and matches the optional trailing markdown title separately so the title cannot leak into the payload.
