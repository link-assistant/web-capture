/* eslint-disable no-useless-escape */
// Common logic for the web-capture microservice
import fetch from 'node-fetch';
import * as cheerio from 'cheerio';
import TurndownService from 'turndown';
import iconv from 'iconv-lite';
import { URL } from 'url';
import turndownPluginGfm from 'turndown-plugin-gfm';
import he from 'he';
import { isFormulaImage, isMathElement, extractFormula } from './latex.js';
import { extractMetadata } from './metadata.js';
import { postProcessMarkdown } from './postprocess.js';

export async function fetchHtml(url) {
  if (!url) {
    throw new Error('Missing URL parameter');
  }
  const response = await fetch(url);
  return response.text();
}

export function convertHtmlToMarkdown(html, baseUrl) {
  // Ensure all URLs are absolute before Markdown conversion
  if (baseUrl) {
    html = convertRelativeUrls(html, baseUrl);
  }
  // Load HTML into Cheerio
  const $ = cheerio.load(html);

  // Remove <style>, <script>, and <noscript> tags
  $('style, script, noscript').remove();

  // Remove inline event handlers (attributes starting with 'on')
  $('*').each(function () {
    const attribs = this.attribs || {};
    Object.keys(attribs).forEach((attr) => {
      if (attr.toLowerCase().startsWith('on')) {
        $(this).removeAttr(attr);
      }
    });
  });
  // Remove javascript: links
  $('a[href^="javascript:"]').remove();

  // Remove inline style attributes
  $('[style]').removeAttr('style');

  // Remove empty headings (h1-h2) and headings with only whitespace
  $('h1, h2, h3, h4, h5, h6').each(function () {
    if (!$(this).text().trim()) {
      $(this).remove();
    }
  });

  // Preserve hierarchical heading numbering in source text (e.g. 13, 13.1).
  // 1) <ol><li><hN>13. Foo</hN></li></ol> → <ol start="13"><li><hN>Foo</hN></li></ol>
  //    Then Turndown emits "13.  #### Foo" instead of restarting at "1.".
  // 2) <hN>13.1 Bar</hN> (sub-numbering with decimal) → <p><strong>13.1 Bar</strong></p>
  //    Demoting avoids ATX heading prefix, leaving the sub-number on a clean line.
  preserveLeadingHeadingNumbering($);

  // Number consecutive top-level <ol>s continuously across the document
  // (1, 2, 3 ... N) so JS and Rust agree. <ol start="N"> resets the counter.
  applyContinuousOrderedListNumbering($);

  // Remove <a> tags with no direct text content (including only whitespace or only child elements)
  $('a').each(function () {
    // Get all text nodes directly under this <a>
    const directText = $(this)
      .contents()
      .filter(function () {
        return this.type === 'text';
      })
      .text();
    // If no direct text and all children are empty or whitespace, remove the <a>
    if (!directText.trim()) {
      // Also check if all children are empty or whitespace
      let allChildrenEmpty = true;
      $(this)
        .children()
        .each(function () {
          if (
            $(this).text().trim() ||
            (this.tagName === 'img' && $(this).attr('alt'))
          ) {
            allChildrenEmpty = false;
          }
        });
      if (allChildrenEmpty) {
        $(this).remove();
      }
    }
  });

  // Remove <a> tags with only <img> as child and no alt text
  $('a').each(function () {
    const children = $(this).children();
    if (
      children.length === 1 &&
      children[0].tagName === 'img' &&
      !$(children[0]).attr('alt')
    ) {
      $(this).remove();
    }
  });

  // Remove any leftover empty <a> tags
  $('a').each(function () {
    if (!$(this).text().trim()) {
      $(this).remove();
    }
  });

  // Remove any leftover empty elements (optional, for robustness)
  $('[data-remove-empty]').each(function () {
    if (!$(this).text().trim()) {
      $(this).remove();
    }
  });

  // Preprocess ARIA role-based tables to semantic tables with <thead> and <tbody>
  $('[role="table"]').each(function () {
    const $table = $(this);
    const $newTable = $('<table></table>');
    // Add caption if present
    const label = $table.attr('aria-label');
    const descId = $table.attr('aria-describedby');
    if (label) {
      $newTable.append(`<caption>${label}</caption>`);
    } else if (descId && $(`#${descId}`).length) {
      $newTable.append(`<caption>${$(`#${descId}`).text()}</caption>`);
    }
    const rowgroups = $table.find('> [role="rowgroup"]');
    if (rowgroups.length > 0) {
      // First rowgroup is header
      const $thead = $('<thead></thead>');
      const $tbody = $('<tbody></tbody>');
      rowgroups.each(function (i) {
        $(this)
          .find('> [role="row"]')
          .each(function () {
            const $row = $(this);
            const $tr = $('<tr></tr>');
            $row.children('[role="columnheader"]').each(function () {
              $tr.append($('<th></th>').text($(this).text()));
            });
            $row.children('[role="cell"]').each(function () {
              $tr.append($('<td></td>').text($(this).text()));
            });
            if (i === 0 && $tr.children('th').length) {
              $thead.append($tr);
            } else {
              $tbody.append($tr);
            }
          });
      });
      if ($thead.children().length) {
        $newTable.append($thead);
      }
      if ($tbody.children().length) {
        $newTable.append($tbody);
      }
    }
    $table.replaceWith($newTable);
  });

  // Hoist <br>s out of inline edges so Turndown's flanking-whitespace trim
  // does not eat the hard break. See liftBrFromInlineEdges for details.
  liftBrFromInlineEdges($);

  // Convert cleaned HTML to Markdown
  const turndown = new TurndownService({
    headingStyle: 'atx',
    codeBlockStyle: 'fenced',
    emDelimiter: '*',
    bulletListMarker: '-',
    strongDelimiter: '**',
    linkStyle: 'inlined',
    linkReferenceStyle: 'full',
    hr: '---',
    style: false,
  });
  turndown.use(turndownPluginGfm.gfm);
  preserveTableCellLineBreaks(turndown);
  // Decode HTML entities to unicode after markdown conversion
  // Preserve non-breaking spaces as &nbsp; entities for clear marking
  return coalesceBrRunsToParagraphBreak(
    he.decode(turndown.turndown($.html())).replace(/\u00A0/g, '&nbsp;')
  );
}

// Coalesce runs of CommonMark hard breaks (`  \n`) into a single paragraph
// break. Google Docs export wraps every visual line break in `<br>`, including
// `<br><br>` at paragraph boundaries; Turndown faithfully emits two trailing-
// two-space-newline pairs for that, which renders as `<br><br>` joined inside
// one `<p>` instead of two paragraphs. Two or more adjacent hard breaks always
// mean "paragraph break" in the source HTML, so collapse them to `\n\n`.
function coalesceBrRunsToParagraphBreak(markdown) {
  return markdown.replace(/(?: {2,}\n){2,}/g, '\n\n');
}

// Lift <br> nodes out of inline parents when they sit at the leading or
// trailing edge.
//
// Turndown calls `content.trim()` on the inner markdown of any inline element
// whose `flankingWhitespace` is non-empty (turndown.cjs.js:902), which strips
// the `  \n` hard break that the <br> rule emits. Google Docs export-html
// commonly produces `<strong>X</strong><span> Y.<br></span><strong>Z</strong>`
// — the trailing <br> inside a leading-space <span> gets `.trim()`-ed away,
// so X/Y/Z collapse onto one line.
//
// Hoisting trailing/leading <br>s out of their inline wrapper sidesteps the
// trim entirely. The hard break then attaches at the parent level, which
// Turndown handles correctly.
function liftBrFromInlineEdges($) {
  const inlineParents = new Set([
    'span',
    'a',
    'strong',
    'b',
    'em',
    'i',
    'u',
    's',
    'del',
    'ins',
    'sub',
    'sup',
    'mark',
    'small',
    'q',
    'cite',
    'code',
    'abbr',
    'time',
    'kbd',
    'samp',
    'var',
    'font',
  ]);

  // Hoist <br>s repeatedly until none sit at an inline edge — this handles
  // nested wrappers like `<span><em>foo<br></em></span>`.
  let changed = true;
  while (changed) {
    changed = false;
    $('br').each(function () {
      const el = this;
      const parent = el.parent;
      if (!parent || !inlineParents.has(parent.tagName)) {
        return;
      }
      const isFirst = parent.children[0] === el;
      const isLast = parent.children[parent.children.length - 1] === el;
      if (!isFirst && !isLast) {
        return;
      }
      if (isLast) {
        $(parent).after(el);
      } else {
        $(parent).before(el);
      }
      changed = true;
    });
  }
}

function preserveLeadingHeadingNumbering($) {
  // Hoist the OL counter onto a heading inside its first <li>.
  // Example: <ol><li><h4>13. Foo</h4></li></ol> → <ol start="13"><li><h4>Foo</h4></li></ol>
  $('ol > li').each(function () {
    const $li = $(this);
    const $heading = $li.children('h1, h2, h3, h4, h5, h6').first();
    if (!$heading.length) {
      return;
    }
    // Only act when the <li> has just one heading child and no other meaningful text.
    if ($li.children().length !== 1) {
      return;
    }
    const text = $heading.text();
    const m = text.match(/^\s*(\d+)\.\s+(.*)$/s);
    if (!m) {
      return;
    }
    const [, num, rest] = m;
    const $ol = $li.parent();
    if ($ol.children('li').length !== 1) {
      return;
    }
    if (!$ol.attr('start')) {
      $ol.attr('start', num);
    }
    stripLeadingTextFromHeading($, $heading, m[0].length - rest.length);
  });

  // Demote <hN> with sub-numbering text (e.g. "13.1 Foo") to a bold paragraph.
  // Avoids emitting `##### 13.1 Foo` (which collides with renderers that strip
  // numbering or blockquote-wrap subsections downstream).
  $('h1, h2, h3, h4, h5, h6').each(function () {
    const $h = $(this);
    const text = $h.text();
    if (!/^\s*\d+\.\d+/.test(text)) {
      return;
    }
    const inner = $h.html() || '';
    const $p = $('<p></p>');
    if (/^\s*<strong[\s>]/i.test(inner)) {
      $p.html(inner);
    } else {
      $p.html(`<strong>${inner}</strong>`);
    }
    $h.replaceWith($p);
  });
}

// Walk every top-level <ol> in document order and assign a `start` attribute
// so consecutive lists number continuously (1, 2, 3, ... N). An explicit
// `start="N"` resets the running counter to N and is preserved.
//
// Top-level here means "not inside another <ol> or <ul>" — nested ordered
// lists keep their own numbering and Turndown's per-list start handling.
function applyContinuousOrderedListNumbering($) {
  let counter = 1;
  $('ol').each(function () {
    if ($(this).parents('ol, ul').length > 0) {
      return;
    }
    const explicitStart = parseInt($(this).attr('start') ?? '', 10);
    if (Number.isFinite(explicitStart)) {
      counter = explicitStart;
    } else {
      $(this).attr('start', String(counter));
    }
    counter += $(this).children('li').length;
  });
}

function stripLeadingTextFromHeading($, $heading, prefixLen) {
  // Walk text nodes from the start of the heading and remove prefixLen characters.
  let remaining = prefixLen;
  const stack = [$heading.get(0)];
  while (stack.length && remaining > 0) {
    const node = stack.shift();
    const children = node.children || [];
    for (const child of children) {
      if (remaining <= 0) {
        break;
      }
      if (child.type === 'text') {
        const data = child.data || '';
        if (data.length <= remaining) {
          remaining -= data.length;
          child.data = '';
        } else {
          child.data = data.slice(remaining);
          remaining = 0;
        }
      } else {
        stack.push(child);
      }
    }
  }
  // Trim leading whitespace from the first non-empty text node.
  const walk = (node) => {
    const children = node.children || [];
    for (const child of children) {
      if (child.type === 'text') {
        if (child.data) {
          child.data = child.data.replace(/^\s+/, '');
          if (child.data) {
            return true;
          }
        }
      } else if (walk(child)) {
        return true;
      }
    }
    return false;
  };
  walk($heading.get(0));
}

function preserveTableCellLineBreaks(turndown) {
  turndown.addRule('tableCellLineBreak', {
    filter(node) {
      return node.nodeName === 'BR' && hasAncestorNode(node, ['TD', 'TH']);
    },
    replacement() {
      return '<br>';
    },
  });
}

function hasAncestorNode(node, nodeNames) {
  let current = node.parentNode;
  while (current) {
    if (nodeNames.includes(current.nodeName)) {
      return true;
    }
    current = current.parentNode;
  }
  return false;
}

function selectedHtml($, selector) {
  if (!selector) {
    return null;
  }
  const $selected = $(selector).first();
  return $selected.length ? $.html($selected) : null;
}

// Convert relative URLs to absolute URLs in HTML content
export function convertRelativeUrls(html, baseUrl) {
  const base = new URL(baseUrl);

  // Function to convert a single URL
  const toAbsolute = (url) => {
    if (
      !url ||
      url.startsWith('data:') ||
      url.startsWith('blob:') ||
      url.startsWith('javascript:')
    ) {
      return url;
    }
    try {
      return new URL(url, base).href;
    } catch {
      return url;
    }
  };

  // Convert URLs in various attributes
  const attributes = [
    { tag: 'a', attr: 'href' },
    { tag: 'img', attr: 'src' },
    { tag: 'script', attr: 'src' },
    { tag: 'link', attr: 'href' },
    { tag: 'form', attr: 'action' },
    { tag: 'video', attr: 'src' },
    { tag: 'audio', attr: 'src' },
    { tag: 'source', attr: 'src' },
    { tag: 'track', attr: 'src' },
    { tag: 'embed', attr: 'src' },
    { tag: 'object', attr: 'data' },
    { tag: 'iframe', attr: 'src' },
  ];

  let result = html;

  // Process each attribute type
  for (const { tag, attr } of attributes) {
    const regex = new RegExp(
      `<${tag}[^>]*${attr}=["']([^"']+)["'][^>]*>`,
      'gi'
    );
    result = result.replace(regex, (match, url) => {
      const absoluteUrl = toAbsolute(url);
      return match.replace(url, absoluteUrl);
    });
  }

  // Also handle inline styles with url()
  result = result.replace(/url\(['"]?([^'"()]+)['"]?\)/gi, (match, url) => {
    const absoluteUrl = toAbsolute(url);
    return `url("${absoluteUrl}")`;
  });

  // Only inject runtime JS hook if there is a <script> tag in the original HTML
  if (/<script[\s>]/i.test(html)) {
    const runtimeHook = `
<script>(function() {
  const baseUrl = '${base.href}';
  function absolutifyUrl(url) {
    if (!url) return url;
    if (url.startsWith('http') || url.startsWith('data:') || url.startsWith('blob:')) return url;
    try { return new URL(url, baseUrl).href; } catch { return url; }
  }
  function fixElementUrls(el) {
    if (el.tagName === 'A' || el.tagName === 'LINK') {
      el.href = absolutifyUrl(el.getAttribute('href'));
    }
    if (el.tagName === 'IMG' || el.tagName === 'SCRIPT' || el.tagName === 'IFRAME' || el.tagName === 'SOURCE') {
      el.src = absolutifyUrl(el.getAttribute('src'));
    }
    if (el.hasAttribute('style')) {
      // The escapes in the regex are intentional for matching CSS url() syntax
      // eslint-disable-next-line no-useless-escape
      const urlPattern = /url\(["']?([^'")]+)["']?\)/g;
      el.setAttribute(
        'style',
        el.getAttribute('style').replace(urlPattern, (m, capturedUrl) => {
          const absoluteUrl = absolutifyUrl(capturedUrl);
          return "url('" + absoluteUrl + "')";
        })
      );
    }
  }
  function fixAllUrls(root) {
    root.querySelectorAll('*').forEach(fixElementUrls);
    // The escapes in the regex are intentional for matching CSS url() syntax
    // eslint-disable-next-line no-useless-escape
    const urlPattern = /url\(["']?([^'")]+)["']?\)/g;
    root.querySelectorAll('style').forEach(function (styleTag) {
      styleTag.textContent = styleTag.textContent.replace(
        urlPattern,
        (m, capturedUrl) => {
          const absoluteUrl = absolutifyUrl(capturedUrl);
          return "url('" + absoluteUrl + "')";
        }
      );
    });
  }
  fixAllUrls(document);
  const observer = new MutationObserver(function(mutations) {
    for (const mutation of mutations) {
      mutation.addedNodes.forEach(function(node) {
        if (node.nodeType === 1) {
          fixElementUrls(node);
          fixAllUrls(node);
        }
      });
    }
  });
  observer.observe(document.body, { childList: true, subtree: true });
})();</script>
`;
    result = result.replace(/<\/head>/i, `${runtimeHook}</head>`);
  }

  return result;
}

/**
 * Enhanced HTML to Markdown conversion with LaTeX formula extraction,
 * metadata extraction, code language detection, and post-processing.
 *
 * This is the enhanced version of convertHtmlToMarkdown that handles:
 * - LaTeX formulas from img.formula (Habr), KaTeX, MathJax
 * - Article metadata (author, date, views, hubs, tags)
 * - Code language detection with content-based correction
 * - Blockquote math grouping with \displaystyle
 * - Unicode normalization, quote straightening, dash normalization
 * - LaTeX spacing fixes for GitHub rendering
 *
 * @param {string} html - HTML content
 * @param {string} [baseUrl] - Base URL for resolving relative URLs
 * @param {Object} [options] - Enhanced options
 * @param {boolean} [options.extractLatex=true] - Extract LaTeX formulas
 * @param {boolean} [options.extractMetadata=true] - Extract article metadata
 * @param {boolean} [options.postProcess=true] - Apply post-processing pipeline
 * @param {boolean} [options.detectCodeLanguage=true] - Detect/correct code languages
 * @param {boolean} [options.preserveCodeWhitespace=false] - Keep original whitespace inside code blocks
 * @param {string} [options.contentSelector] - CSS selector to scope Markdown conversion
 * @param {string} [options.bodySelector] - CSS selector appended after the selected article title
 * @returns {Object} Result with { markdown, metadata }
 */
export function convertHtmlToMarkdownEnhanced(html, baseUrl, options = {}) {
  const {
    extractLatex = true,
    extractMetadata: shouldExtractMetadata = true,
    postProcess = true,
    detectCodeLanguage = true,
    preserveCodeWhitespace = false,
    contentSelector,
    bodySelector,
  } = options;

  // Ensure all URLs are absolute before Markdown conversion
  if (baseUrl) {
    html = convertRelativeUrls(html, baseUrl);
  }

  let $ = cheerio.load(html);

  // Extract metadata before cleaning
  let metadata = null;
  if (shouldExtractMetadata) {
    metadata = extractMetadata($);
  }

  const bodyHtml = selectedHtml($, bodySelector);
  const contentHtml = selectedHtml($, contentSelector);
  if (bodyHtml || contentHtml) {
    const titleSelector = contentSelector ? `${contentSelector} h1, h1` : 'h1';
    const titleHtml = bodyHtml ? selectedHtml($, titleSelector) : null;
    $ = cheerio.load(
      [titleHtml, bodyHtml || contentHtml].filter(Boolean).join('\n')
    );
  }

  // Remove unwanted elements
  $('style, script, noscript').remove();
  $('*').each(function () {
    const attribs = this.attribs || {};
    Object.keys(attribs).forEach((attr) => {
      if (attr.toLowerCase().startsWith('on')) {
        $(this).removeAttr(attr);
      }
    });
  });
  $('a[href^="javascript:"]').remove();
  $('[style]').removeAttr('style');

  // Remove empty headings
  $('h1, h2, h3, h4, h5, h6').each(function () {
    if (!$(this).text().trim()) {
      $(this).remove();
    }
  });

  // Preserve hierarchical heading numbering (see convertHtmlToMarkdown).
  preserveLeadingHeadingNumbering($);

  // Continuous numbering across consecutive top-level <ol>s (see convertHtmlToMarkdown).
  applyContinuousOrderedListNumbering($);

  // Remove empty links (same logic as convertHtmlToMarkdown)
  $('a').each(function () {
    const directText = $(this)
      .contents()
      .filter(function () {
        return this.type === 'text';
      })
      .text();
    if (!directText.trim()) {
      let allChildrenEmpty = true;
      $(this)
        .children()
        .each(function () {
          if (
            $(this).text().trim() ||
            (this.tagName === 'img' && $(this).attr('alt'))
          ) {
            allChildrenEmpty = false;
          }
        });
      if (allChildrenEmpty) {
        $(this).remove();
      }
    }
  });
  $('a').each(function () {
    const children = $(this).children();
    if (
      children.length === 1 &&
      children[0].tagName === 'img' &&
      !$(children[0]).attr('alt')
    ) {
      $(this).remove();
    }
  });
  $('a').each(function () {
    if (!$(this).text().trim()) {
      $(this).remove();
    }
  });

  // Handle LaTeX formulas before Turndown conversion
  if (extractLatex) {
    // Replace Habr formula images with LaTeX text
    $('img.formula, img[source]').each(function () {
      if (isFormulaImage($, this)) {
        const latex = extractFormula($, this);
        if (latex) {
          $(this).replaceWith(`$${latex}$`);
        }
      }
    });

    // Replace KaTeX/MathJax elements
    $('.katex, .math, mjx-container, .MathJax').each(function () {
      if (isMathElement($, this)) {
        const latex = extractFormula($, this);
        if (latex) {
          $(this).replaceWith(`$${latex}$`);
        }
      }
    });
  }

  // Handle code language detection/correction
  if (detectCodeLanguage) {
    $('pre code').each(function () {
      const codeText = $(this).text();
      const language =
        $(this)
          .attr('class')
          ?.match(/language-(\w+)/)?.[1] ||
        $(this)
          .attr('class')
          ?.match(/^(\w+)$/)?.[1] ||
        '';

      // Content-based language correction
      if (
        language === 'matlab' &&
        /\b(Require\s+Import|Definition|Fixpoint|Lemma|Theorem|Proof|Qed|Notation|Inductive)\b/.test(
          codeText
        )
      ) {
        $(this).removeClass(`language-${language}`).addClass('language-coq');
      }
    });
  }

  if (preserveCodeWhitespace) {
    $('pre code').each(function () {
      $(this).text($(this).text().replace(/\r\n?/g, '\n'));
    });
  }

  // Preprocess ARIA tables (same as original)
  $('[role="table"]').each(function () {
    const $table = $(this);
    const $newTable = $('<table></table>');
    const label = $table.attr('aria-label');
    const descId = $table.attr('aria-describedby');
    if (label) {
      $newTable.append(`<caption>${label}</caption>`);
    } else if (descId && $(`#${descId}`).length) {
      $newTable.append(`<caption>${$(`#${descId}`).text()}</caption>`);
    }
    const rowgroups = $table.find('> [role="rowgroup"]');
    if (rowgroups.length > 0) {
      const $thead = $('<thead></thead>');
      const $tbody = $('<tbody></tbody>');
      rowgroups.each(function (i) {
        $(this)
          .find('> [role="row"]')
          .each(function () {
            const $row = $(this);
            const $tr = $('<tr></tr>');
            $row.children('[role="columnheader"]').each(function () {
              $tr.append($('<th></th>').text($(this).text()));
            });
            $row.children('[role="cell"]').each(function () {
              $tr.append($('<td></td>').text($(this).text()));
            });
            if (i === 0 && $tr.children('th').length) {
              $thead.append($tr);
            } else {
              $tbody.append($tr);
            }
          });
      });
      if ($thead.children().length) {
        $newTable.append($thead);
      }
      if ($tbody.children().length) {
        $newTable.append($tbody);
      }
    }
    $table.replaceWith($newTable);
  });

  // Hoist <br>s out of inline edges (see liftBrFromInlineEdges).
  liftBrFromInlineEdges($);

  // Convert to Markdown using Turndown
  const turndown = new TurndownService({
    headingStyle: 'atx',
    codeBlockStyle: 'fenced',
    emDelimiter: '*',
    bulletListMarker: '-',
    strongDelimiter: '**',
    linkStyle: 'inlined',
    linkReferenceStyle: 'full',
    hr: '---',
    style: false,
  });
  turndown.use(turndownPluginGfm.gfm);
  preserveTableCellLineBreaks(turndown);

  // Decode HTML entities to unicode after markdown conversion
  // Normalize non-breaking spaces to regular spaces in Markdown text
  let markdown = coalesceBrRunsToParagraphBreak(
    he.decode(turndown.turndown($.html())).replace(/\u00A0/g, ' ')
  );

  // Apply post-processing
  if (postProcess) {
    markdown = postProcessMarkdown(markdown);
  }

  return { markdown, metadata };
}

// Convert HTML content to UTF-8 if it's not already
export function convertToUtf8(html) {
  // First, try to detect the current encoding from meta tag
  const charsetMatch = html.match(/<meta[^>]+charset=["']?([^"'>\s]+)/i);
  const currentCharset = charsetMatch ? charsetMatch[1].toLowerCase() : 'utf-8';

  // If it's already UTF-8, just ensure the meta tag is present
  if (currentCharset === 'utf-8' || currentCharset === 'utf8') {
    if (!charsetMatch) {
      return html.replace(/<head[^>]*>/i, '$&<meta charset="utf-8">');
    }
    return html;
  }

  // Convert from detected charset to UTF-8
  try {
    // Convert the HTML string to a buffer using the detected charset
    const buffer = iconv.encode(html, currentCharset);
    // Decode the buffer to UTF-8
    const utf8Html = iconv.decode(buffer, 'utf-8');

    // Replace the charset meta tag with UTF-8
    return utf8Html.replace(
      /<meta[^>]+charset=["']?[^"'>\s]+["']?/i,
      '<meta charset="utf-8">'
    );
  } catch (error) {
    console.error('Error converting charset:', error);
    // If conversion fails, return original HTML with UTF-8 meta tag
    return html.replace(/<head[^>]*>/i, '$&<meta charset="utf-8">');
  }
}

// Detect encoding and convert to UTF-8 for Puppeteer-rendered HTML
export function ensureUtf8(html) {
  // If no charset meta tag is present, inject one
  if (!/<meta[^>]+charset/i.test(html)) {
    html = html.replace(/<head[^>]*>/i, '$&<meta charset="utf-8">');
  }
  return html;
}

const VOID_TAGS = new Set([
  'area',
  'base',
  'br',
  'col',
  'embed',
  'hr',
  'img',
  'input',
  'link',
  'meta',
  'param',
  'source',
  'track',
  'wbr',
]);

export function prettyPrintHtml(html) {
  const tagRe = /(<\/?[a-zA-Z][^>]*?>)/g;
  const parts = html.split(tagRe).filter(Boolean);
  let indent = 0;
  const indentStr = '  ';
  const lines = [];

  for (const part of parts) {
    const isTag = part.startsWith('<');
    if (!isTag) {
      const text = part.trim();
      if (text) {
        lines.push(indentStr.repeat(indent) + text);
      }
      continue;
    }
    const isClosing = part.startsWith('</');
    const tagMatch = part.match(/^<\/?([a-zA-Z][a-zA-Z0-9]*)/);
    const tagName = tagMatch ? tagMatch[1].toLowerCase() : '';
    const isVoid = VOID_TAGS.has(tagName);
    const isSelfClosing = part.endsWith('/>');

    if (isClosing) {
      indent = Math.max(0, indent - 1);
      lines.push(indentStr.repeat(indent) + part);
    } else if (isVoid || isSelfClosing) {
      lines.push(indentStr.repeat(indent) + part);
    } else {
      lines.push(indentStr.repeat(indent) + part);
      indent++;
    }
  }

  return `${lines.join('\n')}\n`;
}
