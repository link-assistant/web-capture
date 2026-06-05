import { jest } from '@jest/globals';
import nock from 'nock';
import request from 'supertest';
import { URL, fileURLToPath } from 'url';

const DEEPWIKI_URL =
  'https://deepwiki.com/search/-57-4-23-57_0e4aa687-7a9d-4591-8c6f-67c4b2d732f6';
const deepwikiShellHtml = `<!doctype html>
<html lang="en">
  <head>
    <title>Search | DeepWiki</title>
    <script src="/_next/static/chunks/app.js"></script>
    <script>self.__next_f = []; self.__next_f.push([1, "shell"])</script>
  </head>
  <body><div id="__next"></div></body>
</html>`;
const renderedDeepwikiHtml = `<!doctype html>
<html lang="en">
  <head><title>Search | DeepWiki</title></head>
  <body>
    <main>
      <p>deep-assistant/hive-mind</p>
      <p>расскажи пожалуйста на английском</p>
      <h1>Hive Mind: A Comprehensive Overview of an AI Agent System for Software Development</h1>
      <h2>Executive Summary</h2>
      <p>Deep analysis of the issue-solver workflow.</p>
      <h2>Thought Process</h2>
      <pre><code>const clarifyPrompt = \`Task: "\${taskDescription}"\`;
await solver.run(clarifyPrompt);</code></pre>
    </main>
  </body>
</html>`;

const fakePage = {
  type: 'playwright',
  rawPage: {
    evaluate: jest
      .fn()
      .mockRejectedValueOnce(
        new Error(
          'Execution context was destroyed, most likely because of a navigation'
        )
      )
      .mockResolvedValue(
        renderedDeepwikiHtml.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ')
          .length
      ),
  },
  setViewport: jest.fn(async () => {}),
  setExtraHTTPHeaders: jest.fn(async () => {}),
  setUserAgent: jest.fn(async () => {}),
  goto: jest.fn(async () => {}),
  waitForTimeout: jest.fn(
    (ms) => new Promise((resolve) => setTimeout(resolve, ms))
  ),
  content: jest.fn(async () => renderedDeepwikiHtml),
};
const fakeBrowser = {
  newPage: jest.fn(async () => fakePage),
  close: jest.fn(async () => {}),
};
const createBrowser = jest.fn(async () => fakeBrowser);
const browserModulePath = fileURLToPath(
  new URL('../../src/browser.js', import.meta.url)
);

jest.unstable_mockModule(browserModulePath, () => ({
  createBrowser,
  getBrowserEngine: (req) => req.query.engine || 'puppeteer',
}));

const { app } = await import('../../src/index.js');

describe('DeepWiki rendered markdown endpoint behavior', () => {
  beforeEach(() => {
    nock.cleanAll();
    jest.clearAllMocks();
  });

  afterEach(() => {
    nock.cleanAll();
  });

  it('converts browser-rendered content when the initial fetch is a Next.js shell', async () => {
    nock('https://deepwiki.com')
      .get('/search/-57-4-23-57_0e4aa687-7a9d-4591-8c6f-67c4b2d732f6')
      .reply(200, deepwikiShellHtml);

    const response = await request(app)
      .get('/markdown')
      .query({ url: DEEPWIKI_URL, engine: 'playwright' })
      .expect(200);

    expect(createBrowser).toHaveBeenCalledWith(
      'playwright',
      expect.objectContaining({
        args: expect.arrayContaining([
          expect.stringContaining('--user-agent='),
          '--window-size=1280,800',
          '--disable-blink-features=AutomationControlled',
        ]),
      })
    );
    expect(fakePage.goto).toHaveBeenCalledWith(
      DEEPWIKI_URL,
      expect.objectContaining({ waitUntil: 'networkidle0' })
    );
    expect(fakeBrowser.close).toHaveBeenCalledTimes(1);
    expect(response.headers['content-type']).toMatch(/text\/markdown/);
    expect(response.text).toContain('Search | DeepWiki');
    expect(response.text).toContain('deep-assistant/hive-mind');
    expect(response.text).toContain('расскажи пожалуйста на английском');
    expect(response.text).toContain(
      '# Hive Mind: A Comprehensive Overview of an AI Agent System for Software Development'
    );
    expect(response.text).toContain('## Thought Process');
    expect(response.text).toContain('```');
    expect(response.text).toContain('const clarifyPrompt');
    expect(response.text).not.toContain('__next_f');
  });
});
