# Online Sources

These sources were checked while analyzing issue #106.

- Chrome DevTools Protocol `Page.addScriptToEvaluateOnNewDocument`: documents that the injected script runs in every frame before the frame's own scripts, which matches the capture hook used for `DOCS_modelChunk`.
  https://chromedevtools.github.io/devtools-protocol/1-3/Page/#method-addScriptToEvaluateOnNewDocument
- Chrome DevTools Protocol `Runtime.evaluate`: documents `returnByValue` and `awaitPromise`, which are the CDP options used by the Rust browser-model capture to poll the page for model data.
  https://chromedevtools.github.io/devtools-protocol/1-3/Runtime/#method-evaluate
- Google Drive API `files.export`: documents exporting Google Workspace document byte content through an API method, confirming that API/export capture is a separate mechanism from live editor-model capture.
  https://developers.google.com/workspace/drive/api/reference/rest/v3/files/export
- Google Drive export MIME types: lists Markdown (`text/markdown`, `.md`) among supported Google Docs export formats.
  https://developers.google.com/workspace/drive/api/guides/ref-export-formats
- Google Help on exported Google Docs data: confirms Docs export/download includes document text, tables, drawings, and images, which explains why public export is a useful fallback but not identical to editor-model capture.
  https://support.google.com/sites/answer/9759608?hl=en
