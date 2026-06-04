import fetch from 'node-fetch';
import { URL } from 'node:url';
import { getTextPasteFilename, normalizeUrlForTextContent } from './lib.js';

export async function txtHandler(req, res) {
  const url = req.query.url;
  if (!url) {
    return res.status(400).send('Missing `url` parameter');
  }

  try {
    // Normalize URL to get text content (e.g., xpaste.pro -> xpaste.pro/raw)
    const textUrl = normalizeUrlForTextContent(url);

    const response = await fetch(textUrl);

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const contentType = response.headers.get('content-type') || 'text/plain';

    // Only accept text content types
    if (!contentType.includes('text/')) {
      throw new Error(`Expected text content, got ${contentType}`);
    }

    const text = await response.text();

    // Set appropriate headers for text file download
    res.setHeader('Content-Type', 'text/plain; charset=utf-8');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="${getFilenameFromUrl(url)}"`
    );
    res.send(text);
  } catch (err) {
    console.error('Text fetch error:', err);
    res.status(500).send('Error fetching text content');
  }
}

function getFilenameFromUrl(url) {
  const textPasteFilename = getTextPasteFilename(url);
  if (textPasteFilename) {
    return textPasteFilename;
  }

  try {
    const urlObj = new URL(url);
    const hostname = urlObj.hostname.replace(/\./g, '-');
    const path = urlObj.pathname
      .replace(/\//g, '-')
      .replace(/^-/, '')
      .replace(/-raw$/, '');
    return `${hostname}${path}.txt`;
  } catch {
    return 'download.txt';
  }
}
