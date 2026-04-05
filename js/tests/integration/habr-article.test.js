/**
 * Integration tests for Habr article downloads.
 *
 * Tests that the web-capture service can successfully download real-world content
 * from Habr.com using both Puppeteer and Playwright engines across all three
 * archived articles from link-foundation/meta-theory.
 *
 * These tests hit live servers. Set HABR_INTEGRATION=true to run them.
 * In CI they are enabled via the workflow environment variable.
 *
 * Tests use retry with exponential backoff to handle transient network failures.
 * Browser instances are shared within describe blocks to reduce startup overhead.
 *
 * Covers:
 * - Markdown conversion (fast, no browser needed)
 * - PNG and JPEG screenshots (light and dark themes)
 * - Full-page captures
 * - Viewport configuration
 * - Engine comparison
 * - Archive endpoint with documentFormat option (html/markdown)
 */

import { jest } from '@jest/globals';
import request from 'supertest';
import { app } from '../../src/index.js';
import { createBrowser } from '../../src/browser.js';
import { fetchHtml, convertHtmlToMarkdown } from '../../src/lib.js';
import { dismissPopups, scrollToLoadContent } from '../../src/popups.js';
import { retry } from '../../src/retry.js';
import { getAllArticles, HABR_ARTICLES } from '../fixtures/habr-articles.js';

const SKIP_LIVE =
  !process.env.HABR_INTEGRATION || process.env.HABR_INTEGRATION === 'false';
const describeIfLive = SKIP_LIVE ? describe.skip : describe;

// These tests hit live servers and may take a while
jest.setTimeout(120000);

