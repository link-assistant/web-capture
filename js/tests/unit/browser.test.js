import { createBrowser, getBrowserEngine } from '../../src/browser.js';

describe('Browser Abstraction Layer', () => {
  describe('getBrowserEngine', () => {
    it('returns puppeteer by default', () => {
      const req = { query: {} };
      expect(getBrowserEngine(req)).toBe('puppeteer');
    });

    it('returns playwright when engine=playwright query param is provided', () => {
      const req = { query: { engine: 'playwright' } };
      expect(getBrowserEngine(req)).toBe('playwright');
    });

    it('returns playwright when engine=pw query param is provided', () => {
      const req = { query: { engine: 'pw' } };
      expect(getBrowserEngine(req)).toBe('playwright');
    });

    it('returns puppeteer when engine=puppeteer query param is provided', () => {
      const req = { query: { engine: 'puppeteer' } };
      expect(getBrowserEngine(req)).toBe('puppeteer');
    });

    it('returns puppeteer when engine=pptr query param is provided', () => {
      const req = { query: { engine: 'pptr' } };
      expect(getBrowserEngine(req)).toBe('puppeteer');
    });

    it('returns playwright when browser=playwright query param is provided', () => {
      const req = { query: { browser: 'playwright' } };
      expect(getBrowserEngine(req)).toBe('playwright');
    });

    it('is case insensitive', () => {
      const req1 = { query: { engine: 'PLAYWRIGHT' } };
      const req2 = { query: { engine: 'PlAyWrIgHt' } };
      expect(getBrowserEngine(req1)).toBe('playwright');
      expect(getBrowserEngine(req2)).toBe('playwright');
    });

    it('returns playwright from BROWSER_ENGINE env var', () => {
      const originalEnv = process.env.BROWSER_ENGINE;
      process.env.BROWSER_ENGINE = 'playwright';
      const req = { query: {} };
      expect(getBrowserEngine(req)).toBe('playwright');
      if (originalEnv) {
        process.env.BROWSER_ENGINE = originalEnv;
      } else {
        delete process.env.BROWSER_ENGINE;
      }
    });

    it('prefers query param over env var', () => {
      const originalEnv = process.env.BROWSER_ENGINE;
      process.env.BROWSER_ENGINE = 'playwright';
      const req = { query: { engine: 'puppeteer' } };
      expect(getBrowserEngine(req)).toBe('puppeteer');
      if (originalEnv) {
        process.env.BROWSER_ENGINE = originalEnv;
      } else {
        delete process.env.BROWSER_ENGINE;
      }
    });
  });

  describe('createBrowser - Puppeteer', () => {
    it('creates a puppeteer browser with type field', async () => {
      const browser = await createBrowser('puppeteer');
      expect(browser.type).toBe('puppeteer');
      expect(browser.newPage).toBeDefined();
      expect(browser.close).toBeDefined();
      await browser.close();
    });

    it('can create and use a page', async () => {
      const browser = await createBrowser('puppeteer');
      const page = await browser.newPage();
      expect(page.setViewport).toBeDefined();
      expect(page.goto).toBeDefined();
      expect(page.content).toBeDefined();
      expect(page.screenshot).toBeDefined();
      expect(page._type).toBe('puppeteer');
      await browser.close();
    });
  });

  describe('createBrowser - Playwright', () => {
    it('creates a playwright browser with type field', async () => {
      const browser = await createBrowser('playwright');
      expect(browser.type).toBe('playwright');
      expect(browser.newPage).toBeDefined();
      expect(browser.close).toBeDefined();
      await browser.close();
    });

    it('can create and use a page', async () => {
      const browser = await createBrowser('playwright');
      const page = await browser.newPage();
      expect(page.setViewport).toBeDefined();
      expect(page.goto).toBeDefined();
      expect(page.content).toBeDefined();
      expect(page.screenshot).toBeDefined();
      expect(page._type).toBe('playwright');
      await browser.close();
    });
  });

  describe('Page Adapter Compatibility', () => {
    it('both adapters support the same interface', async () => {
      const puppeteerBrowser = await createBrowser('puppeteer');
      const playwrightBrowser = await createBrowser('playwright');

      const puppeteerPage = await puppeteerBrowser.newPage();
      const playwrightPage = await playwrightBrowser.newPage();

      // Check that both have the same methods
      const methods = [
        'setExtraHTTPHeaders',
        'setUserAgent',
        'setViewport',
        'goto',
        'content',
        'screenshot',
        'close',
      ];
      for (const method of methods) {
        expect(puppeteerPage[method]).toBeDefined();
        expect(playwrightPage[method]).toBeDefined();
      }

      await puppeteerBrowser.close();
      await playwrightBrowser.close();
    });
  });
});
