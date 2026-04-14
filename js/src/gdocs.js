// Google Docs capture module
// Supports both API-based and browser-based capture of Google Docs documents.
// API-based capture uses the Google Docs export URL pattern:
//   https://docs.google.com/document/d/{DOCUMENT_ID}/export?format={FORMAT}
// Browser-based capture navigates to the export URL using Puppeteer or Playwright.

import fetch from 'node-fetch';
import he from 'he';
import archiver from 'archiver';
import { convertHtmlToMarkdown, prettyPrintHtml } from './lib.js';

const GDOCS_URL_PATTERN = /docs\.google\.com\/document\/d\/([a-zA-Z0-9_-]+)/;

const GDOCS_EXPORT_BASE = 'https://docs.google.com/document/d';

/**
 * Supported Google Docs export formats.
 * These map to the `format` query parameter in the export URL.
 */
export const GDOCS_EXPORT_FORMATS = {
  html: 'html',
  txt: 'txt',
  md: 'md',
  pdf: 'pdf',
  docx: 'docx',
  epub: 'epub',
  zip: 'zip',
};

/**
 * Check if a URL is a Google Docs document URL.
 *
 * @param {string} url - URL to check
 * @returns {boolean} True if the URL is a Google Docs document URL
 */
export function isGoogleDocsUrl(url) {
  if (!url || typeof url !== 'string') {
    return false;
  }
  return GDOCS_URL_PATTERN.test(url);
}

/**
 * Extract the document ID from a Google Docs URL.
 *
 * @param {string} url - Google Docs URL
 * @returns {string|null} Document ID or null if not a valid Google Docs URL
 */
export function extractDocumentId(url) {
  if (!url || typeof url !== 'string') {
    return null;
  }
  const match = url.match(GDOCS_URL_PATTERN);
  return match ? match[1] : null;
}

/**
 * Build a Google Docs export URL.
 *
 * @param {string} documentId - Google Docs document ID
 * @param {string} [format='html'] - Export format (html, txt, md, pdf, docx, epub, zip)
 * @returns {string} Export URL
 */
export function buildExportUrl(documentId, format = 'html') {
  const exportFormat = GDOCS_EXPORT_FORMATS[format] || 'html';
  return `${GDOCS_EXPORT_BASE}/${documentId}/export?format=${exportFormat}`;
}

/**
 * Fetch a Google Docs document via the export URL (API-based capture).
 *
 * For public documents, no authentication is needed.
 * For private documents, pass an API token via the apiToken option.
 *
 * @param {string} url - Google Docs URL (edit URL or any URL containing the document ID)
 * @param {Object} [options] - Fetch options
 * @param {string} [options.format='html'] - Export format
 * @param {string} [options.apiToken] - API token for private documents (Bearer token)
 * @returns {Promise<{content: string, format: string, documentId: string, exportUrl: string}>}
 */
export async function fetchGoogleDoc(url, options = {}) {
  const { format = 'html', apiToken } = options;

  const documentId = extractDocumentId(url);
  if (!documentId) {
    throw new Error(`Not a valid Google Docs URL: ${url}`);
  }

  const exportUrl = buildExportUrl(documentId, format);

  const headers = {
    'User-Agent':
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Accept-Charset': 'utf-8',
    'Accept-Language': 'en-US,en;q=0.9',
  };

  if (apiToken) {
    headers['Authorization'] = `Bearer ${apiToken}`;
  }

  const response = await fetch(exportUrl, {
    headers,
    redirect: 'follow',
  });

  if (!response.ok) {
    const statusText = response.statusText || 'Unknown error';
    throw new Error(
      `Failed to fetch Google Doc (${response.status} ${statusText}): ${exportUrl}`
    );
  }

  const rawContent = await response.text();

  // Decode HTML entities to unicode for text-based formats
  const content =
    format === 'html' || format === 'txt' || format === 'md'
      ? he.decode(rawContent)
      : rawContent;

  return {
    content,
    format,
    documentId,
    exportUrl,
  };
}

/**
 * Fetch a Google Docs document and convert to Markdown.
 *
 * Uses the HTML export format internally, then converts to Markdown
 * using the existing web-capture HTML-to-Markdown pipeline.
 *
 * @param {string} url - Google Docs URL
 * @param {Object} [options] - Options
 * @param {string} [options.apiToken] - API token for private documents
 * @returns {Promise<{markdown: string, documentId: string, exportUrl: string}>}
 */
export async function fetchGoogleDocAsMarkdown(url, options = {}) {
  const { apiToken } = options;

  // Always fetch as HTML first, then convert to Markdown
  const result = await fetchGoogleDoc(url, {
    format: 'html',
    apiToken,
  });

  const markdown = convertHtmlToMarkdown(result.content, result.exportUrl);

  return {
    markdown,
    documentId: result.documentId,
    exportUrl: result.exportUrl,
  };
}

/**
 * Extract base64 data URI images from HTML content.
 *
 * Google Docs HTML exports embed images as base64 data URIs.
 * This function extracts them and replaces with local file paths.
 *
 * @param {string} html - HTML content with data URI images
 * @returns {{html: string, images: Array<{filename: string, data: Buffer, mimeType: string}>}}
 */
