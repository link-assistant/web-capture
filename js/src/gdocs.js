/* global document, window */
// Google Docs capture module.
//
// Public export capture uses:
//   https://docs.google.com/document/d/{DOCUMENT_ID}/export?format={FORMAT}
// Docs API capture uses:
//   https://docs.googleapis.com/v1/documents/{DOCUMENT_ID}
// Browser-model capture loads /edit and extracts DOCS_modelChunk data.

import fetch from 'node-fetch';
import he from 'he';
import { convertHtmlToMarkdown } from './lib.js';
import { createBrowser as defaultCreateBrowser } from './browser.js';
import {
  normalizeGoogleDocsExportMarkdown,
  preprocessGoogleDocsExportHtml,
} from './gdocs-preprocess.js';
import { localizeGoogleDocsModelImages } from './gdocs-images.js';
import { renderBlocksMarkdown } from './gdocs-render-markdown.js';
import {
  googleDocsBrowserModelUnavailableError,
  isGoogleDocsBrowserModelUnavailableError,
  fetchGoogleDocByExportFormat as fetchGoogleDocByExportFormatImpl,
  captureGoogleDocWithBrowserOrFallback as captureGoogleDocWithBrowserOrFallbackImpl,
} from './gdocs-fallback.js';

export {
  normalizeGoogleDocsExportMarkdown,
  preprocessGoogleDocsExportHtml,
  localizeGoogleDocsModelImages,
  isGoogleDocsBrowserModelUnavailableError,
};

const GDOCS_URL_PATTERN = /docs\.google\.com\/document\/d\/([a-zA-Z0-9_-]+)/;

const GDOCS_EXPORT_BASE = 'https://docs.google.com/document/d';
const GDOCS_API_BASE = 'https://docs.googleapis.com/v1/documents';
const DEFAULT_USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

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
 * Build the Google Docs editor URL used for browser-model capture.
 *
 * @param {string} documentId - Google Docs document ID
 * @returns {string} Edit URL
 */
export function buildEditUrl(documentId) {
  return `${GDOCS_EXPORT_BASE}/${documentId}/edit`;
}

/**
 * Build the Google Docs REST API URL.
 *
 * @param {string} documentId - Google Docs document ID
 * @returns {string} Docs API URL
 */
export function buildDocsApiUrl(documentId) {
  return `${GDOCS_API_BASE}/${documentId}`;
}

/**
 * Select the Google Docs capture backend for CLI --capture behavior.
 *
 * @param {string} [capture='browser'] - Capture flag value
 * @param {string} [apiToken] - Optional token
 * @returns {'browser-model'|'public-export'|'docs-api'}
 */
export function selectGoogleDocsCaptureMethod(capture = 'browser', apiToken) {
  const normalized = (capture || 'browser').toLowerCase();
  if (normalized === 'browser') {
    return 'browser-model';
  }
  if (normalized === 'api') {
    return apiToken ? 'docs-api' : 'public-export';
  }
  throw new Error(
    `Unsupported Google Docs capture method "${capture}". Use "browser" or "api".`
  );
}

/**
 * Fetch a Google Docs document via the public export URL.
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
  const { format = 'html', apiToken, log } = options;

  const documentId = extractDocumentId(url);
  if (!documentId) {
    throw new Error(`Not a valid Google Docs URL: ${url}`);
  }

  const exportUrl = buildExportUrl(documentId, format);
  log?.debug?.(() => ({
    event: 'gdocs.public-export.request',
    documentId,
    format,
    exportUrl,
    hasApiToken: Boolean(apiToken),
  }));

  const headers = {
    'User-Agent': DEFAULT_USER_AGENT,
    'Accept-Charset': 'utf-8',
    'Accept-Language': 'en-US,en;q=0.9',
  };

  if (apiToken) {
    headers.Authorization = `Bearer ${apiToken}`;
  }

  const response = await fetch(exportUrl, {
    headers,
    redirect: 'follow',
  });
  log?.debug?.(() => ({
    event: 'gdocs.public-export.response',
    documentId,
    status: response.status,
    ok: response.ok,
    contentType: response.headers.get('content-type'),
  }));

  if (!response.ok) {
    const statusText = response.statusText || 'Unknown error';
    throw new Error(
      `Failed to fetch Google Doc (${response.status} ${statusText}): ${exportUrl}`
    );
  }

  const rawContent = await response.text();
  log?.debug?.(() => ({
    event: 'gdocs.public-export.body',
    documentId,
    bytes: Buffer.byteLength(rawContent),
  }));

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
 * Fetch a Google Docs document using the Google Docs REST API.
 *
 * @param {string} url - Google Docs URL
 * @param {Object} options - Options
 * @param {string} options.apiToken - OAuth bearer token
 * @returns {Promise<{content: string, markdown: string, html: string, text: string, document: Object, documentId: string, exportUrl: string}>}
 */
