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

const GDOCS_URL_PATTERN = /docs\.google\.com\/document\/d\/([a-zA-Z0-9_-]+)/;

const GDOCS_EXPORT_BASE = 'https://docs.google.com/document/d';
const GDOCS_API_BASE = 'https://docs.googleapis.com/v1/documents';
const DEFAULT_USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';
const GDOCS_BROWSER_MODEL_UNAVAILABLE = 'GDOCS_BROWSER_MODEL_UNAVAILABLE';

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

  const markdown = convertHtmlToMarkdown(result.content, result.exportUrl);
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
 * format. This is used as the lossless fallback when browser-model capture
 * cannot read DOCS_modelChunk data from the editor page.
 *
 * @param {string} url - Google Docs URL
 * @param {Object} [options] - Options
 * @param {string} [options.format='markdown'] - Requested CLI output format
 * @param {string} [options.apiToken] - API token for private documents
 * @param {Object} [options.log] - Optional logger
 * @returns {Promise<Object>} Export result normalized for CLI rendering
 */
export async function fetchGoogleDocByExportFormat(url, options = {}) {
  const { format = 'markdown', apiToken, log } = options;
  const normalized = (format || 'markdown').toLowerCase();

  if (normalized === 'archive' || normalized === 'zip') {
    const archiveResult = await fetchGoogleDocAsArchive(url, { apiToken, log });
    return {
      ...archiveResult,
      content: archiveResult.markdown,
      sourceFormat: 'archive',
    };
  }

  if (normalized === 'markdown' || normalized === 'md') {
    const result = await fetchGoogleDocAsMarkdown(url, { apiToken, log });
    return {
      ...result,
      content: result.markdown,
      sourceFormat: 'markdown',
    };
  }

  if (normalized === 'html') {
    const result = await fetchGoogleDoc(url, {
      format: 'html',
      apiToken,
      log,
    });
    return {
      ...result,
      html: result.content,
      sourceFormat: 'html',
    };
  }

  if (normalized === 'txt' || normalized === 'text') {
    const result = await fetchGoogleDoc(url, {
      format: 'txt',
      apiToken,
      log,
    });
    return {
      ...result,
      text: result.content,
      sourceFormat: 'txt',
    };
  }

  throw new Error(
    `Unsupported Google Docs export fallback format "${format}".`
  );
}

/**
 * Capture a Google Doc through the browser model, falling back to public export
 * when the editor does not expose model chunks.
 *
 * @param {string} url - Google Docs URL
 * @param {Object} [options] - Capture options
 * @param {string} [options.format='markdown'] - Requested output format
 * @param {boolean} [options.fallback=true] - Whether to use export fallback
 * @param {Function} [options.onFallback] - Called with browser error
 * @returns {Promise<Object>} Browser-model or public-export result
 */
