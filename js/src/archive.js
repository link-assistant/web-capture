/**
 * ZIP archive handler.
 *
 * Downloads a web page as a self-contained ZIP archive containing:
 * - document.md or document.html  (document with either remote or local asset links)
 * - images/     (directory of downloaded images, when localImages=true)
 * - css/        (directory for stylesheets, when documentFormat=html and localImages=true)
 * - js/         (directory for scripts, when documentFormat=html and localImages=true)
 *
 * Query parameters:
 *   url            (required) - URL to capture
 *   engine         - 'puppeteer' or 'playwright'
 *   localImages    - 'true' (default) to download images locally into the archive,
 *                    'false' to keep original remote URLs in the document
 *   documentFormat - 'markdown' (default) or 'html' - format of the main document
 */

import archiver from 'archiver';
import fetch from 'node-fetch';
import * as cheerio from 'cheerio';
import { URL } from 'url';
import {
  fetchHtml,
  convertHtmlToMarkdown,
  convertRelativeUrls,
  prettyPrintHtml,
} from './lib.js';
import { retry } from './retry.js';
import { extractBase64ToBuffers } from './extract-images.js';

export async function archiveHandler(req, res) {
  const url = req.query.url;
  if (!url) {
    return res.status(400).send('Missing `url` parameter');
  }

  const keepOriginalLinks = req.query.keepOriginalLinks === 'true';
  const localImages = keepOriginalLinks
    ? false
    : req.query.localImages !== 'false';
  const embedImages = req.query.embedImages === 'true';
  const documentFormat =
    req.query.documentFormat === 'html' ? 'html' : 'markdown';

  try {
    const absoluteUrl = url.startsWith('http') ? url : `https://${url}`;

    const html = await retry(() => fetchHtml(absoluteUrl), {
      retries: 3,
      baseDelay: 1000,
      onRetry: (err, attempt, delay) => {
        console.log(
          `Retry ${attempt} fetching ${absoluteUrl} after ${delay}ms: ${err.message}`
        );
      },
    });

    // Collect images from the HTML
    const $ = cheerio.load(html);
    const images = [];
    const imageExtensionByUrl = new Map();
    $('img').each(function () {
      const src = $(this).attr('src');
      if (src && !src.startsWith('data:') && !src.startsWith('blob:')) {
        try {
          const imgUrl = new URL(src, absoluteUrl).href;
          images.push(imgUrl);
          const hintedExtension = sanitizeImageExtension(
            $(this).attr('data-web-capture-extension')
          );
          if (hintedExtension && !imageExtensionByUrl.has(imgUrl)) {
            imageExtensionByUrl.set(imgUrl, hintedExtension);
          }
        } catch {
          /* skip invalid URLs */
        }
      }
    });

    // Deduplicate
    const uniqueImages = [...new Set(images)];

    // Set up the ZIP archive stream
    res.set('Content-Type', 'application/zip');
    const hostname = new URL(absoluteUrl).hostname.replace(/\./g, '-');
    res.set(
      'Content-Disposition',
      `attachment; filename="${hostname}-archive.zip"`
    );

    const archive = archiver('zip', { zlib: { level: 9 } });
    archive.pipe(res);

    // Build the image map for local downloads
    const imageMap = new Map();
    if (localImages && uniqueImages.length > 0) {
      let idx = 1;
      for (const imgUrl of uniqueImages) {
        const ext =
          imageExtensionByUrl.get(imgUrl) || guessImageExtension(imgUrl);
        const filename = `image-${idx}.${ext}`;
        imageMap.set(imgUrl, `images/${filename}`);
        idx++;
      }
    }

    if (documentFormat === 'html') {
      // HTML format: produce a local HTML document with assets in folders
      let outputHtml = convertRelativeUrls(html, absoluteUrl);

      // Remove scripts and non-essential elements for a clean local copy
      const $out = cheerio.load(outputHtml);
      $out('script, noscript').remove();

      if (localImages && imageMap.size > 0) {
        // Rewrite image URLs to local paths
        $out('img').each(function () {
          const src = $out(this).attr('src');
          if (src) {
            try {
              const resolvedUrl = new URL(src, absoluteUrl).href;
              if (imageMap.has(resolvedUrl)) {
                $out(this).attr('src', imageMap.get(resolvedUrl));
              }
            } catch {
              /* skip invalid URLs */
            }
          }
        });
      }

      // Collect and localize CSS stylesheets
      const cssFiles = [];
      if (localImages) {
        let cssIdx = 1;
        $out('link[rel="stylesheet"]').each(function () {
          const href = $out(this).attr('href');
          if (href && !href.startsWith('data:')) {
            try {
              const cssUrl = new URL(href, absoluteUrl).href;
              const localPath = `css/style-${cssIdx}.css`;
              cssFiles.push({ url: cssUrl, localPath });
              $out(this).attr('href', localPath);
              cssIdx++;
            } catch {
              /* skip invalid URLs */
            }
          }
        });
      }

      outputHtml = prettyPrintHtml($out.html());
      archive.append(outputHtml, { name: 'document.html' });

      // Download and add CSS files
      for (const { url: cssUrl, localPath } of cssFiles) {
        try {
          const cssResp = await retry(() => fetch(cssUrl), {
            retries: 2,
            baseDelay: 500,
          });
          if (cssResp.ok) {
            const cssText = await cssResp.text();
            archive.append(cssText, { name: localPath });
          }
        } catch {
          /* skip failed CSS downloads */
        }
      }
    } else {
      // Markdown format (default)
      let markdown = convertHtmlToMarkdown(html, absoluteUrl);

      if (localImages && imageMap.size > 0) {
        for (const [remoteUrl, localPath] of imageMap) {
          markdown = markdown.split(remoteUrl).join(localPath);
        }
      }

      if (!embedImages && !keepOriginalLinks) {
        appendMarkdownAndImages(archive, markdown);
      } else {
        archive.append(markdown, { name: 'document.md' });
      }

      // document.html — the source the markdown was derived from, for
      // reference only, so the default archive layout (document.md +
      // document.html + images/) is identical across capture paths (issue #113).
      archive.append(prettyPrintHtml(convertRelativeUrls(html, absoluteUrl)), {
        name: 'document.html',
      });
    }

    // Download and add images if local mode
    if (localImages && imageMap.size > 0) {
      for (const [imgUrl, localPath] of imageMap) {
        try {
          const imgResp = await retry(() => fetch(imgUrl), {
            retries: 2,
            baseDelay: 500,
          });
          if (imgResp.ok) {
            const buffer = await imgResp.buffer();
            archive.append(buffer, { name: localPath });
          }
        } catch {
          /* skip failed image downloads */
        }
      }
    }

    await archive.finalize();
  } catch (err) {
    console.error(err);
    if (!res.headersSent) {
      res.status(500).send('Error creating archive');
    }
  }
}

