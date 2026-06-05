// Google Docs export HTML preprocessor (issue #92 R6).
//
// Google Drive's `/export?format=html` payload serves bold/italic/
// strikethrough as inline `style` spans, numbers headings with
// `<a id><span>1. </span>`, and routes every link through a
// `google.com/url?q=` redirect. The generic Cheerio + Turndown pipeline
// discards those signals, so the browser-less API path loses the
// formatting and gains noisy redirect URLs.
//
// This module rewrites the export HTML into semantic markup before the
// generic converter runs.

import * as cheerio from 'cheerio';

/**
 * Pre-process Google Docs export HTML so the generic Cheerio+Turndown
 * pipeline preserves inline formatting, heading numbers, and link targets.
 *
 * @param {string} html - Raw export HTML returned by Google Docs.
 * @returns {{html: string, hoisted: number, unwrappedLinks: number}}
 */
export function preprocessGoogleDocsExportHtml(html) {
  if (!html || typeof html !== 'string') {
    return { html: html || '', hoisted: 0, unwrappedLinks: 0 };
  }

  const $ = cheerio.load(html, { decodeEntities: false });
  const classStyles = parseCssClassStyles($);
  let hoisted = 0;
  let unwrappedLinks = 0;

  $('span, p').each(function () {
    if (
      this.tagName === 'span' &&
      $(this).closest('h1, h2, h3, h4, h5, h6').length
    ) {
      return;
    }
    const style = combinedElementStyle($, this, classStyles);
    const hasBold = hasBoldStyle(style);
    const hasItalic = hasItalicStyle(style);
    const hasStrike = hasStrikeStyle(style);
    if (!hasBold && !hasItalic && !hasStrike) {
      return;
    }
    const inner = $(this).html() || '';
    let wrapped = inner;
    if (hasStrike) {
      wrapped = `<del>${wrapped}</del>`;
    }
    if (hasItalic) {
      wrapped = `<em>${wrapped}</em>`;
    }
    if (hasBold) {
      wrapped = `<strong>${wrapped}</strong>`;
    }
    if (this.tagName === 'p') {
      $(this).html(wrapped);
    } else {
      $(this).replaceWith(wrapped);
    }
    hoisted += 1;
  });

  splitStrongAtBlockBoundaries($);
  splitParagraphsAtBoldBoundaries($);
  removeEmptyStrong($);
  coalesceAdjacentStrong($);

  groupGoogleDocsBlockquotes($, classStyles);
  nestGoogleDocsLists($, classStyles);
  normalizeGoogleDocsTables($);

  $('a').each(function () {
    const $a = $(this);
    if (!$a.attr('href') && !$a.text().trim() && !$a.find('img').length) {
      $a.remove();
    }
  });

  $('h1, h2, h3, h4, h5, h6').each(function () {
    const $h = $(this);
    $h.find('a').each(function () {
      const $a = $(this);
      if (!$a.attr('href') && !$a.text().trim() && !$a.find('img').length) {
        $a.remove();
      }
    });
    $h.find('> span, > strong > span').each(function () {
      const $span = $(this);
      const text = $span.text();
      if (/^\s*\d+(?:\.\d+)*\.?\s*$/.test(text)) {
        $span.remove();
      }
    });
  });

  $('a[href*="google.com/url?q="]').each(function () {
    const href = String($(this).attr('href') || '');
    const match = href.match(/[?&]q=([^&]+)/);
    if (match) {
      try {
        const decoded = decodeURIComponent(match[1]);
        $(this).attr('href', decoded);
        unwrappedLinks += 1;
      } catch {
        // Leave the original href in place if it can't be decoded.
      }
    }
  });

  $('*').each(function () {
    if (this.type !== 'tag') {
      return;
    }
    $(this)
      .contents()
      .each(function () {
        if (this.type === 'text' && this.data) {
          const replaced = this.data.replace(/\u00A0/g, ' ');
          if (replaced !== this.data) {
            this.data = replaced;
          }
        }
      });
  });

  let rewritten = $.html();
  rewritten = rewritten.replace(/&nbsp;/g, ' ');

  return { html: rewritten, hoisted, unwrappedLinks };
}