export async function captureGoogleDocWithBrowserOrFallback(url, options = {}) {
  const {
    format = 'markdown',
    fallback = true,
    onFallback,
    ...browserOptions
  } = options;

  try {
    const result = await captureGoogleDocWithBrowser(url, browserOptions);
    return {
      ...result,
      method: 'browser-model',
      fallback: false,
    };
  } catch (err) {
    if (!fallback || !isGoogleDocsBrowserModelUnavailableError(err)) {
      throw err;
    }

    onFallback?.(err);
    browserOptions.log?.warn?.(() => ({
      event: 'gdocs.browser-model.fallback-public-export',
      reason: err.message,
      format,
    }));

    const result = await fetchGoogleDocByExportFormat(url, {
      format,
      apiToken: browserOptions.apiToken,
      log: browserOptions.log,
    });
    return {
      ...result,
      method: 'public-export',
      fallback: true,
      browserError: err.message,
    };
  }
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
      const chunks = window.__captured_chunks || [];
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
      modelData.cidUrlMap
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

/**
 * Check whether an error means Google Docs browser-model data was unavailable.
 *
 * @param {Error} err - Error to classify
 * @returns {boolean} True if export fallback is appropriate
 */
export function isGoogleDocsBrowserModelUnavailableError(err) {
  return (
    err?.code === GDOCS_BROWSER_MODEL_UNAVAILABLE ||
    String(err?.message || '').includes('did not expose DOCS_modelChunk data')
  );
}

function googleDocsBrowserModelUnavailableError(message) {
  const err = new Error(message);
  err.code = GDOCS_BROWSER_MODEL_UNAVAILABLE;
  return err;
}

async function installDocsModelCapture(page) {
  const initScript = () => {
    window.__captured_chunks = [];
    Object.defineProperty(window, 'DOCS_modelChunk', {
      set(value) {
        try {
          window.__captured_chunks.push(JSON.parse(JSON.stringify(value)));
        } catch {
          window.__captured_chunks.push(value);
        }
        window.__DOCS_modelChunk_latest = value;
      },
      get() {
        return window.__DOCS_modelChunk_latest;
      },
      configurable: true,
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
 * @returns {{blocks: Array, tables: Array, images: Array, text: string}}
 */
export function parseGoogleDocsModelChunks(chunks = [], cidUrlMap = {}) {
  const items = collectModelItems(chunks);
  const fullText = items
    .filter((item) => item.ty === 'is' || item.ty === 'iss')
    .map((item) => item.s || '')
    .join('');

  const positions = new Map();
  for (const item of items) {
    if ((item.ty === 'te' || item.ty === 'ste') && item.id) {
      positions.set(item.id, Number(item.spi));
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
      alt: item.ty === 'ase' ? 'suggested image' : 'image',
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

  const flushParagraph = () => {
    const text = contentToText(paragraph).trim();
    if (text || paragraph.some((node) => node.type === 'image')) {
      blocks.push({ type: 'paragraph', content: paragraph });
    }
    paragraph = [];
  };

  const flushCell = () => {
    if (cell && row) {
      row.cells.push(cell);
    }
    cell = null;
  };

  const flushRow = () => {
    flushCell();
    if (row && table) {
      table.rows.push(row);
    }
    row = null;
  };

  const flushTable = () => {
    flushRow();
    if (table) {
      tables.push(table);
      blocks.push(table);
    }
    table = null;
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
      flushParagraph();
      table = { type: 'table', rows: [] };
      continue;
    }
    if (code === 0x11) {
      flushTable();
      continue;
    }
    if (code === 0x12) {
      flushRow();
      row = { cells: [] };
      continue;
    }
    if (code === 0x1c) {
      flushCell();
      if (!row) {
        row = { cells: [] };
      }
      cell = { content: [] };
      continue;
    }
    if (code === 0x0a) {
      if (table) {
        flushRow();
      } else {
        flushParagraph();
      }
      continue;
    }
    if (code === 0x0b) {
      appendText(targetContent(), '\n');
      continue;
    }

    const image = imagesByPos.get(i);
    if (image) {
      targetContent().push(image);
      if (fullText[i] === '*') {
        continue;
      }
    }

    appendText(targetContent(), fullText[i]);
  }

  if (table) {
    flushTable();
  }
  flushParagraph();

  return {
    blocks,
    tables,
    images,
    text: contentBlocksToText(blocks),
  };
}

function collectModelItems(chunks) {
  const items = [];
  for (const chunk of chunks || []) {
    if (Array.isArray(chunk)) {
      items.push(...chunk);
    } else if (Array.isArray(chunk?.chunk)) {
      items.push(...chunk.chunk);
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

function appendText(content, text) {
  if (!text) {
    return;
  }
  const last = content[content.length - 1];
  if (last?.type === 'text') {
    last.text += text;
  } else {
    content.push({ type: 'text', text });
  }
}

function renderBlocksMarkdown(blocks) {
  return blocks
    .map((block) => {
      if (block.type === 'table') {
        return renderTableMarkdown(block);
      }
      return renderParagraphMarkdown(block);
    })
    .filter(Boolean)
    .join('\n\n')
    .trimEnd();
}

function renderParagraphMarkdown(block) {
  const text = renderContentMarkdown(block.content).trim();
  const style = block.style || '';
  const headingMatch = style.match(/^HEADING_(\d)$/u);
  if (headingMatch) {
    return `${'#'.repeat(Number(headingMatch[1]))} ${text}`;
  }
  if (style === 'TITLE') {
    return `# ${text}`;
  }
  if (style === 'SUBTITLE') {
    return `## ${text}`;
  }
  return text;
}

function renderTableMarkdown(table) {
  if (!table.rows.length) {
    return '';
  }
  const width = Math.max(...table.rows.map((row) => row.cells.length), 1);
  const rows = table.rows.map((row) =>
    Array.from({ length: width }, (_, idx) =>
      escapeMarkdownTableCell(
        renderContentMarkdown(row.cells[idx]?.content || [])
      )
    )
  );
  const separator = Array.from({ length: width }, () => '---');
  return [rows[0], separator, ...rows.slice(1)]
    .map((row) => `| ${row.join(' | ')} |`)
    .join('\n');
}

function renderContentMarkdown(content = []) {
  return content
    .map((node) => {
      if (node.type === 'image') {
        return node.url ? `![${node.alt || 'image'}](${node.url})` : '';
      }
      return node.text || '';
    })
    .join('');
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
      return escapeHtml(node.text || '').replace(/\n/g, '<br>');
    })
    .join('');
}

function paragraphTag(style = '') {
  const headingMatch = style.match(/^HEADING_([1-6])$/u);
  if (headingMatch) {
    return `h${headingMatch[1]}`;
  }
  if (style === 'TITLE') {
    return 'h1';
  }
  if (style === 'SUBTITLE') {
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

function escapeMarkdownTableCell(value) {
  return String(value).replace(/\|/g, '\\|').replace(/\n/g, '<br>');
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

  // Extract base64 images from HTML
  const { html: localHtml, images } = extractBase64Images(result.content);

  // Convert the localized HTML to Markdown
  const markdown = convertHtmlToMarkdown(localHtml);
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
