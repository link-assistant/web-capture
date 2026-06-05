/**
 * Integration tests for downloading the Wikipedia page (issue #8).
 *
 * Verifies that web-capture can actually download the Wikipedia article about
 * Wikipedia itself (https://en.wikipedia.org/wiki/Wikipedia) as both Markdown
 * and an image (PNG screenshot) using every supported browser engine
 * (Puppeteer and Playwright).
 *
 * These tests hit the live Wikipedia servers. Set WIKIPEDIA_INTEGRATION=true to
 * run them. In CI they are enabled via the workflow environment variable. When
 * the variable is unset the suite is skipped so default/offline runs stay
 * deterministic.
 *
 * Navigation uses retry with exponential backoff to absorb transient network
 * failures, mirroring the Habr integration suite.
 */

import { jest } from '@jest/globals';
import { createBrowser } from '../../src/browser.js';
import { convertHtmlToMarkdown } from '../../src/lib.js';
import { retry } from '../../src/retry.js';

const WIKIPEDIA_URL = 'https://en.wikipedia.org/wiki/Wikipedia';

// PNG magic number (89 50 4E 47 0D 0A 1A 0A).
const PNG_SIGNATURE = Buffer.from([
  0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a,
]);

const SKIP_LIVE =
  !process.env.WIKIPEDIA_INTEGRATION ||
  process.env.WIKIPEDIA_INTEGRATION === 'false';
const describeIfLive = SKIP_LIVE ? describe.skip : describe;

// These tests hit live servers and may take a while.
jest.setTimeout(120000);

// Navigate with retry + exponential backoff, then give the page a moment to
// settle so late-loading content and images are present before we capture.
async function navigateWithRetry(page, url) {
  await retry(
    async () => {
      await page.goto(url, {
        waitUntil: 'networkidle0',
        timeout: 60000,
      });
    },
    {
      retries: 3,
      baseDelay: 2000,
      onRetry: (err, attempt, delay) => {
        console.log(
          `Navigation retry ${attempt} for ${url} after ${delay}ms: ${err.message}`
        );
      },
    }
  );
  await new Promise((resolve) => setTimeout(resolve, 5000));
}

// Run the full matrix (Markdown + image) once per supported engine.
describe.each(['puppeteer', 'playwright'])(
  'Wikipedia Page Download (%s engine)',
  (engine) => {
    describeIfLive(`${engine}`, () => {
      let browser;
      let page;

      beforeAll(async () => {
        browser = await createBrowser(engine);
        page = await browser.newPage();
        await page.setViewport({ width: 1280, height: 800 });
        await navigateWithRetry(page, WIKIPEDIA_URL);
      });

      afterAll(async () => {
        if (browser) {
          await browser.close();
        }
      });

      it('downloads the Wikipedia page as Markdown', async () => {
        const html = await page.content();
        expect(html).toMatch(/<html/i);
        expect(html.length).toBeGreaterThan(1000);

        const markdown = convertHtmlToMarkdown(html, WIKIPEDIA_URL);

        // Markdown should carry the page's real content...
        expect(markdown).toContain('Wikipedia');
        expect(markdown.length).toBeGreaterThan(500);
        // ...and should contain markdown structure (headings and/or links)...
        expect(markdown).toMatch(/(^#{1,6}\s)|(\[.*?\]\(.*?\))/m);
        // ...but no longer be raw HTML document scaffolding.
        expect(markdown).not.toMatch(/<html/i);
        expect(markdown).not.toMatch(/<head[\s>]/i);
      });

      it('downloads the Wikipedia page as an image (PNG screenshot)', async () => {
        const screenshot = await page.screenshot({ type: 'png' });

        expect(screenshot).toBeInstanceOf(Buffer);
        expect(screenshot.length).toBeGreaterThan(1000);
        // Verify the PNG signature so we know it is a real image.
        expect(screenshot.slice(0, 8)).toEqual(PNG_SIGNATURE);
      });
    });
  }
);

describeIfLive('Wikipedia Page Download (engine parity)', () => {
  it('both engines download Markdown and an image for the Wikipedia page', async () => {
    const engines = ['puppeteer', 'playwright'];
    const results = [];

    for (const engine of engines) {
      const browser = await createBrowser(engine);
      try {
        const page = await browser.newPage();
        await page.setViewport({ width: 1280, height: 800 });
        await navigateWithRetry(page, WIKIPEDIA_URL);

        const html = await page.content();
        const markdown = convertHtmlToMarkdown(html, WIKIPEDIA_URL);
        const screenshot = await page.screenshot({ type: 'png' });

        results.push({ engine, markdown, screenshot });
      } finally {
        await browser.close();
      }
    }

    for (const { markdown, screenshot } of results) {
      // Markdown captured from both engines.
      expect(markdown).toContain('Wikipedia');
      expect(markdown.length).toBeGreaterThan(500);
      // Image captured from both engines.
      expect(screenshot.slice(0, 8)).toEqual(PNG_SIGNATURE);
      expect(screenshot.length).toBeGreaterThan(1000);
    }
  }, 180000);
});
