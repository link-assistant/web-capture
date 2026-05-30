import { fetchHtml, convertHtmlToMarkdownEnhanced } from './lib.js';
import { applyImageMode } from './extract-images.js';

export async function markdownHandler(req, res) {
  const url = req.query.url;
  if (!url) {
    return res.status(400).send('Missing `url` parameter');
  }
  const embedImages = req.query.embedImages === 'true';
  try {
    const html = await fetchHtml(url);
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
