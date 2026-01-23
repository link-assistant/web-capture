import { createBrowser, getBrowserEngine } from './browser.js';

export async function imageHandler(req, res) {
  const url = req.query.url;
  if (!url) {
    return res.status(400).send('Missing `url` parameter');
  }
  try {
    // Ensure URL is absolute
    const absoluteUrl = url.startsWith('http') ? url : `https://${url}`;
    const engine = getBrowserEngine(req);
    const browser = await createBrowser(engine);
    try {
      const page = await browser.newPage();
      await page.setExtraHTTPHeaders({
        'Accept-Language': 'en-US,en;q=0.9',
        'Accept-Charset': 'utf-8',
      });
      await page.setUserAgent(
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
      );
      await page.setViewport({ width: 1280, height: 800 });
      await page.goto(absoluteUrl, {
        waitUntil: 'networkidle0',
        timeout: 30000,
      });
      // Wait for 5 seconds after page load
      await new Promise((resolve) => setTimeout(resolve, 5000));
      // Take a screenshot of just the viewport (not the full page)
      const buffer = await page.screenshot({ type: 'png' });
      res.set('Content-Type', 'image/png');
      res.set('Content-Disposition', 'inline; filename="screenshot.png"');
      res.end(buffer);
    } finally {
      await browser.close();
    }
  } catch (err) {
    console.error(err);
    res.status(500).send('Error capturing screenshot');
  }
}
