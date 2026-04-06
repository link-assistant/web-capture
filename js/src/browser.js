// Browser abstraction layer using browser-commander for all browser operations
// See: https://github.com/link-foundation/browser-commander

import {
  launchBrowser,
  makeBrowserCommander,
  emulateMedia,
} from 'browser-commander';
import os from 'os';
import path from 'path';

/**
 * Additional Chrome args needed for headless server environments
 * These are appended to browser-commander's default CHROME_ARGS
 */
const SERVER_CHROME_ARGS = [
  '--no-sandbox',
  '--disable-setuid-sandbox',
  '--disable-dev-shm-usage',
];

/**
 * Unified page interface wrapping browser-commander's makeBrowserCommander.
 *
 * Exposes:
 * - setExtraHTTPHeaders / setUserAgent / setViewport / goto / content / screenshot / close
 *   (via the underlying raw page for cross-engine compatibility)
 * - commander.pdf()           – PDF generation (browser-commander v0.8.0)
 * - commander.emulateMedia()  – Color scheme emulation (browser-commander v0.7.0)
 * - commander.keyboard        – Keyboard interaction (browser-commander v0.7.0)
 * - commander.onDialog()      – Dialog event handling (browser-commander v0.7.0)
 * - commander.evaluate()      – Page evaluation (browser-commander)
 * All other browser-commander APIs are available on the returned commander object.
 *
 * @typedef {Object} PageAdapter
 * @property {Function} setExtraHTTPHeaders - Set HTTP headers
 * @property {Function} setUserAgent - Set user agent
 * @property {Function} setViewport - Set viewport size
 * @property {Function} goto - Navigate to URL
 * @property {Function} content - Get page HTML content
 * @property {Function} screenshot - Take screenshot
 * @property {Function} close - Close the page
 * @property {Function} pdf - Generate PDF (browser-commander v0.8.0)
 * @property {Function} emulateMedia - Color scheme emulation (browser-commander v0.7.0)
 * @property {Object} keyboard - Keyboard interaction (browser-commander v0.7.0)
 * @property {Function} onDialog - Dialog event handling (browser-commander v0.7.0)
 * @property {Function} evaluate - Page evaluation
 * @property {string} type - Browser type ('puppeteer' or 'playwright')
 */

/**
 * Create a browser instance using the specified engine.
 * Uses browser-commander's launchBrowser + makeBrowserCommander facade.
 *
 * @param {string} engine - 'puppeteer' or 'playwright' (defaults to puppeteer)
 * @param {Object} options - Browser launch options
 * @param {string} [options.colorScheme] - Color scheme: 'light', 'dark', or 'no-preference'
 * @returns {Promise<Object>} - Browser handle with newPage() and close()
 */
export async function createBrowser(engine = 'puppeteer', options = {}) {
  const normalizedEngine = engine.toLowerCase();
  const engineType =
    normalizedEngine === 'playwright' || normalizedEngine === 'pw'
      ? 'playwright'
      : 'puppeteer';

  const { colorScheme, ...launchOpts } = options;

  // Generate unique userDataDir for this session to avoid conflicts
  const userDataDir = path.join(
    os.tmpdir(),
    `web-capture-${engineType}-${Date.now()}`
  );

  // Use browser-commander's launchBrowser with server-specific args
  const { browser, page: initialPage } = await launchBrowser({
    engine: engineType,
    args: SERVER_CHROME_ARGS,
    headless: true,
    userDataDir,
    slowMo: 0,
    ...launchOpts,
  });

  // Close the initial page since we'll create new ones via newPage()
  await initialPage.close();

  return {
    async newPage() {
      const rawPage = await browser.newPage();

      // Apply color scheme emulation using browser-commander's unified API (v0.7.0+)
      if (colorScheme) {
        try {
          await emulateMedia({
            page: rawPage,
            engine: engineType,
            colorScheme,
          });
        } catch {
          /* emulateMedia not available in all environments */
        }
      }

      // Wrap with the full browser-commander facade for unified API access
      const commander = makeBrowserCommander({ page: rawPage });

      // Build a unified page adapter that exposes both:
      // 1. The familiar cross-engine adapter interface (setExtraHTTPHeaders, goto, etc.)
      // 2. All browser-commander v0.7.0+ APIs (pdf, emulateMedia, keyboard, onDialog, evaluate)
      return createPageAdapter(rawPage, commander, engineType);
    },
    async close() {
      await browser.close();
    },
    type: engineType,
    rawBrowser: browser,
  };
}

