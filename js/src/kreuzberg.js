/**
 * Kreuzberg html-to-markdown integration module.
 *
 * Provides high-performance HTML to Markdown conversion using the
 * @kreuzberg/html-to-markdown-node library (Rust-powered, 150-280 MB/s).
 *
 * This converter is available as an alternative to the default Turndown-based
 * converter, selectable via the `converter=kreuzberg` query parameter.
 *
 * @module kreuzberg
 * @see https://github.com/kreuzberg-dev/html-to-markdown
 */

import { convertRelativeUrls } from './lib.js';

let _initPromise = null;
let _convert = null;

async function ensureLoaded() {
  if (_convert) {
    return _convert;
  }
  if (_initPromise) {
    return _initPromise;
  }
  _initPromise = import('@kreuzberg/html-to-markdown-node')
    .then((mod) => {
      _convert = mod.convert || mod.default?.convert || null;
      return _convert;
    })
    .catch(() => {
      _convert = null;
      return null;
    });
  return await _initPromise;
}

function toSnakeCase(key) {
  return key.replace(/[A-Z]/g, (match) => `_${match.toLowerCase()}`);
}

/**
 * Recursively normalize object keys to snake_case.
 *
 * Used to give the structured `metadata`, `tables`, and `images` payloads a
 * stable shape regardless of the casing the native binding emits. In
 * particular, inline image `dimensions` are exposed as `{ width, height }` —
 * mirroring the Rust `inline_image_to_json` mapping after the
 * html-to-markdown 3.6 `ImageDimensions` change (see issue #137).
 *
 * @param {*} value - Value to normalize
 * @returns {*} The value with all object keys converted to snake_case
 */
export function normalizeStructuredKeys(value) {
  if (Array.isArray(value)) {
    return value.map(normalizeStructuredKeys);
  }
  if (!value || typeof value !== 'object') {
    return value;
  }

  return Object.fromEntries(
    Object.entries(value).map(([key, entry]) => [
      toSnakeCase(key),
      normalizeStructuredKeys(entry),
    ])
  );
}

/**
 * Check if the kreuzberg converter is available.
 *
 * @returns {Promise<boolean>} Whether the converter is available
 */
export async function isKreuzbergAvailable() {
  const fn = await ensureLoaded();
  return fn !== null;
}

/**
 * Convert HTML to Markdown using the kreuzberg html-to-markdown library.
 *
 * Returns a structured result with content, metadata, tables, images, and warnings.
 *
 * @param {string} html - HTML content to convert
 * @param {Object} [options] - Conversion options
 * @param {string} [options.baseUrl] - Base URL for resolving relative URLs
 * @param {string} [options.headingStyle='Atx'] - Heading style ('Atx' or 'Setext')
 * @param {string} [options.bulletListMarker] - Bullet character ('-', '*', '+')
 * @param {string} [options.codeBlockStyle] - Code block style ('Fenced' or 'Indented')
 * @returns {Promise<Object>} Structured conversion result
 * @returns {string} result.content - The converted markdown content
 * @returns {Object|null} result.metadata - Extracted metadata (title, links, headings, images, etc.)
 * @returns {Array} result.tables - Extracted table data
 * @returns {Array} result.images - Extracted image data
 * @returns {Array} result.warnings - Non-fatal conversion warnings
 * @throws {Error} If the kreuzberg converter is not available
 */
export async function convertWithKreuzberg(html, options = {}) {
  const convert = await ensureLoaded();
  if (!convert) {
    throw new Error(
      'Kreuzberg html-to-markdown is not installed. ' +
        'Run: npm install @kreuzberg/html-to-markdown-node'
    );
  }

  const convertOptions = {
    headingStyle: 'Atx',
    codeBlockStyle: 'Backticks',
    ...options,
  };
  delete convertOptions.baseUrl;

  const processedHtml = options.baseUrl
    ? convertRelativeUrls(html, options.baseUrl)
    : html;
  const result = convert(processedHtml, convertOptions);

  // Parse the metadata JSON string into an object
  let metadata = null;
  if (result.metadata) {
    try {
      metadata =
        typeof result.metadata === 'string'
          ? JSON.parse(result.metadata)
          : result.metadata;
    } catch {
      metadata = null;
    }
  }

  return {
    content: result.content || '',
    metadata: normalizeStructuredKeys(metadata),
    tables: normalizeStructuredKeys(result.tables || []),
    images: normalizeStructuredKeys(result.images || []),
    warnings: result.warnings || [],
  };
}
