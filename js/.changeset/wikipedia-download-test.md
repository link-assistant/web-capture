---
'@link-assistant/web-capture': patch
---

Add a live integration test that downloads the Wikipedia page
(https://en.wikipedia.org/wiki/Wikipedia) as both Markdown and an image (PNG
screenshot) using every supported browser engine — Puppeteer and Playwright
(issue #8). The suite is gated behind `WIKIPEDIA_INTEGRATION=true` so default
offline runs stay deterministic, and is wired into CI as a dedicated live step.
