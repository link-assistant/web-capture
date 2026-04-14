/**
 * Markdown post-processing pipeline.
 *
 * Applies a series of text transformations to improve markdown quality:
 * - Unicode normalization (non-breaking spaces, curly quotes, dashes)
 * - LaTeX formula spacing fixes for GitHub rendering
 * - Bold formatting cleanup
 * - Percent sign fix for GitHub KaTeX
 *
 * Based on reference implementation from:
 * https://github.com/link-foundation/meta-theory/blob/main/scripts/download-article.mjs
 *
 * @module postprocess
 */

/**
 * Apply all post-processing transformations to markdown text.
 *
 * @param {string} markdown - Raw markdown text
 * @param {Object} [options] - Processing options
 * @param {boolean} [options.normalizeUnicode=true] - Normalize unicode characters
 * @param {boolean} [options.fixLatexSpacing=true] - Fix spacing around LaTeX formulas
 * @param {boolean} [options.fixBoldFormatting=true] - Clean up bold formatting artifacts
 * @param {boolean} [options.fixPercentSign=true] - Fix percent signs in formulas
 * @returns {string} Post-processed markdown
 */
export function postProcessMarkdown(markdown, options = {}) {
  const {
    normalizeUnicode = true,
    fixLatexSpacing = true,
    fixBoldFormatting = true,
    fixPercentSign = true,
  } = options;

  let result = markdown;

  if (normalizeUnicode) {
    result = applyUnicodeNormalization(result);
  }

  if (fixLatexSpacing) {
    result = applyLatexSpacingFixes(result);
  }

  if (fixPercentSign) {
    result = applyPercentSignFix(result);
  }

  if (fixBoldFormatting) {
    result = applyBoldFormattingFixes(result);
  }

  // Fix double spaces (but not in code blocks)
  result = result.replace(/([^\n`]) +/g, (match, char) => `${char} `);

  // Clean up extra spaces around em-dashes
  result = result.replace(/\s+—\s+/g, ' — ');

  // Fix stray standalone $ signs on their own line
  result = result.replace(/^\$\s*$/gm, '');

  return result;
}

/**
 * Normalize unicode characters for consistent rendering.
 *
 * @param {string} text - Input text
 * @returns {string} Normalized text
 */
export function applyUnicodeNormalization(text) {
  let result = text;

  // Preserve non-breaking spaces as &nbsp; entities for clear marking
  result = result.replace(/\u00A0/g, '&nbsp;');

  // Normalize curly quotes to straight quotes
  result = result.replace(/[\u2018\u2019]/g, "'");
  result = result.replace(/[\u201C\u201D]/g, '"');

  // Normalize em-dash and en-dash
  result = result.replace(/\u2014/g, ' \u2014 '); // em-dash with spaces
  result = result.replace(/\u2013/g, '-'); // en-dash to hyphen

  // Normalize ellipsis
  result = result.replace(/\u2026/g, '...');

  return result;
}

/**
 * Fix spacing around inline LaTeX formulas for GitHub rendering.
 * Uses a line-by-line token-based approach to correctly identify
 * opening/closing $ delimiters.
 *
 * @param {string} text - Input text
 * @returns {string} Text with fixed formula spacing
 */
export function applyLatexSpacingFixes(text) {
  return text
    .split('\n')
    .map((line) => {
      // Skip block formula lines ($$...$$) and blockquote block formulas
      const trimmedLine = line.replace(/^>\s*/, '');
      if (trimmedLine.startsWith('$$') && trimmedLine.endsWith('$$')) {
        return line;
      }

      // Find all inline formula spans by tracking $ delimiters
      const formulas = [];
      let i = 0;
      while (i < line.length) {
        if (line[i] === '$' && (i === 0 || line[i - 1] !== '\\')) {
          // Skip $$ block delimiters
          if (line[i + 1] === '$') {
            i += 2;
            continue;
          }
          // Found opening $, find closing $
          const start = i;
          i++;
          while (i < line.length && (line[i] !== '$' || line[i - 1] === '\\')) {
            i++;
          }
          if (i < line.length) {
            formulas.push({ start, end: i });
            i++;
          }
        } else {
          i++;
        }
      }

      if (formulas.length === 0) {
        return line;
      }

      // Build the line with fixes applied
      let fixed = '';
      let pos = 0;
      for (const f of formulas) {
        fixed += line.substring(pos, f.start);

        const rawInner = line.substring(f.start + 1, f.end);
        const inner = rawInner.trim();

        // Add space before formula if preceded by word char, comma, colon, etc.
        if (
          fixed.length > 0 &&
          /[a-zA-Z\u0430-\u044F\u0410-\u042F\u0451\u0401,:;\u00BB)\]]$/.test(
            fixed
          )
        ) {
          fixed += ' ';
        }

        fixed += `$${inner}$`;

        // Add space after formula if followed by word character
        const afterPos = f.end + 1;
        if (
          afterPos < line.length &&
          /^[a-zA-Z\u0430-\u044F\u0410-\u042F\u0451\u0401]/.test(line[afterPos])
        ) {
          fixed += ' ';
        }

        pos = f.end + 1;
      }
      fixed += line.substring(pos);

      return fixed;
    })
    .join('\n');
}

/**
 * Fix percent sign in inline formulas for GitHub KaTeX rendering.
 * GitHub's KaTeX treats % as a LaTeX comment character.
 * Workaround: use \\% which GitHub's preprocessor converts to \%.
 *
 * @param {string} text - Input text
 * @returns {string} Text with fixed percent signs
 */
export function applyPercentSignFix(text) {
  let result = text;
  result = result.replace(/\$(\d+)\\+%\$/g, '$$$1\\\\%$$');
  result = result.replace(/\$(\d+)\\text\{%\}\$/g, '$$$1\\\\%$$');
  return result;
}

/**
 * Clean up bold formatting artifacts from HTML-to-markdown conversion.
 *
 * @param {string} text - Input text
 * @returns {string} Text with cleaned bold formatting
 */
export function applyBoldFormattingFixes(text) {
  let result = text;

  // Remove empty bold markers
  result = result.replace(/(\S)\*\*[^\S\n]*\*\*(\S)/g, '$1 $2');
  result = result.replace(/\*\*[^\S\n]*\*\*/g, '');

  // Fix bold marker spacing: trim content inside **...**
  result = result
    .split('\n')
    .map((line) => {
      const parts = [];
      let lastIndex = 0;
      const boldRegex = /\*\*(.+?)\*\*/g;
      let m;
      while ((m = boldRegex.exec(line)) !== null) {
        parts.push({
          type: 'text',
          content: line.substring(lastIndex, m.index),
        });
        parts.push({ type: 'bold', content: m[1].trim() });
        lastIndex = m.index + m[0].length;
      }
      parts.push({
        type: 'text',
        content: line.substring(lastIndex),
      });

      if (parts.filter((p) => p.type === 'bold').length === 0) {
        return line;
      }

      let rebuilt = '';
      for (let i = 0; i < parts.length; i++) {
        const part = parts[i];
        if (part.type === 'bold') {
          if (!part.content) {
            continue;
          }
          if (
            rebuilt.length > 0 &&
            /[a-zA-Z\u0430-\u044F\u0410-\u042F\u0451\u04010-9).]$/.test(rebuilt)
          ) {
            rebuilt += ' ';
          }
          rebuilt += `**${part.content}**`;
          const nextPart = parts[i + 1];
          if (
            nextPart &&
            nextPart.content &&
            /^[a-zA-Z\u0430-\u044F\u0410-\u042F\u0451\u0401[(]/.test(
              nextPart.content
            )
          ) {
            rebuilt += ' ';
          }
        } else {
          rebuilt += part.content;
        }
      }
      return rebuilt;
    })
    .join('\n');

  return result;
}