export function extractBase64Images(html) {
  const images = [];
  let idx = 1;

  const updatedHtml = html.replace(
    /(<img\s[^>]*src=")data:image\/(png|jpeg|jpg|gif|webp|svg\+xml);base64,([^"]+)(")/gi,
    (match, prefix, mimeExt, base64Data, suffix) => {
      const ext =
        mimeExt === 'jpeg' ? 'jpg' : mimeExt === 'svg+xml' ? 'svg' : mimeExt;
      const filename = `image-${String(idx).padStart(2, '0')}.${ext}`;
      const mimeType = `image/${mimeExt}`;
      images.push({
        filename,
        data: Buffer.from(base64Data, 'base64'),
        mimeType,
      });
      idx++;
      return `${prefix}images/${filename}${suffix}`;
    }
  );

  return { html: updatedHtml, images };
}

/**
 * Fetch a Google Docs document as a ZIP archive with images.
 *
 * Fetches the document as HTML, extracts embedded base64 images,
 * and bundles everything into a ZIP archive containing:
 * - document.md (Markdown version)
 * - document.html (HTML version with local image paths)
 * - images/ (extracted images)
 *
 * @param {string} url - Google Docs URL
 * @param {Object} [options] - Options
 * @param {string} [options.apiToken] - API token for private documents
 * @returns {Promise<{documentId: string, exportUrl: string, createArchive: function}>}
 */
export async function fetchGoogleDocAsArchive(url, options = {}) {
  const { apiToken } = options;

  // Fetch HTML with embedded base64 images
  const result = await fetchGoogleDoc(url, { format: 'html', apiToken });

  // Extract base64 images from HTML
  const { html: localHtml, images } = extractBase64Images(result.content);

  // Convert the localized HTML to Markdown
  const markdown = convertHtmlToMarkdown(localHtml);

  return {
    documentId: result.documentId,
    exportUrl: result.exportUrl,
    html: localHtml,
    markdown,
    images,
  };
}

/**
 * Express handler for the /gdocs API endpoint.
 *
 * Query parameters:
 * - url (required): Google Docs URL
 * - format (optional): Export format (html, markdown, md, txt, pdf, docx)
 * - apiToken (optional): API token for private documents
 *
 * The API token can also be provided via:
 * - Authorization header: Bearer <token>
 * - X-Api-Token header: <token>
 *
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 */
export async function gdocsHandler(req, res) {
  const url = req.query.url;
  if (!url) {
    return res.status(400).send('Missing `url` parameter');
  }

  if (!isGoogleDocsUrl(url)) {
    return res.status(400).send('URL is not a Google Docs document URL');
  }

  // Resolve API token from query, headers, or environment
  const apiToken =
    req.query.apiToken ||
    extractBearerToken(req.headers.authorization) ||
    req.headers['x-api-token'] ||
    undefined;

  const format = (req.query.format || 'markdown').toLowerCase();

  try {
    if (format === 'archive' || format === 'zip') {
      return await sendGDocsArchive(res, url, apiToken);
    }

    if (format === 'markdown' || format === 'md') {
      const result = await fetchGoogleDocAsMarkdown(url, { apiToken });
      return res.type('text/markdown').send(result.markdown);
    }

    return await sendGDocsExport(res, url, format, apiToken);
  } catch (err) {
    console.error('Google Docs capture error:', err.message);
    return res.status(500).send(`Error capturing Google Doc: ${err.message}`);
  }
}

async function sendGDocsArchive(res, url, apiToken) {
  const archiveResult = await fetchGoogleDocAsArchive(url, { apiToken });

  res.set('Content-Type', 'application/zip');
  res.set(
    'Content-Disposition',
    `attachment; filename="gdoc-${archiveResult.documentId}.zip"`
  );

  const archive = archiver('zip', { zlib: { level: 9 } });
  archive.pipe(res);
  archive.append(archiveResult.markdown, { name: 'document.md' });
  archive.append(prettyPrintHtml(archiveResult.html), {
    name: 'document.html',
  });
  for (const img of archiveResult.images) {
    archive.append(img.data, { name: `images/${img.filename}` });
  }
  await archive.finalize();
}

const FORMAT_CONTENT_TYPES = {
  html: 'text/html',
  txt: 'text/plain',
  pdf: 'application/pdf',
  docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
};

const FORMAT_DISPOSITIONS = {
  pdf: 'inline; filename="document.pdf"',
  docx: 'inline; filename="document.docx"',
};

async function sendGDocsExport(res, url, format, apiToken) {
  const result = await fetchGoogleDoc(url, { format, apiToken });
  const contentType = FORMAT_CONTENT_TYPES[format] || 'text/html';
  const disposition = FORMAT_DISPOSITIONS[format];

  res.type(contentType);
  if (disposition) {
    res.set('Content-Disposition', disposition);
  }
  return res.send(result.content);
}

/**
 * Extract Bearer token from Authorization header value.
 *
 * @param {string|undefined} authHeader - Authorization header value
 * @returns {string|undefined} Token or undefined
 */
function extractBearerToken(authHeader) {
  if (!authHeader || typeof authHeader !== 'string') {
    return undefined;
  }
  const match = authHeader.match(/^Bearer\s+(.+)$/i);
  return match ? match[1] : undefined;
}