/**
 * Extract base64 images from `markdown` into the archive's `images/` folder and
 * append the rewritten markdown as `document.md`. Shared by the archive
 * endpoint and {@link buildArchiveFromHtml} so the default layout stays
 * identical across capture paths.
 *
 * @param {import('archiver').Archiver} archive - The archive being built
 * @param {string} markdown - Markdown content (may contain base64 data URIs)
 */
function appendMarkdownAndImages(archive, markdown) {
  const { markdown: rewritten, images } = extractBase64ToBuffers(
    markdown,
    'images'
  );
  for (const img of images) {
    archive.append(img.buffer, { name: `images/${img.filename}` });
  }
  archive.append(rewritten, { name: 'document.md' });
}

/**
 * Build a self-contained ZIP archive (as a Buffer) from raw HTML, matching the
 * default `--format archive` layout contract (issue #113):
 *
 *   - `document.md`   — markdown referencing images by relative `images/` path
 *   - `document.html` — the source HTML the markdown was derived from (reference)
 *   - `images/`       — every inline base64 image as a separate file
 *
 * @param {string} html - Source HTML to convert
 * @param {string} baseUrl - Base URL for resolving relative links
 * @returns {Promise<Buffer>} the finalized ZIP archive bytes
 */
export async function buildArchiveFromHtml(html, baseUrl) {
  const archive = archiver('zip', { zlib: { level: 9 } });
  const chunks = [];
  archive.on('data', (chunk) => chunks.push(chunk));
  const finished = new Promise((resolve, reject) => {
    archive.on('end', resolve);
    archive.on('error', reject);
  });

  appendMarkdownAndImages(archive, convertHtmlToMarkdown(html, baseUrl));
  archive.append(prettyPrintHtml(convertRelativeUrls(html, baseUrl)), {
    name: 'document.html',
  });

  await archive.finalize();
  await finished;
  return Buffer.concat(chunks);
}

function guessImageExtension(url) {
  const pathname = new URL(url).pathname.toLowerCase();
  if (pathname.endsWith('.jpg') || pathname.endsWith('.jpeg')) {
    return 'jpg';
  }
  if (pathname.endsWith('.gif')) {
    return 'gif';
  }
  if (pathname.endsWith('.webp')) {
    return 'webp';
  }
  if (pathname.endsWith('.svg')) {
    return 'svg';
  }
  return 'png';
}

function sanitizeImageExtension(extension) {
  if (!extension) {
    return null;
  }

  const normalized = extension.toLowerCase().replace(/^\./, '');
  return ['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg'].includes(normalized)
    ? normalized
    : null;
}
