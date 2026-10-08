---
'@link-assistant/web-capture': patch
---

Use Node's built-in `fetch` instead of `node-fetch`, removing the deprecated `node-domexception` package from the install. Transport diagnostics now include the underlying network error (for example `fetch failed: connect ECONNREFUSED ...`) and no longer report server-side network failures as possible CORS blocks.
