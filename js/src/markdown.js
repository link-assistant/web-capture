import {
  fetchHtml,
  convertHtmlToMarkdownEnhanced,
  scopeHtmlForMarkdown,
} from './lib.js';
import { convertWithKreuzberg, isKreuzbergAvailable } from './kreuzberg.js';
import { applyImageMode } from './extract-images.js';

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
    const html = await fetchHtml(url);

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
      const result = await convertWithKreuzberg(scopedHtml, { baseUrl: url });
      const imageResult = await applyImageMode(result.content, {
        mode: embedImages ? 'embed' : 'default',
      });
      result.content = imageResult.markdown;

      if (format === 'json') {
        return res.json(result);
      }
      return res.type('text/markdown').send(result.content);
    }

    const { markdown } = convertHtmlToMarkdownEnhanced(html, url, {
      contentSelector: req.query.contentSelector,
      bodySelector: req.query.bodySelector,
    });
    // Route through the single image-mode chokepoint so the server honors the
    // same contract as the CLI: default keeps remote links and strips inline
    // base64; ?embedImages=true keeps base64 inline. See issue #112.
    const result = await applyImageMode(markdown, {
      mode: embedImages ? 'embed' : 'default',
    });
    res.type('text/markdown').send(result.markdown);
  } catch (err) {
    console.error(err);
    res.status(500).send('Error converting to Markdown');
  }
}
