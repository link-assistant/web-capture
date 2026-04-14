/**
 * ZIP archive handler.
 *
 * Downloads a web page as a self-contained ZIP archive containing:
 * - article.md or article.html  (document with either remote or local asset links)
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
    $('img').each(function () {
      const src = $(this).attr('src');
      if (src && !src.startsWith('data:') && !src.startsWith('blob:')) {
        try {
          const imgUrl = new URL(src, absoluteUrl).href;
          images.push(imgUrl);
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
        const ext = guessImageExtension(imgUrl);
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

      outputHtml = $out.html();
      archive.append(outputHtml, { name: 'article.html' });

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
        const b64 = extractBase64ToBuffers(markdown, 'images');
        markdown = b64.markdown;
        for (const img of b64.images) {
          archive.append(img.buffer, { name: `images/${img.filename}` });
        }
      }

      archive.append(markdown, { name: 'article.md' });
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
