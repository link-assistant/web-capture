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
import archiver from 'archiver';
import fetch from 'node-fetch';

const INLINE_MARKDOWN_LINE_LIMIT = 1500;

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
    const pageUrl = normalizeUrlForTextPage(url);
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
      return await sendMarkdownResponse(res, url, markdown);
    }

    const html = await fetchHtml(pageUrl);

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
      return await sendMarkdownResponse(res, url, result.content);
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
    return await sendMarkdownResponse(res, url, markdown);
  } catch (err) {
    console.error(err);
    res.status(500).send('Error converting to Markdown');
  }
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