/**
 * Create a unified page adapter from a raw page and its browser-commander facade.
 * Provides a stable cross-engine interface plus all new browser-commander APIs.
 *
 * @param {Object} rawPage - Raw Playwright or Puppeteer page
 * @param {Object} commander - browser-commander facade from makeBrowserCommander
 * @param {string} engineType - 'puppeteer' or 'playwright'
 * @returns {PageAdapter}
 */
function createPageAdapter(rawPage, commander, engineType) {
  return {
    // --- Cross-engine adapter methods (stable interface) ---

    async setExtraHTTPHeaders(headers) {
      await rawPage.setExtraHTTPHeaders(headers);
    },
    async setUserAgent(userAgent) {
      if (engineType === 'playwright') {
        // Playwright doesn't have page.setUserAgent, use extraHTTPHeaders instead
        await rawPage.setExtraHTTPHeaders({ 'User-Agent': userAgent });
      } else {
        await rawPage.setUserAgent(userAgent);
      }
    },
    async setViewport(viewport) {
      if (engineType === 'playwright') {
        // Playwright uses setViewportSize instead of setViewport
        await rawPage.setViewportSize(viewport);
      } else {
        await rawPage.setViewport(viewport);
      }
    },
    async goto(url, options = {}) {
      if (engineType === 'playwright') {
        // Convert Puppeteer waitUntil options to Playwright equivalents
        const playwrightOptions = { ...options };
        if (playwrightOptions.waitUntil === 'networkidle0') {
          playwrightOptions.waitUntil = 'networkidle';
        }
        await rawPage.goto(url, playwrightOptions);
      } else {
        await rawPage.goto(url, options);
      }
    },
    async content() {
      return await rawPage.content();
    },
    async screenshot(options = {}) {
      return await rawPage.screenshot(options);
    },
    async close() {
      await commander.destroy();
      await rawPage.close();
    },

    // --- browser-commander v0.8.0+: PDF generation ---
    // Usage: await page.pdf({ pdfOptions: { format: 'A4', printBackground: true } })
    async pdf(opts = {}) {
      return await commander.pdf(opts);
    },

    // --- browser-commander v0.7.0+: Color scheme emulation ---
    // Usage: await page.emulateMedia({ colorScheme: 'dark' })
    async emulateMedia(opts = {}) {
      return await commander.emulateMedia(opts);
    },

    // --- browser-commander v0.7.0+: Keyboard interaction ---
    // Usage: await page.keyboard.press('Escape')
    get keyboard() {
      return commander.keyboard;
    },

    // --- browser-commander v0.7.0+: Dialog event handling ---
    // Usage: page.onDialog(async (dialog) => { await dialog.dismiss(); })
    onDialog(handler) {
      return commander.onDialog(handler);
    },
    offDialog(handler) {
      return commander.offDialog(handler);
    },
    clearDialogHandlers() {
      return commander.clearDialogHandlers();
    },

    // --- browser-commander: Page evaluation ---
    // Usage: await page.evaluate(() => window.scrollTo(0, 0))
    async evaluate(fn, ...args) {
      return await commander.evaluate({ fn, args });
    },

    // Engine type identifier
    type: engineType,
  };
}

/**
 * Get the browser engine from query parameters or environment variable
 * @param {Object} req - Express request object
 * @returns {string} - 'puppeteer' or 'playwright'
 */
export function getBrowserEngine(req) {
  // Check query parameter first
  const engineParam = req.query.engine || req.query.browser;
  if (engineParam) {
    const normalized = engineParam.toLowerCase();
    if (normalized === 'playwright' || normalized === 'pw') {
      return 'playwright';
    }
    if (normalized === 'puppeteer' || normalized === 'pptr') {
      return 'puppeteer';
    }
  }

  // Check environment variable
  const envEngine = process.env.BROWSER_ENGINE;
  if (envEngine) {
    const normalized = envEngine.toLowerCase();
    if (normalized === 'playwright') {
      return 'playwright';
    }
  }

  // Default to puppeteer for backward compatibility
  return 'puppeteer';
}