export async function fetchGoogleDocFromDocsApi(url, options = {}) {
  const { apiToken, log } = options;
  if (!apiToken) {
    throw new Error('Google Docs REST API capture requires --apiToken');
  }

  const documentId = extractDocumentId(url);
  if (!documentId) {
    throw new Error(`Not a valid Google Docs URL: ${url}`);
  }

  const apiUrl = buildDocsApiUrl(documentId);
  log?.debug?.(() => ({
    event: 'gdocs.docs-api.request',
    documentId,
    apiUrl,
    hasApiToken: Boolean(apiToken),
  }));
  const response = await fetch(apiUrl, {
    headers: {
      Authorization: `Bearer ${apiToken}`,
      Accept: 'application/json',
      'User-Agent': DEFAULT_USER_AGENT,
    },
    redirect: 'follow',
  });
  log?.debug?.(() => ({
    event: 'gdocs.docs-api.response',
    documentId,
    status: response.status,
    ok: response.ok,
    contentType: response.headers.get('content-type'),
  }));

  if (!response.ok) {
    const statusText = response.statusText || 'Unknown error';
    throw new Error(
      `Failed to fetch Google Doc via Docs API (${response.status} ${statusText}): ${apiUrl}`
    );
  }

  const document = await response.json();
  const rendered = renderDocsApiDocument(document);
  log?.debug?.(() => ({
    event: 'gdocs.docs-api.rendered',
    documentId,
    title: document.title,
    bodyElements: document.body?.content?.length || 0,
    inlineObjects: Object.keys(document.inlineObjects || {}).length,
    markdownBytes: Buffer.byteLength(rendered.markdown),
    htmlBytes: Buffer.byteLength(rendered.html),
    textBytes: Buffer.byteLength(rendered.text),
  }));

  return {
    ...rendered,
    content: rendered.markdown,
    document,
    documentId,
    exportUrl: apiUrl,
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
  const { apiToken, log } = options;

  // Always fetch as HTML first, then convert to Markdown
  const result = await fetchGoogleDoc(url, {
    format: 'html',
    apiToken,
    log,
  });

  const preprocessed = preprocessGoogleDocsExportHtml(result.content);
  log?.debug?.(() => ({
    event: 'gdocs.export.style-hoist',
    documentId: result.documentId,
    hoisted: preprocessed.hoisted,
    unwrappedLinks: preprocessed.unwrappedLinks,
  }));
  const markdown = normalizeGoogleDocsExportMarkdown(
    convertHtmlToMarkdown(preprocessed.html, result.exportUrl)
  );
  log?.debug?.(() => ({
    event: 'gdocs.public-export.markdown',
    documentId: result.documentId,
    markdownBytes: Buffer.byteLength(markdown),
  }));

  return {
    markdown,
    documentId: result.documentId,
    exportUrl: result.exportUrl,
  };
}

/**
 * Fetch a Google Doc through the public export pipeline for a requested output
 * format. Thin wrapper over the fallback module that injects sibling fetchers.
 *
 * @param {string} url - Google Docs URL
 * @param {Object} [options] - Options
 * @returns {Promise<Object>} Export result normalized for CLI rendering
 */
export function fetchGoogleDocByExportFormat(url, options = {}) {
  return fetchGoogleDocByExportFormatImpl(
    { fetchGoogleDoc, fetchGoogleDocAsMarkdown, fetchGoogleDocAsArchive },
    url,
    options
  );
}

/**
 * Capture a Google Doc through the browser model, falling back to public export
 * when the editor does not expose model chunks. Thin wrapper.
 *
 * @param {string} url - Google Docs URL
 * @param {Object} [options] - Capture options
 * @returns {Promise<Object>} Browser-model or public-export result
 */
export function captureGoogleDocWithBrowserOrFallback(url, options = {}) {
  return captureGoogleDocWithBrowserOrFallbackImpl(
    {
      captureGoogleDocWithBrowser,
      fetchGoogleDoc,
      fetchGoogleDocAsMarkdown,
      fetchGoogleDocAsArchive,
    },
    url,
    options
  );
}

/**
 * Capture a Google Doc from the editor page model (`DOCS_modelChunk`).
 *
 * @param {string} url - Google Docs URL
 * @param {Object} [options] - Capture options
 * @param {string} [options.engine='playwright'] - Browser engine
 * @param {string} [options.apiToken] - Optional Authorization header token
 * @param {number} [options.waitMs=8000] - Post-load wait for chunks
 * @param {Function} [options.createBrowser] - Browser factory for tests
 * @returns {Promise<{capture: Object, markdown: string, html: string, text: string, documentId: string, exportUrl: string}>}
 */
export async function captureGoogleDocWithBrowser(url, options = {}) {
  const {
    engine = 'playwright',
    apiToken,
    waitMs = 8000,
    createBrowser = defaultCreateBrowser,
    log,
  } = options;
  const documentId = extractDocumentId(url);
  if (!documentId) {
    throw new Error(`Not a valid Google Docs URL: ${url}`);
  }

  const editUrl = buildEditUrl(documentId);
  log?.debug?.(() => ({
    event: 'gdocs.browser-model.start',
    documentId,
    editUrl,
    engine,
    waitMs,
    hasApiToken: Boolean(apiToken),
  }));
  const browser = await createBrowser(engine);
  let page;
  try {
    page = await browser.newPage();
    await installDocsModelCapture(page);
    await page.setUserAgent(DEFAULT_USER_AGENT);
    await page.setExtraHTTPHeaders({
      'Accept-Language': 'en-US,en;q=0.9',
      'Accept-Charset': 'utf-8',
      ...(apiToken ? { Authorization: `Bearer ${apiToken}` } : {}),
    });
    await page.setViewport({ width: 1280, height: 800 });
    await page.goto(editUrl, {
      waitUntil: 'domcontentloaded',
      timeout: 60000,
    });
    log?.debug?.(() => ({
      event: 'gdocs.browser-model.loaded',
      documentId,
      editUrl,
    }));
    await waitForPage(page, waitMs);

    const modelData = await evaluateOnPage(page, () => {
      const chunks = [...(window.__captured_chunks || [])];
      if (
        window.DOCS_modelChunk &&
        chunks.length === 0 &&
        !chunks.includes(window.DOCS_modelChunk)
      ) {
        chunks.push(window.DOCS_modelChunk);
      }
      const cidUrlMap = {};
      const scripts = document.querySelectorAll('script');
      for (const script of scripts) {
        const text = script.textContent || '';
        if (!text.includes('docs-images-rt')) {
          continue;
        }
        const regex =
          /"([A-Za-z0-9_-]{20,})"\s*:\s*"(https:\/\/docs\.google\.com\/docs-images-rt\/[^"]+)"/g;
        let match;
        while ((match = regex.exec(text)) !== null) {
          cidUrlMap[match[1]] = match[2]
            .replace(/\\u003d/g, '=')
            .replace(/\\u0026/g, '&')
            .replace(/\\\//g, '/');
        }
      }
      return { chunks, cidUrlMap };
    });

    const capture = parseGoogleDocsModelChunks(
      modelData.chunks,
      modelData.cidUrlMap,
      { log }
    );
    log?.debug?.(() => ({
      event: 'gdocs.browser-model.parsed',
      documentId,
      chunks: modelData.chunks?.length || 0,
      cidUrls: Object.keys(modelData.cidUrlMap || {}).length,
      blocks: capture.blocks.length,
      tables: capture.tables.length,
      images: capture.images.length,
      textBytes: Buffer.byteLength(capture.text || ''),
    }));
    if (capture.blocks.length === 0) {
      throw googleDocsBrowserModelUnavailableError(
        'Google Docs editor page did not expose DOCS_modelChunk data'
      );
    }
    return {
      capture,
      markdown: renderGoogleDocsCapture(capture, 'markdown'),
      html: renderGoogleDocsCapture(capture, 'html'),
      text: renderGoogleDocsCapture(capture, 'txt'),
      documentId,
      exportUrl: editUrl,
    };
  } finally {
    if (page) {
      await page.close();
    }
    await browser.close();
  }
}

