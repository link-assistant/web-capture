/**
 * Dual-themed screenshot capture module (R3).
 *
 * Captures screenshots in both light and dark themes in a single operation.
 * Uses separate browser contexts for reliable colorScheme application.
 *
 * Based on reference implementation from:
 * https://github.com/link-foundation/meta-theory/blob/main/scripts/download.mjs
 *
 * @module themed-image
 */

import { createBrowser, getBrowserEngine } from './browser.js';
import { dismissPopups, scrollToLoadContent } from './popups.js';

/**
 * Capture a single themed screenshot.
 *
 * @param {Object} browser - Browser instance from createBrowser
 * @param {string} url - URL to capture
 * @param {string} theme - 'light' or 'dark'
 * @param {Object} [options] - Screenshot options
 * @param {number} [options.width=1920] - Viewport width
 * @param {number} [options.height=1080] - Viewport height
 * @param {boolean} [options.fullPage=true] - Full page capture
 * @param {boolean} [options.dismissPopups=true] - Dismiss popups
 * @returns {Promise<Buffer>} Screenshot buffer
 */
async function captureThemedScreenshot(browser, url, theme, options = {}) {
  const {
    width = 1920,
    height = 1080,
    fullPage = true,
    dismissPopups: shouldDismissPopups = true,
  } = options;

  // Create browser with theme-specific color scheme
  const themeOpts = { colorScheme: theme };
  const themedBrowser = await createBrowser(
    browser.type || 'puppeteer',
    themeOpts
  );

  try {
    const page = await themedBrowser.newPage();
    await page.setViewport({ width, height });
    await page.setUserAgent(
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
    );

    await page.goto(url, {
      waitUntil: 'networkidle0',
      timeout: 30000,
    });

    await new Promise((resolve) => setTimeout(resolve, 5000));

    if (fullPage) {
      await scrollToLoadContent(page);
    }

    if (shouldDismissPopups) {
      await dismissPopups(page);
      // eslint-disable-next-line no-undef
      await page.evaluate(() => window.scrollTo(0, 0));
      await new Promise((resolve) => setTimeout(resolve, 500));
    }

    const buffer = await page.screenshot({
      type: 'png',
      fullPage,
    });

    return buffer;
  } finally {
    await themedBrowser.close();
  }
}

/**
 * Capture screenshots in both light and dark themes.
 *
 * @param {string} url - URL to capture
 * @param {Object} [options] - Options
 * @param {string} [options.engine='puppeteer'] - Browser engine
 * @param {number} [options.width=1920] - Viewport width
 * @param {number} [options.height=1080] - Viewport height
 * @param {boolean} [options.fullPage=true] - Full page capture
 * @param {boolean} [options.dismissPopups=true] - Dismiss popups
 * @returns {Promise<Object>} Result with light and dark screenshot buffers
 */
export async function captureDualThemeScreenshots(url, options = {}) {
  const absoluteUrl = url.startsWith('http') ? url : `https://${url}`;
  const engine = options.engine || 'puppeteer';

  // Capture light theme
  const lightBuffer = await captureThemedScreenshot(
    { type: engine },
    absoluteUrl,
    'light',
    options
  );

  // Capture dark theme
  const darkBuffer = await captureThemedScreenshot(
    { type: engine },
    absoluteUrl,
    'dark',
    options
  );

  return {
    light: lightBuffer,
    dark: darkBuffer,
    url: absoluteUrl,
    width: options.width || 1920,
    height: options.height || 1080,
  };
}

/**
 * Dual-themed screenshot handler for Express API.
 *
 * Query parameters:
 *   url        (required) - URL to capture
 *   engine     - 'puppeteer' or 'playwright'
 *   width      - viewport width (default 1920)
 *   height     - viewport height (default 1080)
 *   fullPage   - 'true' (default) to capture full page
 *   dismissPopups - 'true' (default) to dismiss popups
 */
export async function themedImageHandler(req, res) {
  const url = req.query.url;
  if (!url) {
    return res.status(400).send('Missing `url` parameter');
  }

  try {
    const engine = getBrowserEngine(req);
    const width = parseInt(req.query.width, 10) || 1920;
    const height = parseInt(req.query.height, 10) || 1080;
    const fullPage = req.query.fullPage !== 'false';
    const shouldDismissPopups = req.query.dismissPopups !== 'false';

    const result = await captureDualThemeScreenshots(url, {
      engine,
      width,
      height,
      fullPage,
      dismissPopups: shouldDismissPopups,
    });

    // Return as JSON with base64-encoded images
    res.json({
      url: result.url,
      width: result.width,
      height: result.height,
      light: result.light.toString('base64'),
      dark: result.dark.toString('base64'),
      lightSize: result.light.length,
      darkSize: result.dark.length,
    });
  } catch (err) {
    console.error(err);
    res.status(500).send('Error capturing themed screenshots');
  }
}
