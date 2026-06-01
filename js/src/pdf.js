/**
 * PDF export handler.
 *
 * Renders a web page to PDF using the browser's native print-to-PDF.
 * All images are embedded automatically by the browser engine.
 *
 * Query parameters:
 *   url       (required) - URL to capture
 *   engine    - 'puppeteer' or 'playwright'
 *   width     - viewport width in px (default 1280)
 *   height    - viewport height in px (default 800)
 *   theme     - 'light' or 'dark'
 *   dismissPopups - 'true' (default) to auto-close popups before export
 */

import { createBrowser, getBrowserEngine } from './browser.js';
import { dismissPopups, scrollToLoadContent } from './popups.js';

export async function pdfHandler(req, res) {
  const url = req.query.url;
  if (!url) {
    return res.status(400).send('Missing `url` parameter');
  }

  const width = parseInt(req.query.width, 10) || 1280;
  const height = parseInt(req.query.height, 10) || 800;
  const theme = req.query.theme;
  const shouldDismissPopups = req.query.dismissPopups !== 'false';

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

      await new Promise((resolve) => setTimeout(resolve, 5000));
      await scrollToLoadContent(page);

      if (shouldDismissPopups) {
        await dismissPopups(page);
      }

      // Generate PDF using browser-commander's unified pdf() API (v0.8.0+)
      const pdfBuffer = await page.pdf({
        pdfOptions: {
          format: 'A4',
          printBackground: true,
          margin: { top: '1cm', right: '1cm', bottom: '1cm', left: '1cm' },
        },
      });

      res.set('Content-Type', 'application/pdf');
      res.set('Content-Disposition', 'inline; filename="page.pdf"');
      res.end(pdfBuffer);
    } finally {
      await browser.close();
    }
  } catch (err) {
    console.error(err);
    res.status(500).send('Error generating PDF');
  }
}