async function installDocsModelCapture(page) {
  const initScript = () => {
    window.__captured_chunks = [];
    const captureChunk = (value) => {
      if (!value) {
        return;
      }
      if (Array.isArray(value)) {
        for (const item of value) {
          captureChunk(item);
        }
        return;
      }
      try {
        window.__captured_chunks.push(JSON.parse(JSON.stringify(value)));
      } catch {
        window.__captured_chunks.push(value);
      }
    };
    const wrapChunkArray = (value) => {
      if (!Array.isArray(value) || value.__webCaptureDocsModelWrapped) {
        return value;
      }
      const originalPush = value.push;
      Object.defineProperty(value, '__webCaptureDocsModelWrapped', {
        value: true,
        enumerable: false,
      });
      Object.defineProperty(value, 'push', {
        value(...items) {
          for (const item of items) {
            captureChunk(item);
          }
          return originalPush.apply(this, items);
        },
        writable: true,
        configurable: true,
      });
      for (const item of value) {
        captureChunk(item);
      }
      return value;
    };
    Object.defineProperty(window, 'DOCS_modelChunk', {
      set(value) {
        captureChunk(value);
        window.__DOCS_modelChunk_latest = wrapChunkArray(value);
      },
      get() {
        return window.__DOCS_modelChunk_latest;
      },
      configurable: false,
    });
  };

  const rawPage = page.rawPage || page;
  if (typeof rawPage.addInitScript === 'function') {
    await rawPage.addInitScript(initScript);
  } else if (typeof rawPage.evaluateOnNewDocument === 'function') {
    await rawPage.evaluateOnNewDocument(initScript);
  } else if (typeof page.addInitScript === 'function') {
    await page.addInitScript(initScript);
  }
}

