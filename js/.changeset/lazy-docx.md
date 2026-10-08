---
'@link-assistant/web-capture': patch
---

Load the `docx` library only when a DOCX is generated. Its bundled browser polyfills read `globalThis.localStorage` on import, so on Node 25+ every process that imported the server printed "ExperimentalWarning: localStorage is not available because --localstorage-file was not provided".
