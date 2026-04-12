import { fetchHtml, convertHtmlToMarkdown } from './lib.js';
import { convertWithKreuzberg, isKreuzbergAvailable } from './kreuzberg.js';

export async function markdownHandler(req, res) {
  const url = req.query.url;
  if (!url) {
    return res.status(400).send('Missing `url` parameter');
  }

  const converter = req.query.converter || 'turndown';
  const format = req.query.format || 'text';

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

      const result = await convertWithKreuzberg(html);

      if (format === 'json') {
        return res.json(result);
      }
      return res.type('text/markdown').send(result.content);
    }

    // Default: use Turndown-based converter
    const markdown = convertHtmlToMarkdown(html, url);
    res.type('text/markdown').send(markdown);
  } catch (err) {
    console.error(err);
    res.status(500).send('Error converting to Markdown');
  }
}