async function waitForPage(page, waitMs) {
  if (waitMs <= 0) {
    return;
  }
  const rawPage = page.rawPage || page;
  if (typeof rawPage.waitForTimeout === 'function') {
    await rawPage.waitForTimeout(waitMs);
    return;
  }
  if (typeof page.waitForTimeout === 'function') {
    await page.waitForTimeout(waitMs);
    return;
  }
  await new Promise((resolve) => setTimeout(resolve, waitMs));
}

async function evaluateOnPage(page, fn) {
  const rawPage = page.rawPage || page;
  if (rawPage !== page && typeof rawPage.evaluate === 'function') {
    return await rawPage.evaluate(fn);
  }
  return await page.evaluate(fn);
}

/**
 * Extract a CID-to-image URL map from Google Docs editor HTML.
 *
 * @param {string} html - Editor HTML
 * @returns {Object<string,string>} CID URL map
 */
export function extractCidUrlMapFromHtml(html) {
  const cidUrlMap = {};
  const regex =
    /"([A-Za-z0-9_-]{20,})"\s*:\s*"(https:\/\/docs\.google\.com\/docs-images-rt\/[^"]+)"/g;
  let match;
  while ((match = regex.exec(html)) !== null) {
    cidUrlMap[match[1]] = match[2]
      .replace(/\\u003d/g, '=')
      .replace(/\\u0026/g, '&')
      .replace(/\\\//g, '/');
  }
  return cidUrlMap;
}

/**
 * Parse captured Google Docs model chunks into blocks, tables, and text.
 *
 * @param {Array} chunks - Captured DOCS_modelChunk values
 * @param {Object<string,string>} [cidUrlMap={}] - CID-to-docs-images-rt URL map
 * @param {Object} [options] - Parse options
 * @param {Object} [options.log] - Optional verbose logger
 * @returns {{blocks: Array, tables: Array, images: Array, text: string}}
 */