/**
 * Normalize Markdown emitted from Google Docs public-export HTML converters.
 *
 * @param {string} markdown - Markdown rendered from preprocessed export HTML.
 * @returns {string}
 */
export function normalizeGoogleDocsExportMarkdown(markdown) {
  if (!markdown || typeof markdown !== 'string') {
    return markdown || '';
  }

  return markdown
    .replace(/\\([.!()[\]])/g, '$1')
    .replace(/(^|[^\w~])~([^~\n]+)~(?=$|[^\w~])/g, '$1~~$2~~')
    .replace(/\n{3,}(?=> )/g, '\n\n')
    .replace(/\n{3,}/g, '\n\n');
}

// Issue #120: a `<strong>` whose closing tag would land in a different block
// boundary leaks bolding across paragraphs and images. Split such a strong
// into multiple bold runs that each stop at the boundary.
function splitStrongAtBlockBoundaries($) {
  let changed = true;
  while (changed) {
    changed = false;
    const offenders = $('strong').filter(function () {
      return $(this).find('br, img, p, div, li').length > 0;
    });
    if (!offenders.length) {
      break;
    }
    offenders.each(function () {
      const $strong = $(this);
      const segments = [];
      let current = [];
      const flush = () => {
        if (current.length) {
          segments.push({ type: 'inline', nodes: current });
          current = [];
        }
      };
      $strong.contents().each(function () {
        if (this.type === 'tag' && this.tagName === 'br') {
          flush();
          segments.push({ type: 'br' });
        } else if (this.type === 'tag' && this.tagName === 'img') {
          flush();
          segments.push({ type: 'img', node: this });
        } else if (
          this.type === 'tag' &&
          ['p', 'div', 'li'].includes(this.tagName)
        ) {
          flush();
          segments.push({ type: 'block', node: this });
        } else {
          current.push(this);
        }
      });
      flush();

      const pieces = segments.map((segment) => {
        if (segment.type === 'br') {
          return '<br>';
        }
        if (segment.type === 'img') {
          return $.html(segment.node);
        }
        if (segment.type === 'block') {
          const inner = $(segment.node).html() || '';
          const tag = segment.node.tagName;
          const innerWrapped = inner.trim() ? `<strong>${inner}</strong>` : '';
          return `<${tag}>${innerWrapped}</${tag}>`;
        }
        const inner = segment.nodes.map((node) => $.html(node)).join('');
        if (!inner.trim()) {
          return inner;
        }
        return `<strong>${inner}</strong>`;
      });
      $strong.replaceWith(pieces.join(''));
      changed = true;
    });
  }
}

// Issue #120: when a `<p>` contains a `<br>` adjacent to a `<strong>` or an
// `<img>`, split it into multiple paragraphs so each bold run and image
// becomes its own block. Without this, the markdown converter renders
// `**Caption**  \n![](x)` (inline) instead of separate blocks.
function splitParagraphsAtBoldBoundaries($) {
  $('p').each(function () {
    const $p = $(this);
    const contents = $p.contents().toArray();
    if (!contents.some((n) => n.type === 'tag' && n.tagName === 'br')) {
      return;
    }
    const hasStrongOrImg = contents.some(
      (n) => n.type === 'tag' && (n.tagName === 'strong' || n.tagName === 'img')
    );
    if (!hasStrongOrImg) {
      return;
    }
    const segments = [];
    let current = [];
    const flush = () => {
      const html = current
        .map((node) => $.html(node))
        .join('')
        .trim();
      if (html) {
        segments.push(html);
      }
      current = [];
    };
    for (const node of contents) {
      if (node.type === 'tag' && node.tagName === 'br') {
        flush();
      } else if (node.type === 'tag' && node.tagName === 'img') {
        flush();
        segments.push($.html(node));
      } else {
        current.push(node);
      }
    }
    flush();
    if (segments.length <= 1) {
      return;
    }
    const replacement = segments.map((html) => `<p>${html}</p>`).join('');
    $p.replaceWith(replacement);
  });
}

// Issue #120: drop empty `<strong></strong>` so they cannot pair with a
// neighbour and emit `****`.
function removeEmptyStrong($) {
  $('strong').each(function () {
    const $strong = $(this);
    if (!$strong.html() || !$strong.text().trim()) {
      if (!$strong.find('img').length) {
        $strong.remove();
      }
    }
  });
}

