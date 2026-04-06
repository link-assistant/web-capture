# Case Study: Upgrade to browser-commander v0.8.0

**Issue:** [#29 – Use latest version of browser-commander](https://github.com/link-assistant/web-capture/issues/29)

## Summary

This case study documents the analysis and implementation of upgrading the
`browser-commander` dependency from v0.4.0 to v0.8.0, and migrating the
`web-capture` codebase to use new first-class APIs introduced in v0.5.x–v0.8.0.

---

## Context

`web-capture` uses `browser-commander` as a unified abstraction over Playwright
and Puppeteer. At v0.4.0, the library supported:

- Launching a browser with custom `args` (added in v0.4.0)
- A raw `launchBrowser({ engine, args, headless, ... })` → `{ browser, page }`

All other browser features (PDF export, color scheme emulation, keyboard
interaction, dialog handling, page evaluation) required direct access to the
underlying Playwright/Puppeteer page object via the `rawPage` workaround.

---

## Versions and New Features

### v0.5.x (2026-01-10 to 2026-01-13)

- Bug fix: `PlaywrightAdapter.evaluateOnPage()` now correctly spreads multiple
  arguments (matching Puppeteer behavior).
- `normalizeSelector` now rejects arrays and invalid types (prevents
  `querySelectorAll` errors with bad selectors).

### v0.6.0 (2026-04-06)

- Officially documented `commander.page` as an escape hatch to access the raw
  underlying Playwright/Puppeteer page object.
- Formalized `launchBrowser()` return values as part of the public API.
- This release enabled users to call `commander.page.pdf()`,
  `commander.page.emulateMedia()`, etc. without monkey-patching.

### v0.7.0 (2026-04-06)

Three major features added as first-class APIs:

1. **Color scheme emulation** (`emulateMedia`)
   - Standalone: `emulateMedia({ page, engine, colorScheme })`
   - On commander: `commander.emulateMedia({ colorScheme })`
   - At launch: `launchBrowser({ colorScheme: 'dark' })`
   - Uses `page.emulateMedia()` for Playwright, `page.emulateMediaFeatures()`
     for Puppeteer.

2. **Keyboard interaction**
   - `commander.keyboard.press(key)` / `.type(text)` / `.down(key)` / `.up(key)`
   - Flat aliases: `commander.pressKey({ key })`, `commander.typeText({ text })`
   - Standalone: `pressKey({ page, engine, key })`

3. **Dialog event handling**
   - `commander.onDialog(handler)` — register async handler for browser dialogs
   - `commander.offDialog(handler)` / `commander.clearDialogHandlers()`
   - Auto-dismiss fires when no handlers registered (prevents page freeze)
   - Standalone: `createDialogManager({ page, engine, log })`

### v0.8.0 (2026-04-06)

- **PDF generation** added as first-class API
  - Standalone: `pdf({ page, engine, pdfOptions })`
  - On commander: `commander.pdf({ pdfOptions })`
  - Eliminates the `rawPage.pdf()` workaround previously needed
  - Works for Chromium headless only (not Firefox/WebKit)

---

## Problems Found in web-capture v1.2.0

### 1. `rawPage` workaround in `pdf.js`

```js
// Before (v0.4.0 workaround)
const rawPage = page.rawPage || page;
const pdfBuffer = await rawPage.pdf({ format: 'A4', printBackground: true });
```

The `rawPage` pattern was necessary in v0.4.0 but is now an anti-pattern since
v0.8.0 ships `commander.pdf()`.

**Fix:** Use `page.pdf({ pdfOptions: { ... } })` via the new adapter.

### 2. `rawPage.evaluate()` in `image.js` and `popups.js`

```js
// Before (v0.4.0 workaround)
const rawPage = page.rawPage || page;
await rawPage.evaluate(() => window.scrollTo(0, 0));
```

`commander.evaluate({ fn })` was always available but not exposed on the page
adapter.

**Fix:** Expose `page.evaluate(fn, ...args)` on the PageAdapter, delegating to
`commander.evaluate({ fn, args })`.

### 3. `rawPage.keyboard.press()` in `popups.js`

```js
// Before (v0.4.0 workaround)
if (rawPage.keyboard) {
  await rawPage.keyboard.press('Escape');
}
```

With browser-commander v0.7.0, keyboard interaction is a first-class unified
API across both engines.

**Fix:** Use `page.keyboard.press('Escape')` via the adapter's `keyboard`
property (backed by `commander.keyboard`).

### 4. `rawPage.on('dialog', ...)` in `popups.js`

```js
// Before (v0.4.0 workaround)
if (typeof rawPage.on === 'function') {
  rawPage.on('dialog', async (dialog) => { await dialog.dismiss(); });
}
```

With browser-commander v0.7.0, dialog handling is unified via `commander.onDialog()`.

**Fix:** Use `page.onDialog(handler)` via the adapter (backed by `commander.onDialog()`).

### 5. Inline color scheme emulation in `browser.js`

```js
// Before (v0.4.0 manual implementation)
if (engineType === 'puppeteer') {
  const client = await newPage.createCDPSession();
  await client.send('Emulation.setEmulatedMedia', { ... });
} else if (engineType === 'playwright') {
  await newPage.emulateMedia({ colorScheme });
}
```

**Fix:** Use `emulateMedia({ page, engine, colorScheme })` from browser-commander v0.7.0.

---

## Solution

### Architecture change: `makeBrowserCommander` facade

The key improvement is wrapping the raw page with `makeBrowserCommander`:

```js
// After
import { launchBrowser, makeBrowserCommander, emulateMedia } from 'browser-commander';

const { browser, page: initialPage } = await launchBrowser({ engine, args, ... });
const rawPage = await browser.newPage();
await emulateMedia({ page: rawPage, engine, colorScheme });     // v0.7.0
const commander = makeBrowserCommander({ page: rawPage });      // full facade
```

The `PageAdapter` returned by `browser.newPage()` now exposes:

| Method / Property | Source | Available since |
|---|---|---|
| `setExtraHTTPHeaders()` | `rawPage` | v0.4.0 |
| `setUserAgent()` | `rawPage` | v0.4.0 |
| `setViewport()` | `rawPage` | v0.4.0 |
| `goto()` | `rawPage` | v0.4.0 |
| `content()` | `rawPage` | v0.4.0 |
| `screenshot()` | `rawPage` | v0.4.0 |
| `close()` | `rawPage` + `commander.destroy()` | v0.4.0 |
| `evaluate(fn, ...args)` | `commander.evaluate()` | new in this PR |
| `pdf({ pdfOptions })` | `commander.pdf()` | browser-commander v0.8.0 |
| `emulateMedia({ colorScheme })` | `commander.emulateMedia()` | browser-commander v0.7.0 |
| `keyboard.press/type/down/up` | `commander.keyboard` | browser-commander v0.7.0 |
| `onDialog(handler)` | `commander.onDialog()` | browser-commander v0.7.0 |
| `offDialog(handler)` | `commander.offDialog()` | browser-commander v0.7.0 |
| `clearDialogHandlers()` | `commander.clearDialogHandlers()` | browser-commander v0.7.0 |

---

## Files Changed

| File | Change |
|---|---|
| `package.json` | `browser-commander` `^0.4.0` → `^0.8.0` |
| `src/browser.js` | Use `makeBrowserCommander`; expose new APIs on PageAdapter |
| `src/pdf.js` | Use `page.pdf({ pdfOptions })` instead of `rawPage.pdf()` |
| `src/image.js` | Use `page.evaluate()` instead of `rawPage.evaluate()` |
| `src/popups.js` | Use `page.onDialog()`, `page.keyboard`, `page.evaluate()` instead of `rawPage.*` |
| `tests/unit/browser.test.js` | Add tests for new browser-commander v0.7.0+ APIs |

---

## References

- [browser-commander releases](https://github.com/link-foundation/browser-commander/releases)
- [browser-commander v0.7.0 – keyboard, dialog, emulateMedia](https://github.com/link-foundation/browser-commander/releases/tag/v0.7.0)
- [browser-commander v0.8.0 – pdf()](https://github.com/link-foundation/browser-commander/releases/tag/v0.8.0)
- [Issue #35: PDF generation](https://github.com/link-foundation/browser-commander/issues/35)
- [Issue #36: Color scheme emulation](https://github.com/link-foundation/browser-commander/issues/36)
- [Issue #37: Keyboard interaction](https://github.com/link-foundation/browser-commander/issues/37)
- [Issue #38: Dialog event handling](https://github.com/link-foundation/browser-commander/issues/38)
- [Issue #39: Official extensibility docs](https://github.com/link-foundation/browser-commander/issues/39)