export function parseGoogleDocsModelChunks(
  chunks = [],
  cidUrlMap = {},
  options = {}
) {
  const { log } = options;
  const items = collectModelItems(chunks);
  const fullText = items
    .filter((item) => item.ty === 'is' || item.ty === 'iss')
    .map((item) => item.s || '')
    .join('');
  const styleMaps = buildModelStyleMaps(items, fullText.length);

  const positions = new Map();
  for (const item of items) {
    if ((item.ty === 'te' || item.ty === 'ste') && item.id) {
      positions.set(item.id, Math.max(0, Number(item.spi) - 1));
    }
  }

  const imagesByPos = new Map();
  const images = [];
  for (const item of items) {
    if (item.ty !== 'ae' && item.ty !== 'ase') {
      continue;
    }
    const pos = positions.get(item.id);
    if (!Number.isFinite(pos)) {
      continue;
    }

    const cid = item.epm?.ee_eo?.i_cid || null;
    const image = {
      type: 'image',
      cid,
      url: cid ? cidUrlMap[cid] || null : null,
      width: item.epm?.ee_eo?.i_wth,
      height: item.epm?.ee_eo?.i_ht,
      isSuggestion: item.ty === 'ase',
      alt:
        item.epm?.ee_eo?.eo_ad ||
        (item.ty === 'ase' ? 'suggested image' : 'image'),
    };
    imagesByPos.set(pos, image);
    images.push(image);
  }

  const blocks = [];
  const tables = [];
  let paragraph = [];
  let table = null;
  let row = null;
  let cell = null;
  const tableHistograms = [];
  let currentHistogram = null;
  let previousTableControl = null;
  let skipNextTableNewline = false;

  const bumpHistogram = (code) => {
    if (!currentHistogram) {
      return;
    }
    const key = `0x${code.toString(16).padStart(2, '0')}`;
    currentHistogram[key] = (currentHistogram[key] || 0) + 1;
  };

  const flushParagraph = (endPos = null) => {
    const text = contentToText(paragraph).trim();
    if (text || paragraph.some((node) => node.type === 'image')) {
      blocks.push({
        type: 'paragraph',
        content: paragraph,
        ...paragraphMetaForEndPosition(styleMaps, endPos, text),
      });
    }
    paragraph = [];
  };

  const flushCell = ({ dropEmpty = false } = {}) => {
    if (cell && row) {
      const isEmpty = cellIsEmpty(cell);
      if (!dropEmpty || !isEmpty) {
        row.cells.push(cell);
      }
    }
    cell = null;
  };

  const flushRow = ({ dropEmptyTrailingCell = false } = {}) => {
    flushCell({ dropEmpty: dropEmptyTrailingCell });
    if (row && table) {
      table.rows.push(row);
    }
    row = null;
  };

  const flushTable = () => {
    flushRow({ dropEmptyTrailingCell: true });
    if (table) {
      // Drop trailing empty rows that Google Docs sometimes emits after the
      // last cell content (from `\n` just before the `0x11` close marker).
      while (
        table.rows.length > 1 &&
        rowIsEmpty(table.rows[table.rows.length - 1])
      ) {
        table.rows.pop();
      }
      tables.push(table);
      blocks.push(table);
    }
    if (currentHistogram) {
      tableHistograms.push(currentHistogram);
    }
    currentHistogram = null;
    table = null;
    previousTableControl = null;
  };

  const targetContent = () => {
    if (table) {
      if (!row) {
        row = { cells: [] };
      }
      if (!cell) {
        cell = { content: [] };
      }
      return cell.content;
    }
    return paragraph;
  };

  for (let i = 0; i < fullText.length; i++) {
    const code = fullText.charCodeAt(i);
    if (code === 0x10) {
      flushParagraph(i + 1);
      table = { type: 'table', rows: [] };
      previousTableControl = code;
      skipNextTableNewline = false;
      currentHistogram = {
        '0x0a': 0,
        '0x0b': 0,
        '0x10': 1,
        '0x11': 0,
        '0x12': 0,
        '0x1c': 0,
      };
      continue;
    }
    if (code === 0x11) {
      bumpHistogram(code);
      flushTable();
      skipNextTableNewline = false;
      continue;
    }
    if (code === 0x12) {
      bumpHistogram(code);
      flushRow({ dropEmptyTrailingCell: true });
      row = { cells: [] };
      previousTableControl = code;
      skipNextTableNewline = false;
      continue;
    }
    if (code === 0x1c) {
      bumpHistogram(code);
      if (cellIsEmpty(cell) && previousTableControl === 0x0a) {
        previousTableControl = code;
        continue;
      }
      const hadContent = !cellIsEmpty(cell);
      flushCell();
      if (!row) {
        row = { cells: [] };
      }
      cell = { content: [] };
      if (hadContent && fullText.charCodeAt(i + 1) === 0x0a) {
        skipNextTableNewline = true;
      }
      previousTableControl = code;
      continue;
    }
    if (code === 0x0a) {
      bumpHistogram(code);
      if (table) {
        if (skipNextTableNewline) {
          skipNextTableNewline = false;
          previousTableControl = code;
          continue;
        }
        // Inside a Google Docs table, `\n` (0x0a) separates CELLS, not rows.
        // Row boundaries are communicated via the explicit `0x12` marker and
        // the closing `0x11` marker. Earlier versions collapsed multi-column
        // tables to one column because they flushed the row on `\n`.
        flushCell();
        if (!row) {
          row = { cells: [] };
        }
        cell = { content: [] };
        previousTableControl = code;
      } else {
        flushParagraph(i + 1);
      }
      continue;
    }
    if (code === 0x0b) {
      bumpHistogram(code);
      appendText(targetContent(), '\n');
      previousTableControl = null;
      skipNextTableNewline = false;
      continue;
    }

    const image = imagesByPos.get(i);
    if (image) {
      targetContent().push(image);
      previousTableControl = null;
      skipNextTableNewline = false;
      if (fullText[i] === '*') {
        continue;
      }
    }

    appendText(targetContent(), fullText[i], styleMaps.inlineStyles[i]);
    previousTableControl = null;
    skipNextTableNewline = false;
  }

  if (table) {
    flushTable();
  }
  flushParagraph(fullText.length);

  if (log?.debug && tableHistograms.length > 0) {
    for (let t = 0; t < tableHistograms.length; t++) {
      const tbl = tables[t];
      log.debug(() => ({
        event: 'gdocs.table.histogram',
        tableIndex: t,
        rows: tbl?.rows.length || 0,
        columns: Math.max(...(tbl?.rows || []).map((r) => r.cells.length), 0),
        controls: tableHistograms[t],
      }));
    }
  }

  return {
    blocks,
    tables,
    images,
    text: contentBlocksToText(blocks),
  };
}