// Issue #120: merge adjacent `<strong>` siblings (optionally separated by
// whitespace text nodes) into a single `<strong>` so the converter emits
// `**a b**` instead of `**a** **b**`.
function coalesceAdjacentStrong($) {
  let changed = true;
  while (changed) {
    changed = false;
    $('strong').each(function () {
      const $strong = $(this);
      if (!$strong.parent().length) {
        return;
      }
      let sibling = this.next;
      const between = [];
      while (sibling) {
        if (sibling.type === 'text' && /^\s*$/.test(sibling.data || '')) {
          between.push(sibling);
          sibling = sibling.next;
          continue;
        }
        if (sibling.type === 'tag' && sibling.tagName === 'strong') {
          const innerSelf = $strong.html() || '';
          const innerNext = $(sibling).html() || '';
          const joiner = between.map((node) => node.data || '').join('');
          $strong.html(`${innerSelf}${joiner}${innerNext}`);
          for (const node of between) {
            $(node).remove();
          }
          $(sibling).remove();
          changed = true;
          return;
        }
        break;
      }
    });
  }
}

function parseCssClassStyles($) {
  const classStyles = new Map();
  $('style').each(function () {
    const css = $(this).html() || '';
    const classRule = /\.([A-Za-z0-9_-]+)\s*\{([^{}]*)\}/g;
    let match;
    while ((match = classRule.exec(css)) !== null) {
      const [, className, style] = match;
      classStyles.set(
        className,
        `${classStyles.get(className) || ''};${style}`
      );
    }
  });
  return classStyles;
}

function combinedElementStyle($, element, classStyles) {
  const $el = $(element);
  const styles = [String($el.attr('style') || '')];
  const classes = String($el.attr('class') || '')
    .split(/\s+/u)
    .filter(Boolean);
  for (const className of classes) {
    if (classStyles.has(className)) {
      styles.push(classStyles.get(className));
    }
  }
  return styles.join(';');
}

function groupGoogleDocsBlockquotes($, classStyles) {
  const processed = new Set();

  $('p').each(function () {
    if (
      processed.has(this) ||
      !isBlockquoteStyle(combinedElementStyle($, this, classStyles))
    ) {
      return;
    }

    const paragraphs = [];
    let current = $(this);
    while (
      current.length &&
      current[0].tagName === 'p' &&
      isBlockquoteStyle(combinedElementStyle($, current[0], classStyles))
    ) {
      paragraphs.push(current[0]);
      processed.add(current[0]);
      current = current.next();
    }

    const quoteHtml = paragraphs
      .map((paragraph) => `<p>${$(paragraph).html() || ''}</p>`)
      .join('');
    $(paragraphs[0]).before(`<blockquote>${quoteHtml}</blockquote>`);
    for (const paragraph of paragraphs) {
      $(paragraph).remove();
    }
  });
}

function nestGoogleDocsLists($, classStyles) {
  const processed = new Set();

  $('body')
    .children('ul, ol')
    .each(function () {
      if (processed.has(this)) {
        return;
      }

      const group = [this];
      processed.add(this);
      let next = $(this).next();
      while (next.length && ['ul', 'ol'].includes(next[0].tagName)) {
        group.push(next[0]);
        processed.add(next[0]);
        next = next.next();
      }

      if (group.length < 2) {
        return;
      }

      const nested = renderNestedListGroup($, group, classStyles);
      $(group[0]).before(nested);
      for (const list of group) {
        $(list).remove();
      }
    });
}

