import {
  appendTextPasteMarkdownAttachment,
  fetchHtml,
  convertHtmlToMarkdownEnhanced,
  getTextPasteId,
  isTextPasteUrl,
  normalizeUrlForTextContent,
  normalizeUrlForTextPage,
  scopeHtmlForMarkdown,
} from './lib.js';
import {
  fetchGithubRepositorySnapshot,
  formatGithubRepositoryMarkdown,
  isGithubRepositoryUrl,
} from './github.js';
import { convertWithKreuzberg, isKreuzbergAvailable } from './kreuzberg.js';
import { applyImageMode } from './extract-images.js';
import { createBrowser, getBrowserEngine } from './browser.js';
import { retry } from './retry.js';
import archiver from 'archiver';
import fetch from 'node-fetch';
import * as cheerio from 'cheerio';

const INLINE_MARKDOWN_LINE_LIMIT = 1500;
const RENDERED_PAGE_SETTLE_TIMEOUT_MS = 5000;
const RENDERED_PAGE_STABLE_FOR_MS = 1000;
const RENDERED_PAGE_POLL_MS = 250;
const RENDERED_PAGE_MIN_TEXT_LENGTH = 200;
const DESKTOP_USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

export async function markdownHandler(req, res) {
  const url = req.query.url;
  if (!url) {
    return res.status(400).send('Missing `url` parameter');
  }

  const converter = (req.query.converter || 'turndown').toLowerCase();
  const format = (req.query.format || 'text').toLowerCase();
  const embedImages = req.query.embedImages === 'true';

  if (!['turndown', 'kreuzberg'].includes(converter)) {
    return res.status(400).send('Unsupported `converter` parameter');
  }
  if (!['text', 'json'].includes(format)) {
    return res.status(400).send('Unsupported `format` parameter');
  }
  if (format === 'json' && converter !== 'kreuzberg') {
    return res
      .status(400)
      .send('`format=json` is only supported with `converter=kreuzberg`');
  }

  try {
    const pageUrl = ensureAbsoluteUrl(normalizeUrlForTextPage(url));
    if (
      format === 'text' &&
      !req.query.contentSelector &&
      !req.query.bodySelector &&
      isGithubRepositoryUrl(pageUrl)
    ) {
      const snapshot = await fetchGithubRepositorySnapshot(pageUrl);
      let markdown = formatGithubRepositoryMarkdown(snapshot);
      const result = await applyImageMode(markdown, {
        mode: embedImages ? 'embed' : 'default',
      });
      markdown = result.markdown;
      return await sendMarkdownResponse(res, pageUrl, markdown);
    }

    const html = await fetchMarkdownHtml(req, pageUrl);

    if (converter === 'kreuzberg') {
      const available = await isKreuzbergAvailable();
      if (!available) {
        return res
          .status(501)
          .send(
            'Kreuzberg converter not available. Install @kreuzberg/html-to-markdown-node.'
          );
      }

      const scopedHtml = scopeHtmlForMarkdown(html, {
        contentSelector: req.query.contentSelector,
        bodySelector: req.query.bodySelector,
      });
      const result = await convertWithKreuzberg(scopedHtml, {
        baseUrl: pageUrl,
      });
      const imageResult = await applyImageMode(result.content, {
        mode: embedImages ? 'embed' : 'default',
      });
      result.content = imageResult.markdown;

      if (format === 'json') {
        return res.json(result);
      }
      return await sendMarkdownResponse(res, pageUrl, result.content);
    }

    let { markdown } = convertHtmlToMarkdownEnhanced(html, pageUrl, {
      contentSelector: req.query.contentSelector,
      bodySelector: req.query.bodySelector,
    });
    // Route through the single image-mode chokepoint so the server honors the
    // same contract as the CLI: default keeps remote links and strips inline
    // base64; ?embedImages=true keeps base64 inline. See issue #112.
    const result = await applyImageMode(markdown, {
      mode: embedImages ? 'embed' : 'default',
    });
    markdown = result.markdown;
    return await sendMarkdownResponse(res, pageUrl, markdown);
  } catch (err) {
    console.error(err);
    res.status(500).send('Error converting to Markdown');
  }
}

function ensureAbsoluteUrl(url) {
  return /^https?:\/\//i.test(url) ? url : `https://${url}`;
}

async function fetchMarkdownHtml(req, pageUrl) {
  const html = await fetchHtml(pageUrl);
  if (!shouldRenderHtmlWithBrowser(html)) {
    return html;
  }
  return await renderHtmlWithBrowser(req, pageUrl);
}

export function shouldRenderHtmlWithBrowser(html) {
  const isCompleteHtml = /<html[\s>][\s\S]*<\/html>/i.test(html);
  if (!isCompleteHtml) {
    return true;
  }

  if (!hasClientRenderedAppMarkers(html)) {
    return false;
  }

  return getStaticBodyTextLength(html) < RENDERED_PAGE_MIN_TEXT_LENGTH;
}

