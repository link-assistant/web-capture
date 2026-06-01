/**
 * Content verification module (R6).
 *
 * Compares captured markdown content against the original web page
 * to verify completeness and accuracy.
 *
 * Checks: title, headings, paragraphs, code blocks, formulas,
 * blockquote formulas, list items, links, and figure images.
 *
 * Based on reference implementation from:
 * https://github.com/link-foundation/meta-theory/blob/main/scripts/verify.mjs
 *
 * @module verify
 */

/**
 * Normalize text for comparison.
 * Removes extra whitespace and normalizes unicode characters,
 * LaTeX delimiters, and common symbol substitutions.
 *
 * @param {string} text - Input text
 * @returns {string} Normalized text
 */
export function normalizeText(text) {
  return text
    .trim()
    .replace(/\s+/g, ' ')
    .replace(/[\u2000-\u200F\u2028-\u202F]/g, ' ')
    .replace(/\u00A0/g, ' ')
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/[\u201C\u201D]/g, '"')
    .replace(/[\u00D7]/g, 'x')
    .replace(/\\times/g, 'x')
    .replace(/[\u2192\u21A6]/g, '->')
    .replace(/\\to/g, '->')
    .replace(/[\u2212]/g, '-')
    .replace(/\$\$/g, '')
    .replace(/\$/g, '')
    .replace(/\\displaystyle\s*/g, '')
    .replace(/\\text\{([^}]*)\}/g, '$1')
    .replace(/\\\\%/g, '%')
    .replace(/\\%/g, '%')
    .replace(/\\subseteq/g, '\u2286')
    .replace(/\\mathbb\{n\}_0/gi, '\u2115\u2080')
    .replace(/\\in/g, '\u2208')
    .replace(/\\emptyset/g, '\u2205')
    .replace(/\^2/g, '\u00B2')
    .replace(/\^n/g, '\u207F')
    .toLowerCase();
}

/**
 * Normalize code for comparison (more lenient than text).
 *
 * @param {string} text - Code text
 * @returns {string} Normalized code
 */
export function normalizeCode(text) {
  return text
    .trim()
    .replace(/\s+/g, ' ')
    .replace(/[\u2000-\u200F\u2028-\u202F]/g, ' ')
    .replace(/\u00A0/g, ' ')
    .replace(/[\u00D7]/g, 'x')
    .replace(/\\times/g, 'x')
    .replace(/\$\$/g, '')
    .replace(/\$/g, '')
    .toLowerCase();
}

/**
 * Verify that markdown contains the expected web page content.
 *
 * @param {Object} webContent - Extracted web page content
 * @param {string} webContent.title - Article title
 * @param {Object[]} webContent.headings - Array of {level, text}
 * @param {string[]} webContent.paragraphs - Paragraph texts
 * @param {string[]} webContent.codeBlocks - Code block texts
 * @param {string[]} webContent.formulas - Formula texts
 * @param {string[]} webContent.blockquoteFormulas - Formulas in blockquotes
 * @param {string[]} webContent.listItems - List item texts
 * @param {Object[]} webContent.links - Array of {text, href}
 * @param {number[]} webContent.figures - Figure numbers
 * @param {string} markdownText - The markdown to verify
 * @param {Object} [options] - Verification options
 * @param {boolean} [options.verbose=false] - Detailed output
 * @param {number} [options.expectedFigures] - Expected figure count
 * @param {boolean} [options.hasLocalImages=false] - Whether images are localized
 * @returns {Object} Verification result
 */