function renderNestedListGroup($, group, classStyles) {
  let html = '';
  let currentLevel = -1;
  const openTags = [];
  const itemOpen = [];

  const topLevelStart =
    group[0]?.tagName?.toLowerCase() === 'ol'
      ? $(group[0]).attr('start')
      : undefined;
  let topLevelOpened = false;

  const closeItem = (level) => {
    if (itemOpen[level]) {
      html += '</li>';
      itemOpen[level] = false;
    }
  };

  const closeList = (level) => {
    closeItem(level);
    html += `</${openTags[level]}>`;
    openTags[level] = undefined;
  };

  const openList = (level, tagName) => {
    openTags[level] = tagName;
    itemOpen[level] = false;
    if (
      level === 0 &&
      !topLevelOpened &&
      tagName === 'ol' &&
      topLevelStart !== undefined &&
      topLevelStart !== ''
    ) {
      html += `<ol start="${topLevelStart}">`;
      topLevelOpened = true;
    } else {
      if (level === 0) {
        topLevelOpened = true;
      }
      html += `<${tagName}>`;
    }
  };

  for (const list of group) {
    const tagName = list.tagName.toLowerCase();
    $(list)
      .children('li')
      .each(function () {
        const level = googleDocsListItemLevel($, this, classStyles);
        while (currentLevel > level) {
          closeList(currentLevel);
          currentLevel -= 1;
        }

        while (currentLevel < level) {
          currentLevel += 1;
          openList(currentLevel, tagName);
        }

        if (openTags[level] && openTags[level] !== tagName) {
          closeList(level);
          openList(level, tagName);
        } else if (!openTags[level]) {
          openList(level, tagName);
        }

        closeItem(level);
        html += `<li>${$(this).html() || ''}`;
        itemOpen[level] = true;

        for (let deeper = level + 1; deeper < itemOpen.length; deeper += 1) {
          itemOpen[deeper] = false;
          openTags[deeper] = undefined;
        }
      });
  }

  while (currentLevel >= 0) {
    closeList(currentLevel);
    currentLevel -= 1;
  }

  return html;
}

function googleDocsListItemLevel($, li, classStyles) {
  const style = combinedElementStyle($, li, classStyles);
  const marginLeft = numericCssPointValue(style, 'margin-left');
  if (marginLeft <= 0) {
    return 0;
  }
  return Math.max(0, Math.round((marginLeft - 36) / 36));
}

function normalizeGoogleDocsTables($) {
  $('table').each(function () {
    const $table = $(this);
    const rows = $table.find('tr').toArray();
    if (!rows.length) {
      return;
    }

    const $cleanTable = $('<table></table>');
    const $thead = $('<thead></thead>');
    const $tbody = $('<tbody></tbody>');

    rows.forEach((row, rowIndex) => {
      const $tr = $('<tr></tr>');
      $(row)
        .children('td, th')
        .each(function () {
          const tagName = rowIndex === 0 ? 'th' : 'td';
          const $cell = $(`<${tagName}></${tagName}>`);
          $cell.html(inlineTableCellHtml($, this));
          $tr.append($cell);
        });

      if (!$tr.children().length) {
        return;
      }
      if (rowIndex === 0) {
        $thead.append($tr);
      } else {
        $tbody.append($tr);
      }
    });

    if ($thead.children().length) {
      $cleanTable.append($thead);
    }
    if ($tbody.children().length) {
      $cleanTable.append($tbody);
    }

    $table.replaceWith($cleanTable);
  });
}

function inlineTableCellHtml($, cell) {
  const parts = [];
  $(cell)
    .contents()
    .each(function () {
      if (this.type === 'tag' && ['p', 'div'].includes(this.tagName)) {
        const inner = $(this).html() || '';
        if (inner.trim()) {
          parts.push(inner);
        }
        return;
      }
      if (this.type === 'tag') {
        parts.push($.html(this));
        return;
      }
      if (this.type === 'text' && this.data.trim()) {
        parts.push(this.data);
      }
    });
  return parts.join('<br><br>');
}

function hasBoldStyle(style) {
  return /font-weight\s*:\s*(?:bold|[6-9]\d{2})/i.test(style);
}

function hasItalicStyle(style) {
  return /font-style\s*:\s*italic/i.test(style);
}

function hasStrikeStyle(style) {
  return /text-decoration[^;]*\bline-through\b/i.test(style);
}

function isBlockquoteStyle(style) {
  const marginLeft = numericCssPointValue(style, 'margin-left');
  const marginRight = numericCssPointValue(style, 'margin-right');
  return (
    marginLeft > 0 &&
    marginRight > 0 &&
    Math.abs(marginLeft - marginRight) < 0.1
  );
}

function numericCssPointValue(style, property) {
  const match = style.match(
    new RegExp(`${property}\\s*:\\s*(-?\\d+(?:\\.\\d+)?)pt`, 'i')
  );
  return match ? Number(match[1]) : 0;
}