// Helper: navigate to URL with retry and exponential backoff
async function navigateWithRetry(page, url) {
  await retry(
    async () => {
      await page.goto(url, {
        waitUntil: 'networkidle0',
        timeout: 30000,
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
  // Wait for dynamic content
  await new Promise((r) => setTimeout(r, 2000));
}

describe('Habr Article Download Tests', () => {
  // Use article 0.0.2 as the primary test article (English, most recent)
  const primaryArticle = HABR_ARTICLES['0.0.2'];

  describeIfLive('Markdown Download (fetch only)', () => {
    it('downloads article 0.0.2 as markdown', async () => {
      const html = await retry(() => fetchHtml(primaryArticle.url), {
        retries: 3,
        baseDelay: 2000,
      });
      expect(html.length).toBeGreaterThan(1000);

      const markdown = convertHtmlToMarkdown(html, primaryArticle.url);
      expect(markdown.length).toBeGreaterThan(100);
      // Should contain markdown headings
      expect(markdown).toMatch(/^#{1,3}\s/m);
      // Should contain links
      expect(markdown).toMatch(/\[.*?\]\(.*?\)/);
    });

    it('downloads all 3 articles as markdown', async () => {
      for (const article of getAllArticles()) {
        const html = await retry(() => fetchHtml(article.url), {
          retries: 3,
          baseDelay: 2000,
        });
        expect(html.length).toBeGreaterThan(1000);

        const markdown = convertHtmlToMarkdown(html, article.url);
        expect(markdown.length).toBeGreaterThan(100);
        expect(markdown).toMatch(/^#{1,3}\s/m);
      }
    });
  });

  describeIfLive('Screenshots with Puppeteer', () => {
    let browser;
    let page;

    beforeAll(async () => {
      browser = await createBrowser('puppeteer');
      page = await browser.newPage();
      await page.setViewport({ width: 1280, height: 800 });
      await navigateWithRetry(page, primaryArticle.url);
      await dismissPopups(page);
    });

    afterAll(async () => {
      if (browser) {
        await browser.close();
      }
    });

    it('captures article as PNG screenshot', async () => {
      const buffer = await page.screenshot({ type: 'png' });
      expect(buffer).toBeTruthy();
      expect(buffer.length).toBeGreaterThan(10000);
      // PNG signature: 137 80 78 71
      expect(buffer[0]).toBe(137);
      expect(buffer[1]).toBe(80);
      expect(buffer[2]).toBe(78);
      expect(buffer[3]).toBe(71);
    });

    it('captures article as JPEG screenshot', async () => {
      const buffer = await page.screenshot({ type: 'jpeg', quality: 80 });
      expect(buffer).toBeTruthy();
      expect(buffer.length).toBeGreaterThan(5000);
      // JPEG signature: 0xFF 0xD8 0xFF
      expect(buffer[0]).toBe(0xff);
      expect(buffer[1]).toBe(0xd8);
      expect(buffer[2]).toBe(0xff);
    });

    it('captures full page screenshot', async () => {
      await scrollToLoadContent(page);

      const viewportBuffer = await page.screenshot({ type: 'png' });
      const fullPageBuffer = await page.screenshot({
        type: 'png',
        fullPage: true,
      });

      // Full page should be significantly larger than viewport-only
      expect(fullPageBuffer.length).toBeGreaterThan(viewportBuffer.length);
    });

    it('captures with custom viewport width (1920px)', async () => {
      await page.setViewport({ width: 1920, height: 1080 });
      const buffer = await page.screenshot({ type: 'png' });
      expect(buffer).toBeTruthy();
      expect(buffer.length).toBeGreaterThan(10000);
      // Restore original viewport
      await page.setViewport({ width: 1280, height: 800 });
    });
  });

  describeIfLive('Screenshots with Playwright', () => {
    let browser;
    let page;

    beforeAll(async () => {
      browser = await createBrowser('playwright');
      page = await browser.newPage();
      await page.setViewport({ width: 1280, height: 800 });
      await navigateWithRetry(page, primaryArticle.url);
      await dismissPopups(page);
    });

    afterAll(async () => {
      if (browser) {
        await browser.close();
      }
    });

    it('captures article as PNG screenshot', async () => {
      const buffer = await page.screenshot({ type: 'png' });
      expect(buffer).toBeTruthy();
      expect(buffer.length).toBeGreaterThan(10000);
      expect(buffer[0]).toBe(137);
    });

    it('captures article as JPEG screenshot', async () => {
      const buffer = await page.screenshot({ type: 'jpeg', quality: 80 });
      expect(buffer).toBeTruthy();
      expect(buffer.length).toBeGreaterThan(5000);
      expect(buffer[0]).toBe(0xff);
      expect(buffer[1]).toBe(0xd8);
    });
  });

  describeIfLive('Theme Support (Playwright)', () => {
    it.each(['light', 'dark'])(
      'captures %s theme screenshot',
      async (theme) => {
        const browser = await createBrowser('playwright', {
          colorScheme: theme,
        });
        try {
          const page = await browser.newPage();
          await page.setViewport({ width: 1280, height: 800 });
          await navigateWithRetry(page, primaryArticle.url);
          await scrollToLoadContent(page);
          await dismissPopups(page);

          const buffer = await page.screenshot({
            type: 'png',
            fullPage: true,
          });
          expect(buffer).toBeTruthy();
          expect(buffer.length).toBeGreaterThan(50000);
        } finally {
          await browser.close();
        }
      }
    );
  });

  describeIfLive('All Three Articles (Puppeteer)', () => {
    let browser;

    beforeAll(async () => {
      browser = await createBrowser('puppeteer');
    });

    afterAll(async () => {
      if (browser) {
        await browser.close();
      }
    });

    it.each(getAllArticles().map((a) => [a.version, a.url]))(
      'captures article %s as PNG screenshot',
      async (version, url) => {
        const page = await browser.newPage();
        try {
          await page.setViewport({ width: 1280, height: 800 });
          await navigateWithRetry(page, url);
          await dismissPopups(page);

          const buffer = await page.screenshot({ type: 'png' });
          expect(buffer.length).toBeGreaterThan(10000);
          expect(buffer[0]).toBe(137);
        } finally {
          await page.close();
        }
      }
    );
  });

  describeIfLive('Popup Dismissal (Playwright)', () => {
    it('dismisses popups before capture', async () => {
      const browser = await createBrowser('playwright');
      try {
        const page = await browser.newPage();
        await page.setViewport({ width: 1280, height: 800 });
        await navigateWithRetry(page, primaryArticle.url);

        await dismissPopups(page);

        const buffer = await page.screenshot({ type: 'png' });
        expect(buffer.length).toBeGreaterThan(10000);
      } finally {
        await browser.close();
      }
    });
  });

  describeIfLive('Archive Endpoint (live)', () => {
    it('creates markdown archive of article', async () => {
      const res = await retry(
        async () => {
          const r = await request(app)
            .get('/archive')
            .query({
              url: primaryArticle.url,
              localImages: 'false',
              documentFormat: 'markdown',
            })
            .buffer(true)
            .parse((res, callback) => {
              const chunks = [];
              res.on('data', (chunk) => chunks.push(chunk));
              res.on('end', () => callback(null, Buffer.concat(chunks)));
            })
            .timeout({ response: 30000 });
          if (r.status !== 200) {
            throw new Error(`Archive returned status ${r.status}`);
          }
          return r;
        },
        { retries: 2, baseDelay: 3000 }
      );

      expect(res.body).toBeInstanceOf(Buffer);
      expect(res.body.length).toBeGreaterThan(50);
      // ZIP signature: PK (0x50 0x4B)
      expect(res.body[0]).toBe(0x50);
      expect(res.body[1]).toBe(0x4b);
    });

    it('creates HTML archive of article', async () => {
      const res = await retry(
        async () => {
          const r = await request(app)
            .get('/archive')
            .query({
              url: primaryArticle.url,
              localImages: 'false',
              documentFormat: 'html',
            })
            .buffer(true)
            .parse((res, callback) => {
              const chunks = [];
              res.on('data', (chunk) => chunks.push(chunk));
              res.on('end', () => callback(null, Buffer.concat(chunks)));
            })
            .timeout({ response: 30000 });
          if (r.status !== 200) {
            throw new Error(`Archive returned status ${r.status}`);
          }
          return r;
        },
        { retries: 2, baseDelay: 3000 }
      );

      expect(res.body).toBeInstanceOf(Buffer);
      expect(res.body.length).toBeGreaterThan(50);
      // ZIP signature
      expect(res.body[0]).toBe(0x50);
      expect(res.body[1]).toBe(0x4b);
    });
  });
});
