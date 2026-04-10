/**
 * LaTeX formula extraction module.
 *
 * Extracts LaTeX formulas from HTML content, handling multiple sources:
 * - Habr: img.formula elements with `source` attribute
 * - KaTeX: .katex elements with annotation[encoding="application/x-tex"]
 * - MathJax: mjx-container elements with data-tex/data-latex attributes
 *
 * Based on reference implementation from:
 * https://github.com/link-foundation/meta-theory/blob/main/scripts/download-article.mjs
 */

/**
 * Extract LaTeX source from a formula image element (Habr-specific).
 * Habr renders formulas as SVG/PNG images with class "formula".
 * The original LaTeX source is in the `source` attribute.
 *
 * @param {Object} $ - Cheerio instance
 * @param {Object} el - Cheerio element (img.formula)
 * @returns {string|null} LaTeX source or null
 */
export function extractHabrFormula($, el) {
  const source = $(el).attr('source');
  if (source) {
    return source.trim();
  }
  const alt = $(el).attr('alt');
  if (alt) {
    return alt.trim();
  }
  return null;
}

/**
 * Extract LaTeX from KaTeX elements.
 * KaTeX stores the TeX source in annotation[encoding="application/x-tex"].
 *
 * @param {Object} $ - Cheerio instance
 * @param {Object} el - Cheerio element (.katex or .math)
 * @returns {string|null} LaTeX source or null
 */
export function extractKatexFormula($, el) {
  const annotation = $(el).find('annotation[encoding="application/x-tex"]');
  if (annotation.length > 0) {
    return annotation.text().trim();
  }
  const dataTex = $(el).attr('data-tex') || $(el).attr('data-latex');
  if (dataTex) {
    return dataTex.trim();
  }
  return null;
}

/**
 * Extract LaTeX from MathJax elements.
 * MathJax stores TeX in data-tex attribute or annotation elements.
 *
 * @param {Object} $ - Cheerio instance
 * @param {Object} el - Cheerio element (mjx-container)
 * @returns {string|null} LaTeX source or null
 */
export function extractMathJaxFormula($, el) {
  const dataTex = $(el).attr('data-tex') || $(el).attr('data-latex');
  if (dataTex) {
    return dataTex.trim();
  }
  const annotation = $(el).find('annotation[encoding="application/x-tex"]');
  if (annotation.length > 0) {
    return annotation.text().trim();
  }
  return null;
}

/**
 * Check if an element is a formula image (Habr-specific).
 *
 * @param {Object} $ - Cheerio instance
 * @param {Object} el - Cheerio element
 * @returns {boolean}
 */
export function isFormulaImage($, el) {
  return (
    $(el).is('img') &&
    ($(el).hasClass('formula') ||
      $(el).attr('source') !== undefined ||
      ($(el).attr('class') || '').includes('formula'))
  );
}

/**
 * Check if an element is a math element (KaTeX, MathJax, or generic math class).
 *
 * @param {Object} $ - Cheerio instance
 * @param {Object} el - Cheerio element
 * @returns {boolean}
 */
export function isMathElement($, el) {
  const tag = (el.tagName || el.name || '').toLowerCase();
  const classes = $(el).attr('class') || '';
  return (
    classes.includes('katex') ||
    classes.includes('math') ||
    classes.includes('MathJax') ||
    tag === 'mjx-container'
  );
}

/**
 * Extract formula from any supported element type.
 *
 * @param {Object} $ - Cheerio instance
 * @param {Object} el - Cheerio element
 * @returns {string|null} LaTeX source or null
 */
export function extractFormula($, el) {
  if (isFormulaImage($, el)) {
    return extractHabrFormula($, el);
  }
  const tag = (el.tagName || el.name || '').toLowerCase();
  if (tag === 'mjx-container') {
    return extractMathJaxFormula($, el);
  }
  if (isMathElement($, el)) {
    return extractKatexFormula($, el);
  }
  return null;
}