function hasClientRenderedAppMarkers(html) {
  return /(?:__NEXT_DATA__|self\.__next_f|\/_next\/static|id=["']__(?:next|nuxt)["']|id=["']root["']|window\.__NUXT__|ng-version=|\/@vite\/client)/i.test(
    html
  );
}

function getStaticBodyTextLength(html) {
  const $ = cheerio.load(html);
  $('script, style, noscript, template').remove();
  return $('body').text().replace(/\s+/g, ' ').trim().length;
}

async function renderHtmlWithBrowser(req, pageUrl) {
  const engine = getBrowserEngine(req);
  const browser = await createBrowser(engine, {
    args: [
      `--user-agent=${DESKTOP_USER_AGENT}`,
      '--window-size=1280,800',
      '--disable-blink-features=AutomationControlled',
    ],
  });
  try {
    const page = await browser.newPage();
    await prepareRenderedPage(page);
    await navigateRenderedPage(page, pageUrl);
    await waitForRenderedPageToSettle(page);
    return await page.content();
  } finally {
    await browser.close();
  }
}

async function prepareRenderedPage(page) {
  await page.setViewport({ width: 1280, height: 800 });
  if (page.type === 'playwright') {
    await page.setExtraHTTPHeaders({
      'Accept-Language': 'en-US,en;q=0.9',
      'Accept-Charset': 'utf-8',
      'User-Agent': DESKTOP_USER_AGENT,
    });
    return;
  }

  await page.setExtraHTTPHeaders({
    'Accept-Language': 'en-US,en;q=0.9',
    'Accept-Charset': 'utf-8',
  });
  await page.setUserAgent(DESKTOP_USER_AGENT);
}

async function navigateRenderedPage(page, pageUrl) {
  await retry(
    async () => {
      try {
        await page.goto(pageUrl, {
          waitUntil: 'networkidle0',
          timeout: 60000,
        });
      } catch (err) {
        if (!/timeout/i.test(err.message || '')) {
          throw err;
        }
        await page.goto(pageUrl, {
          waitUntil: 'domcontentloaded',
          timeout: 60000,
        });
      }
    },
    {
      retries: 2,
      baseDelay: 2000,
      onRetry: (err, attempt, delay) => {
        console.log(
          `Rendered markdown navigation retry ${attempt} for ${pageUrl} after ${delay}ms: ${err.message}`
        );
      },
    }
  );
}

async function waitForRenderedPageToSettle(page) {
  const deadline = Date.now() + RENDERED_PAGE_SETTLE_TIMEOUT_MS;
  let lastTextLength = -1;
  let stableSince = 0;

  while (Date.now() < deadline) {
    let textLength;
    try {
      textLength = await getBodyTextLength(page);
    } catch (err) {
      if (!isTransientPageEvaluationError(err)) {
        throw err;
      }
      lastTextLength = -1;
      stableSince = 0;
      await page.waitForTimeout(RENDERED_PAGE_POLL_MS);
      continue;
    }
    const now = Date.now();
    if (
      textLength === lastTextLength &&
      textLength >= RENDERED_PAGE_MIN_TEXT_LENGTH
    ) {
      if (!stableSince) {
        stableSince = now;
      }
      if (now - stableSince >= RENDERED_PAGE_STABLE_FOR_MS) {
        return;
      }
    } else {
      lastTextLength = textLength;
      stableSince = now;
    }
    await page.waitForTimeout(RENDERED_PAGE_POLL_MS);
  }
}

async function getBodyTextLength(page) {
  const rawPage = page.rawPage || page;
  return await rawPage.evaluate(() => {
    // eslint-disable-next-line no-undef
    const text = document.body?.innerText || '';
    return text.trim().length;
  });
}

function isTransientPageEvaluationError(err) {
  return /execution context was destroyed|context was destroyed|cannot find context/i.test(
    err.message || ''
  );
}

async function sendMarkdownResponse(res, url, markdown) {
  if (!isTextPasteUrl(url)) {
    return res.type('text/markdown').send(markdown);
  }

  const rawText = await fetchRawText(url);
  const markdownWithText = appendTextPasteMarkdownAttachment(
    markdown,
    url,
    rawText
  );
  if (markdownWithText.split('\n').length >= INLINE_MARKDOWN_LINE_LIMIT) {
    return await sendTextPasteMarkdownArchive(res, url, markdown, rawText);
  }

  return res.type('text/markdown').send(markdownWithText);
}

async function sendTextPasteMarkdownArchive(res, url, markdown, rawText) {
  const pasteId = getTextPasteId(url) || 'paste';
  const markdownFilename = `xpaste-pro-${pasteId}.md`;
  const textFilename = `xpaste-pro-${pasteId}.txt`;
  const lineCount = markdown.split('\n').length;

  res.setHeader('Content-Type', 'application/zip');
  res.setHeader('Content-Disposition', `attachment; filename="${pasteId}.zip"`);

  const archive = archiver('zip', { zlib: { level: 9 } });
  archive.pipe(res);
  archive.append(
    [
      `# ${url}`,
      '',
      `Content from: ${url}`,
      '',
      `The page markdown is available in [${markdownFilename}](${markdownFilename}) (${lineCount} lines).`,
      `The raw text content is available in [${textFilename}](${textFilename}).`,
      '',
    ].join('\n'),
    { name: 'index.md' }
  );
  archive.append(markdown, { name: markdownFilename });
  archive.append(rawText, { name: textFilename });
  await archive.finalize();
}

async function fetchRawText(url) {
  const response = await fetch(normalizeUrlForTextContent(url));
  if (!response.ok) {
    throw new Error(`HTTP ${response.status}: ${response.statusText}`);
  }
  return response.text();
}
