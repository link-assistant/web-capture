/**
 * ZIP archive handler.
 *
 * Downloads a web page as a self-contained ZIP archive containing:
 * - article.md  (markdown with either remote or local image links)
 * - images/     (directory of downloaded images, when localImages=true)
 *
 * Query parameters:
 *   url         (required) - URL to capture
 *   engine      - 'puppeteer' or 'playwright'
 *   localImages - 'true' (default) to download images locally into the archive,
 *                 'false' to keep original remote URLs in the markdown
 */

import archiver from 'archiver';
import fetch from 'node-fetch';
import * as cheerio from 'cheerio';
import { URL } from 'url';
import { fetchHtml, convertHtmlToMarkdown } from './lib.js';

export async function archiveHandler(req, res) {
  const url = req.query.url;
  if (!url) {
    return res.status(400).send('Missing `url` parameter');
  }

  const localImages = req.query.localImages !== 'false'; // default true

  try {
    const absoluteUrl = url.startsWith('http') ? url : `https://${url}`;
    const html = await fetchHtml(absoluteUrl);
    let markdown = convertHtmlToMarkdown(html, absoluteUrl);

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

    if (localImages && uniqueImages.length > 0) {
      // Download images and rewrite markdown links
      const imageMap = new Map();
      let idx = 1;
      for (const imgUrl of uniqueImages) {
        const ext = guessImageExtension(imgUrl);
        const filename = `image-${idx}.${ext}`;
        imageMap.set(imgUrl, `images/${filename}`);
        idx++;
      }

      // Rewrite image URLs in markdown to local paths
      for (const [remoteUrl, localPath] of imageMap) {
        markdown = markdown.split(remoteUrl).join(localPath);
      }

      // Add markdown
      archive.append(markdown, { name: 'article.md' });

      // Download and add each image
      for (const [imgUrl, localPath] of imageMap) {
        try {
          const imgResp = await fetch(imgUrl);
          if (imgResp.ok) {
            const buffer = await imgResp.buffer();
            archive.append(buffer, { name: localPath });
          }
        } catch {
          /* skip failed image downloads */
        }
      }
    } else {
      // Just add the markdown with remote URLs
      archive.append(markdown, { name: 'article.md' });
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
  if (pathname.endsWith('.jpg') || pathname.endsWith('.jpeg')) return 'jpg';
  if (pathname.endsWith('.gif')) return 'gif';
  if (pathname.endsWith('.webp')) return 'webp';
  if (pathname.endsWith('.svg')) return 'svg';
  return 'png';
}
