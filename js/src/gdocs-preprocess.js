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
  let hoisted = 0;
  let unwrappedLinks = 0;

  $('span[style], p[style]').each(function () {
    const style = String($(this).attr('style') || '');
    const hasBold = /font-weight\s*:\s*(?:bold|[6-9]\d{2})/i.test(style);
    const hasItalic = /font-style\s*:\s*italic/i.test(style);
    const hasStrike = /text-decoration[^;]*\bline-through\b/i.test(style);
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
    $(this).replaceWith(wrapped);
    hoisted += 1;
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
