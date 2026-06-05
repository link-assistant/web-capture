import fetch from 'node-fetch';
import { URL } from 'node:url';
import {
  fetchHtml,
  getTextPasteFilename,
  isStackOverflowQuestionUrl,
  normalizeUrlForTextContent,
} from './lib.js';
import {
  fetchGithubRepositorySnapshot,
  formatGithubRepositoryText,
  getGithubRepositoryTextFilename,
  isGithubRepositoryUrl,
} from './github.js';

export async function txtHandler(req, res) {
  const url = req.query.url;
  if (!url) {
    return res.status(400).send('Missing `url` parameter');
  }

  try {
    if (isGithubRepositoryUrl(url)) {
      const snapshot = await fetchGithubRepositorySnapshot(url);
      const text = formatGithubRepositoryText(snapshot);
      return sendTextResponse(res, url, text);
    }

    if (isStackOverflowQuestionUrl(url)) {
      const text = await fetchHtml(url);
      return sendTextResponse(res, url, text);
    }

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

    sendTextResponse(res, url, text);
  } catch (err) {
    console.error('Text fetch error:', err);
    res.status(500).send('Error fetching text content');
  }
}

function sendTextResponse(res, url, text) {
  res.setHeader('Content-Type', 'text/plain; charset=utf-8');
  res.setHeader(
    'Content-Disposition',
    `attachment; filename="${getFilenameFromUrl(url)}"`
  );
  res.send(text);
}

function getFilenameFromUrl(url) {
  const githubRepositoryFilename = getGithubRepositoryTextFilename(url);
  if (githubRepositoryFilename) {
    return githubRepositoryFilename;
  }

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