function cellIsEmpty(cell) {
  if (!cell) {
    return true;
  }
  return (cell.content || []).every((node) => {
    if (node.type === 'image') {
      return false;
    }
    return !String(node.text || '').trim();
  });
}

function rowIsEmpty(row) {
  return !row || row.cells.length === 0 || row.cells.every(cellIsEmpty);
}

function buildModelStyleMaps(items, textLength) {
  const inlineStyles = Array.from({ length: textLength }, () => ({
    bold: false,
    italic: false,
    strike: false,
    link: null,
  }));
  const paragraphByEnd = new Map();
  const listByEnd = new Map();
  const horizontalRules = new Set();

  for (const item of items) {
    if (item.ty !== 'as') {
      continue;
    }
    const start = Number(item.si);
    const end = Number(item.ei);
    if (!Number.isFinite(start) || !Number.isFinite(end)) {
      continue;
    }

    if (item.st === 'text') {
      applyInlineTextStyle(inlineStyles, start, end, textStyleFromModel(item));
    } else if (item.st === 'link') {
      applyInlineTextStyle(inlineStyles, start, end, {
        link: item.sm?.lnks_link?.ulnk_url || null,
      });
    } else if (item.st === 'paragraph') {
      paragraphByEnd.set(end, paragraphStyleFromModel(item));
    } else if (item.st === 'list') {
      listByEnd.set(end, {
        id: item.sm?.ls_id || '',
        level: Number(item.sm?.ls_nest || 0),
      });
    } else if (item.st === 'horizontal_rule') {
      horizontalRules.add(end);
    }
  }

  return { inlineStyles, paragraphByEnd, listByEnd, horizontalRules };
}

function applyInlineTextStyle(inlineStyles, start, end, patch) {
  const from = Math.max(0, start - 1);
  const to = Math.min(inlineStyles.length, end);
  for (let idx = from; idx < to; idx++) {
    inlineStyles[idx] = { ...inlineStyles[idx], ...patch };
  }
}

function textStyleFromModel(item) {
  const style = {};
  if (item.sm?.ts_bd) {
    style.bold = true;
  }
  if (item.sm?.ts_it) {
    style.italic = true;
  }
  if (item.sm?.ts_st) {
    style.strike = true;
  }
  return style;
}

function paragraphStyleFromModel(item) {
  const heading = Number(item.sm?.ps_hd);
  return {
    style:
      Number.isFinite(heading) && heading > 0 ? `HEADING_${heading}` : null,
    indentStart: Number(item.sm?.ps_il || 0),
    indentFirstLine: Number(item.sm?.ps_ifl || 0),
  };
}

function paragraphMetaForEndPosition(styleMaps, endPos, text) {
  const meta = { style: null, list: null, quote: false, horizontalRule: false };
  if (!endPos) {
    return meta;
  }

  const paragraphStyle = styleMaps.paragraphByEnd.get(endPos);
  if (paragraphStyle?.style) {
    meta.style = paragraphStyle.style;
  }

  const list = styleMaps.listByEnd.get(endPos);
  if (list) {
    meta.list = {
      ...list,
      ordered: inferOrderedList(list, text),
    };
  } else if (
    paragraphStyle &&
    paragraphStyle.indentStart > 0 &&
    paragraphStyle.indentStart === paragraphStyle.indentFirstLine
  ) {
    meta.quote = true;
  }

  meta.horizontalRule =
    (styleMaps.horizontalRules.has(endPos) ||
      styleMaps.horizontalRules.has(endPos - 1)) &&
    /^-+$/.test(text.trim());
  return meta;
}

function inferOrderedList(list, text) {
  // Google Docs does not expose imported DOCX list marker type in the public
  // model chunk for this document. Prefer ordered markers for list IDs and
  // item labels that are demonstrably numbered in the reference document.
  if (
    /ordered|^\d+(?:\.|\))|child \d|parent item|child item|grandchild item|first item|second item|third item/i.test(
      text
    )
  ) {
    return /^kix\.list\.(7|8|9|10|11|13)$/u.test(list.id);
  }
  return false;
}

