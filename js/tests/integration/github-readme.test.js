/**
 * Integration tests for capturing GitHub repository pages (issue #5).
 *
 * Live tests are gated behind GITHUB_REPOSITORY_INTEGRATION so default/offline
 * runs stay deterministic. The mocked API endpoint tests cover the default
 * behavior without network access; this suite proves the real GitHub repository
 * page can still be captured as compact text/markdown, original HTML, and PNG
 * screenshots in every supported JavaScript browser engine.
 */

import { jest } from '@jest/globals';
import { createBrowser } from '../../src/browser.js';
import { fetchHtml } from '../../src/lib.js';
import { retry } from '../../src/retry.js';
import {
  fetchGithubRepositorySnapshot,
  formatGithubRepositoryMarkdown,
  formatGithubRepositoryText,
  parseGithubRepositoryUrl,
} from '../../src/github.js';

const GITHUB_REPOSITORY_URL =
  process.env.GITHUB_REPOSITORY_URL ||
  'https://github.com/link-assistant/web-capture';
const PNG_SIGNATURE = Buffer.from([
  0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a,
]);

const SKIP_LIVE =
  !process.env.GITHUB_REPOSITORY_INTEGRATION ||
  process.env.GITHUB_REPOSITORY_INTEGRATION === 'false';
const describeIfLive = SKIP_LIVE ? describe.skip : describe;

jest.setTimeout(120000);

async function navigateWithRetry(page, url) {
  await retry(
    async () => {
      await page.goto(url, {
        waitUntil: 'domcontentloaded',
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
  await page.waitForTimeout(5000);
}

describeIfLive('GitHub repository capture', () => {
  it('downloads compact repository text and markdown with README plus file tree', async () => {
    const parsed = parseGithubRepositoryUrl(GITHUB_REPOSITORY_URL);
    expect(parsed).not.toBeNull();

    const snapshot = await retry(
      () => fetchGithubRepositorySnapshot(GITHUB_REPOSITORY_URL),
      {
        retries: 3,
        baseDelay: 2000,
      }
    );

    const text = formatGithubRepositoryText(snapshot);
    const markdown = formatGithubRepositoryMarkdown(snapshot);

    expect(text).toContain(`Repository: ${parsed.fullName}`);
    expect(text).toContain('Files:');
    expect(text).toMatch(/README/i);
    expect(text.length).toBeGreaterThan(500);

    expect(markdown).toContain(`# ${parsed.fullName}`);
    expect(markdown).toContain('## Files');
    expect(markdown).toMatch(/## .*README/i);
    expect(markdown.length).toBeGreaterThan(500);
    expect(markdown).not.toMatch(/<html/i);
  });

  it('downloads original GitHub repository HTML', async () => {
    const parsed = parseGithubRepositoryUrl(GITHUB_REPOSITORY_URL);
    expect(parsed).not.toBeNull();

    const html = await retry(() => fetchHtml(GITHUB_REPOSITORY_URL), {
      retries: 3,
      baseDelay: 2000,
    });

    expect(html).toMatch(/<html/i);
    expect(html).toContain(parsed.owner);
    expect(html).toContain(parsed.repo);
    expect(html.length).toBeGreaterThan(1000);
  });
});

describe.each(['puppeteer', 'playwright'])(
  'GitHub repository screenshot (%s engine)',
  (engine) => {
    describeIfLive(`${engine}`, () => {
      let browser;

      beforeAll(async () => {
        browser = await createBrowser(engine);
      });

      afterAll(async () => {
        if (browser) {
          await browser.close();
        }
      });

      it('captures the GitHub repository page as a PNG screenshot', async () => {
        const page = await browser.newPage();
        await page.setExtraHTTPHeaders({
          'Accept-Language': 'en-US,en;q=0.9',
          'Accept-Charset': 'utf-8',
        });
        await page.setUserAgent(
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
        );
        await page.setViewport({ width: 1280, height: 800 });
        await navigateWithRetry(page, GITHUB_REPOSITORY_URL);

        const screenshot = await page.screenshot({ type: 'png' });

        expect(screenshot).toBeInstanceOf(Buffer);
        expect(screenshot.length).toBeGreaterThan(1000);
        expect(screenshot.slice(0, 8)).toEqual(PNG_SIGNATURE);
      });
    });
  }
);