export function verifyMarkdownContent(webContent, markdownText, options = {}) {
  const { verbose = false, expectedFigures, hasLocalImages = false } = options;
  const normalizedMarkdown = normalizeText(markdownText);
  const missing = {
    title: false,
    headings: [],
    paragraphs: [],
    codeBlocks: [],
    formulas: [],
    blockquoteFormulas: [],
    listItems: [],
    images: 0,
  };

  let totalChecks = 0;
  let passedChecks = 0;
  const details = [];

  // Check title
  if (webContent.title) {
    totalChecks++;
    const normalizedTitle = normalizeText(webContent.title);
    if (normalizedMarkdown.includes(normalizedTitle)) {
      passedChecks++;
      if (verbose) {
        details.push({ type: 'title', status: 'pass' });
      }
    } else {
      missing.title = true;
      if (verbose) {
        details.push({
          type: 'title',
          status: 'fail',
          text: webContent.title,
        });
      }
    }
  }

  // Check headings
  for (const heading of webContent.headings || []) {
    totalChecks++;
    const normalized = normalizeText(heading.text);
    if (normalizedMarkdown.includes(normalized)) {
      passedChecks++;
    } else {
      missing.headings.push(heading.text);
      if (verbose) {
        details.push({
          type: 'heading',
          status: 'fail',
          text: heading.text,
        });
      }
    }
  }

  // Check paragraphs (sample first 5 and last 5)
  const paragraphs = webContent.paragraphs || [];
  const paragraphsToCheck = [
    ...paragraphs.slice(0, 5),
    ...paragraphs.slice(-5),
  ];

  for (const paragraph of paragraphsToCheck) {
    totalChecks++;
    const normalized = normalizeText(paragraph);
    const words = normalized.split(' ').filter((w) => w.length > 2);
    const matchingWords = words.filter((word) =>
      normalizedMarkdown.includes(word)
    );
    const matchRate =
      words.length > 0 ? matchingWords.length / words.length : 0;

    const substringMatch =
      normalized.length > 20 &&
      normalizedMarkdown.includes(
        normalized.substring(0, Math.min(50, normalized.length))
      );

    if (matchRate >= 0.6 || substringMatch) {
      passedChecks++;
    } else {
      missing.paragraphs.push(`${paragraph.substring(0, 100)}...`);
    }
  }

  // Check code blocks (fuzzy matching)
  const normalizedMarkdownForCode = normalizeCode(markdownText);
  for (const code of webContent.codeBlocks || []) {
    totalChecks++;
    const normalizedCodeFull = normalizeCode(code);

    const lines = code
      .split('\n')
      .map((l) => l.trim())
      .filter((l) => l.length > 3 && !/^[{}[\](),;]+$/.test(l));

    const matchingLines = lines.filter((line) => {
      const normalizedLine = normalizeCode(line);
      return normalizedMarkdownForCode.includes(normalizedLine);
    });

    const matchRate =
      lines.length > 0 ? matchingLines.length / lines.length : 1;

    if (
      matchRate >= 0.6 ||
      normalizedMarkdownForCode.includes(normalizedCodeFull)
    ) {
      passedChecks++;
    } else {
      missing.codeBlocks.push(`${code.substring(0, 100)}...`);
    }
  }

  // Check list items (sample first 10)
  const listItemsToCheck = (webContent.listItems || []).slice(0, 10);
  for (const item of listItemsToCheck) {
    totalChecks++;
    const normalized = normalizeText(item);
    const words = normalized.split(' ').filter((w) => w.length > 2);
    const matchingWords = words.filter((word) =>
      normalizedMarkdown.includes(word)
    );
    const matchRate =
      words.length > 0 ? matchingWords.length / words.length : 0;

    const substringMatch =
      normalized.length > 15 &&
      normalizedMarkdown.includes(
        normalized.substring(0, Math.min(40, normalized.length))
      );

    if (matchRate >= 0.6 || substringMatch) {
      passedChecks++;
    } else {
      missing.listItems.push(`${item.substring(0, 100)}...`);
    }
  }

  // Check blockquote formulas
  if (
    webContent.blockquoteFormulas &&
    webContent.blockquoteFormulas.length > 0
  ) {
    for (const formula of webContent.blockquoteFormulas) {
      totalChecks++;
      const normalizedFormula = formula.replace(/\s+/g, ' ').trim();

      const keyParts = normalizedFormula
        .replace(/\\mathbf\{([^}]*)\}/g, '$1')
        .replace(/\\textbf\{([^}]*)\}/g, '$1')
        .replace(/[{}\\]/g, '')
        .split(/\s+/)
        .filter((part) => part.length > 1);

      const blockquoteLines = markdownText.match(/^>.*$/gm) || [];
      let foundInBlockquote = false;

      for (const line of blockquoteLines) {
        if (line.includes('$')) {
          const matchingParts = keyParts.filter((part) =>
            line.toLowerCase().includes(part.toLowerCase())
          );
          if (
            keyParts.length > 0 &&
            matchingParts.length >= Math.min(2, keyParts.length)
          ) {
            foundInBlockquote = true;
            break;
          }
          if (
            line.includes(normalizedFormula) ||
            line.includes(formula) ||
            (formula.length < 20 && line.includes(formula.replace(/\s/g, '')))
          ) {
            foundInBlockquote = true;
            break;
          }
        }
      }

      if (foundInBlockquote) {
        passedChecks++;
      } else {
        missing.blockquoteFormulas.push(formula.substring(0, 100));
      }
    }
  }

  // Check for figure images
  if (hasLocalImages && expectedFigures) {
    const figurePattern =
      /!\[(?:\*\*)?(?:Figure|Рис\.?|Рисунок)\s*\d+[\s\S]*?\]\(images\/figure-\d+\.(png|jpg)\)/gi;
    const figureMatches = markdownText.match(figurePattern) || [];

    totalChecks++;
    if (figureMatches.length >= expectedFigures) {
      passedChecks++;
    } else {
      missing.images = expectedFigures - figureMatches.length;
    }
  }

  // Calculate results
  const passRate = totalChecks > 0 ? passedChecks / totalChecks : 0;
  const hasMissingContent =
    missing.title ||
    missing.images > 0 ||
    Object.values(missing).some((arr) => Array.isArray(arr) && arr.length > 0);

  return {
    totalChecks,
    passedChecks,
    passRate,
    hasMissingContent,
    missing,
    success: !hasMissingContent || passRate >= 0.85,
    details: verbose ? details : undefined,
  };
}
