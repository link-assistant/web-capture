---
'@link-assistant/web-capture': minor
---

Upgrade browser-commander to v0.8.0 and use new first-class APIs: `commander.pdf()` for PDF generation (v0.8.0), `commander.emulateMedia()` for color scheme emulation (v0.7.0), `commander.keyboard` for keyboard interaction (v0.7.0), and `commander.onDialog()` for dialog handling (v0.7.0). Removes all `rawPage` workarounds in favor of the unified browser-commander facade via `makeBrowserCommander`. Add image format options (PNG/JPEG), viewport configuration, dark/light theme support, popup auto-dismissal, ZIP archive, PDF, and DOCX export endpoints. Add comprehensive Habr article integration tests.
