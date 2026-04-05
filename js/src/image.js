import { createBrowser, getBrowserEngine } from './browser.js';
import { dismissPopups, scrollToLoadContent } from './popups.js';

/**
 * Image screenshot handler.
 *
 * Query parameters:
 *   url       (required) - URL to capture
 *   engine    - 'puppeteer' or 'playwright'
 *   format    - 'png' (default, lossless) or 'jpeg'
 *   quality   - JPEG quality 0-100 (default 80, ignored for PNG)
 *   width     - viewport width in px (default 1280)
 *   height    - viewport height in px (default 800)
 *   fullPage  - 'true' to capture full scrollable page (default 'false')
 *   theme     - 'light', 'dark', or 'no-preference' (default: browser default)
 *   dismissPopups - 'true' to auto-close cookie/consent popups before capture (default 'true')
 */
export async function imageHandler(req, res) {
  const url = req.query.url;
  if (!url) {
    return res.status(400).send('Missing `url` parameter');
  }

  // Parse options from query parameters
  const format = (req.query.format || 'png').toLowerCase();
  if (format !== 'png' && format !== 'jpeg') {
    return res.status(400).send('Invalid `format`: must be "png" or "jpeg"');
  }
  const quality =
    format === 'jpeg'
      ? Math.min(100, Math.max(0, parseInt(req.query.quality, 10) || 80))
      : undefined;
  const width = parseInt(req.query.width, 10) || 1280;
  const height = parseInt(req.query.height, 10) || 800;
  const fullPage = req.query.fullPage === 'true';
  const theme = req.query.theme; // 'light', 'dark', or undefined
  const shouldDismissPopups = req.query.dismissPopups !== 'false'; // default true

  try {
    const absoluteUrl = url.startsWith('http') ? url : `https://${url}`;
    const engine = getBrowserEngine(req);
    const browserOpts = theme ? { colorScheme: theme } : {};
    const browser = await createBrowser(engine, browserOpts);
    try {
      const page = await browser.newPage();
      await page.setExtraHTTPHeaders({
        'Accept-Language': 'en-US,en;q=0.9',
        'Accept-Charset': 'utf-8',
      });
      await page.setUserAgent(
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
      );
      await page.setViewport({ width, height });
      await page.goto(absoluteUrl, {
        waitUntil: 'networkidle0',
        timeout: 30000,
      });

      // Wait for dynamic content
      await new Promise((resolve) => setTimeout(resolve, 5000));

      if (fullPage) {
        // Scroll to trigger lazy-loaded images
        await scrollToLoadContent(page);
      }

      if (shouldDismissPopups) {
        await dismissPopups(page);
        // Scroll back to top after dismissing popups
        const rawPage = page._page || page;
        // eslint-disable-next-line no-undef
        await rawPage.evaluate(() => window.scrollTo(0, 0));
        await new Promise((resolve) => setTimeout(resolve, 500));
      }

      // Build screenshot options
      const screenshotOpts = {
        type: format,
        fullPage,
      };
      if (format === 'jpeg') {
        screenshotOpts.quality = quality;
      }

      const buffer = await page.screenshot(screenshotOpts);

      const contentType = format === 'jpeg' ? 'image/jpeg' : 'image/png';
      const ext = format === 'jpeg' ? 'jpg' : 'png';
      res.set('Content-Type', contentType);
      res.set('Content-Disposition', `inline; filename="screenshot.${ext}"`);
      res.end(buffer);
    } finally {
      await browser.close();
    }
  } catch (err) {
    console.error(err);
    res.status(500).send('Error capturing screenshot');
  }
}
