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
      _convert = mod.convert;
      return _convert;
    })
    .catch(() => {
      _convert = null;
      return null;
    });
  return await _initPromise;
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

  const result = convert(html, convertOptions);

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
    metadata,
    tables: result.tables || [],
    images: result.images || [],
    warnings: result.warnings || [],
  };
}