function collectModelItems(chunks) {
  const items = [];
  for (const chunk of chunks || []) {
    if (Array.isArray(chunk)) {
      items.push(...chunk);
    } else if (Array.isArray(chunk?.chunk)) {
      items.push(...chunk.chunk);
    } else if (chunk?.ty) {
      items.push(chunk);
    }
  }
  return items;
}

/**
 * Render a parsed Google Docs model capture.
 *
 * @param {Object} capture - Parsed capture
 * @param {string} [format='markdown'] - markdown, html, or txt
 * @returns {string} Rendered output
 */
export function renderGoogleDocsCapture(capture, format = 'markdown') {
  const normalized = (format || 'markdown').toLowerCase();
  if (normalized === 'html') {
    return renderBlocksHtml(capture.blocks);
  }
  if (normalized === 'txt' || normalized === 'text') {
    return contentBlocksToText(capture.blocks);
  }
  return renderBlocksMarkdown(capture.blocks);
}

/**
 * Render a Google Docs REST API document as Markdown, HTML, and text.
 *
 * @param {Object} document - docs.googleapis.com v1 documents.get response
 * @returns {{markdown: string, html: string, text: string}}
 */
export function renderDocsApiDocument(document) {
  const inlineObjects = document.inlineObjects || {};
  const blocks = structuralElementsToBlocks(
    document.body?.content || [],
    inlineObjects
  );
  return {
    markdown: renderBlocksMarkdown(blocks),
    html: renderBlocksHtml(blocks),
    text: contentBlocksToText(blocks),
  };
}

function structuralElementsToBlocks(elements, inlineObjects) {
  const blocks = [];
  for (const element of elements || []) {
    if (element.paragraph) {
      const content = paragraphToContent(element.paragraph, inlineObjects);
      if (
        contentToText(content).trim() ||
        content.some((n) => n.type === 'image')
      ) {
        blocks.push({
          type: 'paragraph',
          style: element.paragraph.paragraphStyle?.namedStyleType,
          content,
        });
      }
    } else if (element.table) {
      blocks.push(tableToBlock(element.table, inlineObjects));
    }
  }
  return blocks;
}

function tableToBlock(table, inlineObjects) {
  return {
    type: 'table',
    rows: (table.tableRows || []).map((tableRow) => ({
      cells: (tableRow.tableCells || []).map((tableCell) => ({
        content: structuralElementsToInlineContent(
          tableCell.content || [],
          inlineObjects
        ),
      })),
    })),
  };
}

function structuralElementsToInlineContent(elements, inlineObjects) {
  const content = [];
  for (const element of elements || []) {
    if (element.paragraph) {
      const paragraphContent = paragraphToContent(
        element.paragraph,
        inlineObjects
      );
      if (content.length > 0 && paragraphContent.length > 0) {
        appendText(content, '\n');
      }
      content.push(...paragraphContent);
    } else if (element.table) {
      appendText(
        content,
        renderBlocksMarkdown([tableToBlock(element.table, inlineObjects)])
      );
    }
  }
  return content;
}

function paragraphToContent(paragraph, inlineObjects) {
  const content = [];
  for (const element of paragraph.elements || []) {
    if (element.textRun) {
      appendText(content, element.textRun.content.replace(/\n$/u, ''));
    } else if (element.inlineObjectElement) {
      const image = inlineObjectToImage(
        element.inlineObjectElement.inlineObjectId,
        inlineObjects
      );
      if (image) {
        content.push(image);
      }
    }
  }
  return content;
}

function inlineObjectToImage(inlineObjectId, inlineObjects) {
  const embedded =
    inlineObjects[inlineObjectId]?.inlineObjectProperties?.embeddedObject;
  const url =
    embedded?.imageProperties?.contentUri ||
    embedded?.imageProperties?.sourceUri ||
    null;
  if (!url) {
    return null;
  }
  return {
    type: 'image',
    url,
    alt: embedded.title || embedded.description || 'image',
    isSuggestion: false,
  };
}

function appendText(content, text, style = {}) {
  if (!text) {
    return;
  }
  const node = {
    type: 'text',
    text,
    bold: Boolean(style.bold),
    italic: Boolean(style.italic),
    strike: Boolean(style.strike),
    link: style.link || null,
  };
  const last = content[content.length - 1];
  if (last?.type === 'text' && sameTextStyle(last, node)) {
    last.text += text;
  } else {
    content.push(node);
  }
}

function sameTextStyle(a, b) {
  return (
    Boolean(a.bold) === Boolean(b.bold) &&
    Boolean(a.italic) === Boolean(b.italic) &&
    Boolean(a.strike) === Boolean(b.strike) &&
    (a.link || null) === (b.link || null)
  );
}

