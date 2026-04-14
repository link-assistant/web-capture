import { fetchHtml, convertHtmlToMarkdown } from './lib.js';
import { stripBase64Images } from './extract-images.js';

export async function markdownHandler(req, res) {
  const url = req.query.url;
  if (!url) {
    return res.status(400).send('Missing `url` parameter');
  }
  const embedImages = req.query.embedImages === 'true';
  const keepOriginalLinks = req.query.keepOriginalLinks !== 'false';
  try {
    const html = await fetchHtml(url);
    let markdown = convertHtmlToMarkdown(html, url);
    if (!embedImages) {
      const strip = stripBase64Images(markdown);
      markdown = strip.markdown;
    }
    res.type('text/markdown').send(markdown);
  } catch (err) {
    console.error(err);
    res.status(500).send('Error converting to Markdown');
  }
}
