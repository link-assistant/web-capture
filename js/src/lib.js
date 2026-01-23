/* eslint-disable no-useless-escape */
// Common logic for the web-capture microservice
import fetch from 'node-fetch';
import * as cheerio from 'cheerio';
import TurndownService from 'turndown';
import iconv from 'iconv-lite';
import { URL } from 'url';
import turndownPluginGfm from 'turndown-plugin-gfm';

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
  return turndown.turndown($.html());
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
