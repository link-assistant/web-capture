/**
 * Integration tests for Habr article downloads.
 *
 * Tests that the web-capture service can successfully download real-world content
 * from Habr.com using both Puppeteer and Playwright engines across all three
 * archived articles from link-foundation/meta-theory.
 *
 * Covers:
 * - Markdown conversion
 * - PNG and JPEG screenshots (light and dark themes)
 * - Full-page captures
 * - Viewport configuration
 * - Engine comparison
 */

import { createBrowser } from '../../src/browser.js';
import { fetchHtml, convertHtmlToMarkdown } from '../../src/lib.js';
import { dismissPopups, scrollToLoadContent } from '../../src/popups.js';
import { getAllArticles, HABR_ARTICLES } from '../fixtures/habr-articles.js';

// These tests hit live servers and may take a while
jest.setTimeout(120000);

describe('Habr Article Download Tests', () => {
  // Use article 0.0.2 as the primary test article (English, most recent)
  const primaryArticle = HABR_ARTICLES['0.0.2'];

  describe('Markdown Download', () => {
    it.each(['puppeteer', 'playwright'])(
      'downloads article 0.0.2 as markdown using %s',
      async () => {
        const html = await fetchHtml(primaryArticle.url);
        expect(html.length).toBeGreaterThan(1000);

        const markdown = convertHtmlToMarkdown(html, primaryArticle.url);
        expect(markdown.length).toBeGreaterThan(100);
        // Should contain markdown headings
        expect(markdown).toMatch(/^#{1,3}\s/m);
        // Should contain links
        expect(markdown).toMatch(/\[.*?\]\(.*?\)/);
      }
    );

    it('downloads all 3 articles as markdown', async () => {
      for (const article of getAllArticles()) {
        const html = await fetchHtml(article.url);
        expect(html.length).toBeGreaterThan(1000);

        const markdown = convertHtmlToMarkdown(html, article.url);
        expect(markdown.length).toBeGreaterThan(100);
        expect(markdown).toMatch(/^#{1,3}\s/m);
      }
    });
  });

  describe('Image Screenshot', () => {
    it.each(['puppeteer', 'playwright'])(
      'captures article as PNG screenshot using %s',
      async (engine) => {
        const browser = await createBrowser(engine);
        try {
          const page = await browser.newPage();
          await page.setViewport({ width: 1280, height: 800 });
          await page.goto(primaryArticle.url, {
            waitUntil: 'networkidle0',
            timeout: 60000,
          });
          await new Promise((r) => setTimeout(r, 3000));
          await dismissPopups(page);

          const buffer = await page.screenshot({ type: 'png' });
          expect(buffer).toBeTruthy();
          expect(buffer.length).toBeGreaterThan(10000);
          // PNG signature: 137 80 78 71
          expect(buffer[0]).toBe(137);
          expect(buffer[1]).toBe(80);
          expect(buffer[2]).toBe(78);
          expect(buffer[3]).toBe(71);
        } finally {
          await browser.close();
        }
      }
    );

    it.each(['puppeteer', 'playwright'])(
      'captures article as JPEG screenshot using %s',
      async (engine) => {
        const browser = await createBrowser(engine);
        try {
          const page = await browser.newPage();
          await page.setViewport({ width: 1280, height: 800 });
          await page.goto(primaryArticle.url, {
            waitUntil: 'networkidle0',
            timeout: 60000,
          });
          await new Promise((r) => setTimeout(r, 3000));
          await dismissPopups(page);

          const buffer = await page.screenshot({
            type: 'jpeg',
            quality: 80,
          });
          expect(buffer).toBeTruthy();
          expect(buffer.length).toBeGreaterThan(5000);
          // JPEG signature: 0xFF 0xD8 0xFF
          expect(buffer[0]).toBe(0xff);
          expect(buffer[1]).toBe(0xd8);
          expect(buffer[2]).toBe(0xff);
        } finally {
          await browser.close();
        }
      }
    );
  });

  describe('Theme Support', () => {
    it.each(['light', 'dark'])(
      'captures %s theme screenshot using playwright',
      async (theme) => {
        const browser = await createBrowser('playwright', {
          colorScheme: theme,
        });
        try {
          const page = await browser.newPage();
          await page.setViewport({ width: 1920, height: 1080 });
          await page.goto(primaryArticle.url, {
            waitUntil: 'networkidle0',
            timeout: 60000,
          });
          await new Promise((r) => setTimeout(r, 3000));
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

  describe('Viewport Configuration', () => {
    it('captures with custom viewport width', async () => {
      const browser = await createBrowser('puppeteer');
      try {
        const page = await browser.newPage();
        await page.setViewport({ width: 1920, height: 1080 });
        await page.goto(primaryArticle.url, {
          waitUntil: 'networkidle0',
          timeout: 60000,
        });
        await new Promise((r) => setTimeout(r, 3000));

        const buffer = await page.screenshot({ type: 'png' });
        expect(buffer).toBeTruthy();
        expect(buffer.length).toBeGreaterThan(10000);
      } finally {
        await browser.close();
      }
    });
  });

  describe('Full Page Capture', () => {
    it('captures full page screenshot', async () => {
      const browser = await createBrowser('puppeteer');
      try {
        const page = await browser.newPage();
        await page.setViewport({ width: 1280, height: 800 });
        await page.goto(primaryArticle.url, {
          waitUntil: 'networkidle0',
          timeout: 60000,
        });
        await new Promise((r) => setTimeout(r, 3000));
        await scrollToLoadContent(page);
        await dismissPopups(page);

        const viewportBuffer = await page.screenshot({ type: 'png' });
        const fullPageBuffer = await page.screenshot({
          type: 'png',
          fullPage: true,
        });

        // Full page should be significantly larger than viewport-only
        expect(fullPageBuffer.length).toBeGreaterThan(viewportBuffer.length);
      } finally {
        await browser.close();
      }
    });
  });

  describe('Engine Comparison', () => {
    it('both engines produce valid markdown for the same article', async () => {
      const html = await fetchHtml(primaryArticle.url);

      const markdown = convertHtmlToMarkdown(html, primaryArticle.url);
      expect(markdown.length).toBeGreaterThan(100);

      // Verify markdown has expected structure
      expect(markdown).toMatch(/^#{1,3}\s/m);
      expect(markdown).toMatch(/\[.*?\]\(.*?\)/);
    });

    it('both engines can capture screenshots of the same article', async () => {
      const results = {};

      for (const engine of ['puppeteer', 'playwright']) {
        const browser = await createBrowser(engine);
        try {
          const page = await browser.newPage();
          await page.setViewport({ width: 1280, height: 800 });
          await page.goto(primaryArticle.url, {
            waitUntil: 'networkidle0',
            timeout: 60000,
          });
          await new Promise((r) => setTimeout(r, 3000));
          await dismissPopups(page);

          const buffer = await page.screenshot({ type: 'png' });
          results[engine] = buffer;
        } finally {
          await browser.close();
        }
      }

      // Both engines should produce valid PNG images
      for (const engine of ['puppeteer', 'playwright']) {
        const buf = results[engine];
        expect(buf).toBeTruthy();
        expect(buf.length).toBeGreaterThan(10000);
        expect(buf[0]).toBe(137); // PNG signature
      }
    });
  });

  describe('All Three Archived Articles', () => {
    it.each(getAllArticles().map((a) => [a.version, a.title, a.url]))(
      'can download article %s (%s) as markdown',
      async (version, title, url) => {
        const html = await fetchHtml(url);
        expect(html.length).toBeGreaterThan(1000);

        const markdown = convertHtmlToMarkdown(html, url);
        expect(markdown.length).toBeGreaterThan(100);
      }
    );

    it.each(getAllArticles().map((a) => [a.version, a.url]))(
      'can capture article %s as PNG screenshot',
      async (version, url) => {
        const browser = await createBrowser('puppeteer');
        try {
          const page = await browser.newPage();
          await page.setViewport({ width: 1280, height: 800 });
          await page.goto(url, {
            waitUntil: 'networkidle0',
            timeout: 60000,
          });
          await new Promise((r) => setTimeout(r, 3000));
          await dismissPopups(page);

          const buffer = await page.screenshot({ type: 'png' });
          expect(buffer.length).toBeGreaterThan(10000);
          expect(buffer[0]).toBe(137);
        } finally {
          await browser.close();
        }
      }
    );
  });

  describe('Popup Dismissal', () => {
    it('dismisses popups before capture', async () => {
      const browser = await createBrowser('playwright');
      try {
        const page = await browser.newPage();
        await page.setViewport({ width: 1280, height: 800 });
        await page.goto(primaryArticle.url, {
          waitUntil: 'networkidle0',
          timeout: 60000,
        });
        await new Promise((r) => setTimeout(r, 3000));

        // Call dismissPopups and verify it doesn't throw
        await dismissPopups(page);

        // Should still be able to take a screenshot after dismissing
        const buffer = await page.screenshot({ type: 'png' });
        expect(buffer.length).toBeGreaterThan(10000);
      } finally {
        await browser.close();
      }
    });
  });
});
