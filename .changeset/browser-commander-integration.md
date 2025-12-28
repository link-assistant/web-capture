---
'@link-assistant/web-capture': minor
---

Fully integrate browser-commander library for all browser operations

- Use browser-commander's launchBrowser for both Puppeteer and Playwright
- Pass server-specific args (--no-sandbox, etc.) via the args option
- Configure headless mode and unique userDataDir for server environments
- Update browser-commander dependency from ^0.3.0 to ^0.4.0