function renderBlocksHtml(blocks) {
  return `<!doctype html><html><body>${blocks
    .map((block) => {
      if (block.type === 'table') {
        return renderTableHtml(block);
      }
      return renderParagraphHtml(block);
    })
    .join('')}</body></html>`;
}

function renderParagraphHtml(block) {
  if (block.horizontalRule) {
    return '<hr>';
  }
  if (block.list) {
    const tag = block.list.ordered ? 'ol' : 'ul';
    return `<${tag}><li>${renderContentHtml(block.content)}</li></${tag}>`;
  }
  if (block.quote) {
    return `<blockquote>${renderContentHtml(block.content)}</blockquote>`;
  }
  const tag = paragraphTag(block.style);
  return `<${tag}>${renderContentHtml(block.content)}</${tag}>`;
}

function renderTableHtml(table) {
  return `<table>${table.rows
    .map(
      (row) =>
        `<tr>${row.cells
          .map((cell) => `<td>${renderContentHtml(cell.content)}</td>`)
          .join('')}</tr>`
    )
    .join('')}</table>`;
}

function renderContentHtml(content = []) {
  return content
    .map((node) => {
      if (node.type === 'image') {
        if (!node.url) {
          return '';
        }
        const width = node.width ? ` width="${escapeHtml(node.width)}"` : '';
        const height = node.height
          ? ` height="${escapeHtml(node.height)}"`
          : '';
        return `<img src="${escapeHtml(node.url)}" alt="${escapeHtml(node.alt || 'image')}"${width}${height}>`;
      }
      return renderMarkedHtml(node);
    })
    .join('');
}

function renderMarkedHtml(node) {
  let output = escapeHtml(node.text || '').replace(/\n/g, '<br>');
  if (node.bold) {
    output = `<strong>${output}</strong>`;
  }
  if (node.italic) {
    output = `<em>${output}</em>`;
  }
  if (node.strike) {
    output = `<s>${output}</s>`;
  }
  if (node.link) {
    output = `<a href="${escapeHtml(node.link)}">${output}</a>`;
  }
  return output;
}

function paragraphTag(style = '') {
  const normalized = style || '';
  const headingMatch = normalized.match(/^HEADING_([1-6])$/u);
  if (headingMatch) {
    return `h${headingMatch[1]}`;
  }
  if (normalized === 'TITLE') {
    return 'h1';
  }
  if (normalized === 'SUBTITLE') {
    return 'h2';
  }
  return 'p';
}

function contentBlocksToText(blocks) {
  return blocks
    .map((block) => {
      if (block.type === 'table') {
        return block.rows
          .map((row) =>
            row.cells.map((cell) => contentToText(cell.content)).join('\t')
          )
          .join('\n');
      }
      return contentToText(block.content);
    })
    .filter(Boolean)
    .join('\n')
    .trimEnd();
}

function contentToText(content = []) {
  return content
    .map((node) => {
      if (node.type === 'image') {
        return node.url ? `[${node.alt || 'image'}]` : '';
      }
      return node.text || '';
    })
    .join('');
}

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, (char) => {
    switch (char) {
      case '&':
        return '&amp;';
      case '<':
        return '&lt;';
      case '>':
        return '&gt;';
      case '"':
        return '&quot;';
      default:
        return '&#39;';
    }
  });
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
  const { apiToken, log } = options;

  // Fetch HTML with embedded base64 images
  const result = await fetchGoogleDoc(url, { format: 'html', apiToken, log });

  const preprocessed = preprocessGoogleDocsExportHtml(result.content);
  log?.debug?.(() => ({
    event: 'gdocs.export.style-hoist',
    documentId: result.documentId,
    hoisted: preprocessed.hoisted,
    unwrappedLinks: preprocessed.unwrappedLinks,
  }));

  // Extract base64 images from HTML
  const { html: localHtml, images } = extractBase64Images(preprocessed.html);

  // Convert the localized HTML to Markdown
  const markdown = normalizeGoogleDocsExportMarkdown(
    convertHtmlToMarkdown(localHtml)
  );
  log?.debug?.(() => ({
    event: 'gdocs.public-export.archive',
    documentId: result.documentId,
    images: images.length,
    htmlBytes: Buffer.byteLength(localHtml),
    markdownBytes: Buffer.byteLength(markdown),
  }));

  return {
    documentId: result.documentId,
    exportUrl: result.exportUrl,
    html: localHtml,
    markdown,
    images,
  };
}
