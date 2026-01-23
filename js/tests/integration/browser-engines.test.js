import { createBrowser } from '../../src/browser.js';

describe('Browser Engine Integration Tests', () => {
  describe('Puppeteer Engine', () => {
    let browser;

    beforeEach(async () => {
      browser = await createBrowser('puppeteer');
    });

    afterEach(async () => {
      if (browser) {
        await browser.close();
      }
    });

    it('can navigate to a page and get content', async () => {
      const page = await browser.newPage();
      await page.goto('https://example.com', {
        waitUntil: 'networkidle0',
        timeout: 30000,
      });
      const content = await page.content();
      expect(content).toContain('Example Domain');
    }, 60000);

    it('can take a screenshot', async () => {
      const page = await browser.newPage();
      await page.setViewport({ width: 1280, height: 800 });
      await page.goto('https://example.com', {
        waitUntil: 'networkidle0',
        timeout: 30000,
      });
      const screenshot = await page.screenshot({ type: 'png' });
      expect(screenshot).toBeInstanceOf(Buffer);
      expect(screenshot.length).toBeGreaterThan(100);
    }, 60000);

    it('can set custom headers and user agent', async () => {
      const page = await browser.newPage();
      await page.setExtraHTTPHeaders({ 'Accept-Language': 'en-US' });
      await page.setUserAgent('Test User Agent');
      await page.goto('https://example.com', {
        waitUntil: 'networkidle0',
        timeout: 30000,
      });
      const content = await page.content();
      expect(content).toBeTruthy();
    }, 60000);
  });

  describe('Playwright Engine', () => {
    let browser;

    beforeEach(async () => {
      browser = await createBrowser('playwright');
    });

    afterEach(async () => {
      if (browser) {
        await browser.close();
      }
    });

    it('can navigate to a page and get content', async () => {
      const page = await browser.newPage();
      await page.goto('https://example.com', {
        waitUntil: 'networkidle0',
        timeout: 30000,
      });
      const content = await page.content();
      expect(content).toContain('Example Domain');
    }, 60000);

    it('can take a screenshot', async () => {
      const page = await browser.newPage();
      await page.setViewport({ width: 1280, height: 800 });
      await page.goto('https://example.com', {
        waitUntil: 'networkidle0',
        timeout: 30000,
      });
      const screenshot = await page.screenshot({ type: 'png' });
      expect(screenshot).toBeInstanceOf(Buffer);
      expect(screenshot.length).toBeGreaterThan(100);
    }, 60000);

    it('can set custom headers and user agent', async () => {
      const page = await browser.newPage();
      await page.setExtraHTTPHeaders({ 'Accept-Language': 'en-US' });
      await page.setUserAgent('Test User Agent');
      await page.goto('https://example.com', {
        waitUntil: 'networkidle0',
        timeout: 30000,
      });
      const content = await page.content();
      expect(content).toBeTruthy();
    }, 60000);
  });

  describe('Engine Parity', () => {
    it('both engines produce similar content for the same page', async () => {
      const puppeteerBrowser = await createBrowser('puppeteer');
      const playwrightBrowser = await createBrowser('playwright');

      const puppeteerPage = await puppeteerBrowser.newPage();
      const playwrightPage = await playwrightBrowser.newPage();

      await puppeteerPage.goto('https://example.com', {
        waitUntil: 'networkidle0',
        timeout: 30000,
      });
      await playwrightPage.goto('https://example.com', {
        waitUntil: 'networkidle0',
        timeout: 30000,
      });

      const puppeteerContent = await puppeteerPage.content();
      const playwrightContent = await playwrightPage.content();

      // Both should contain the main content
      expect(puppeteerContent).toContain('Example Domain');
      expect(playwrightContent).toContain('Example Domain');

      await puppeteerBrowser.close();
      await playwrightBrowser.close();
    }, 60000);
  });
});
