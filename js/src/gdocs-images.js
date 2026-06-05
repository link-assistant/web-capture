// Google Docs editor-model image localization (issue #92 R5).
//
// The browser-model capture returns `docs-images-rt/…` URLs inside the
// markdown/html. Archive mode needs those images copied into `images/` so
// the archive is self-contained. This module downloads the images and
// rewrites the captured output accordingly.

import fetch from 'node-fetch';
import { URL } from 'url';

const DEFAULT_USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

function getExtensionFromImageUrl(url) {
  try {
    const u = new URL(url);
    const match = u.pathname.match(/\.(png|jpe?g|gif|webp|svg)$/iu);
    if (match) {
      const ext = match[1].toLowerCase();
      return ext === 'jpeg' ? '.jpg' : `.${ext}`;
    }
  } catch {
    // fall through to default
  }
  return '.png';
}

function mimeTypeForExtension(filename) {
  const dot = filename.lastIndexOf('.');
  const ext = dot >= 0 ? filename.slice(dot + 1).toLowerCase() : 'png';
  switch (ext) {
    case 'jpg':
    case 'jpeg':
      return 'image/jpeg';
    case 'gif':
      return 'image/gif';
    case 'webp':
      return 'image/webp';
    case 'svg':
      return 'image/svg+xml';
    default:
      return 'image/png';
  }
}

/**
 * Download the `docs-images-rt` URLs captured from an editor-model capture.
 *
 * Produces `{ filename, data, mimeType }` entries compatible with
 * `writeGoogleDocsArchive` and rewrites the markdown/html to reference the
 * local `images/<filename>` paths.
 *
 * @param {{markdown: string, html: string, capture: Object}} modelResult
 * @param {Object} [options] - Options
 * @param {typeof fetch} [options.fetchImpl=fetch] - Injected fetch for tests
 * @param {Object} [options.log] - Verbose logger
 * @returns {Promise<{markdown: string, html: string, images: Array}>}
 */
export async function localizeGoogleDocsModelImages(modelResult, options = {}) {
  const { fetchImpl = fetch, log } = options;
  const images = [];
  const seen = new Map();
  let nextIndex = 1;

  const resolveFilename = (url, existingAlt) => {
    if (seen.has(url)) {
      return seen.get(url);
    }
    const ext = getExtensionFromImageUrl(url);
    const filename = `image-${String(nextIndex).padStart(2, '0')}${ext}`;
    nextIndex += 1;
    seen.set(url, filename);
    log?.debug?.(() => ({
      event: 'gdocs.archive.image.scheduled',
      url,
      filename,
      alt: existingAlt || null,
    }));
    return filename;
  };

  const candidates = (modelResult?.capture?.images || []).filter(
    (img) => img?.url
  );
  for (const img of candidates) {
    const filename = resolveFilename(img.url, img.alt);
    try {
      const response = await fetchImpl(img.url, {
        headers: {
          'User-Agent': DEFAULT_USER_AGENT,
          Accept: 'image/*,*/*;q=0.8',
        },
        redirect: 'follow',
      });
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }
      const arrayBuffer = await response.arrayBuffer();
      const data = Buffer.from(arrayBuffer);
      const mimeType =
        response.headers?.get?.('content-type') ||
        mimeTypeForExtension(filename);
      images.push({ filename, data, mimeType });
      log?.debug?.(() => ({
        event: 'gdocs.archive.image.downloaded',
        url: img.url,
        filename,
        bytes: data.length,
        mimeType,
      }));
    } catch (err) {
      log?.debug?.(() => ({
        event: 'gdocs.archive.image.failed',
        url: img.url,
        filename,
        error: err?.message || String(err),
      }));
    }
  }

  let markdown = modelResult?.markdown || '';
  let html = modelResult?.html || '';
  for (const [url, filename] of seen.entries()) {
    const localPath = `images/${filename}`;
    markdown = markdown.split(url).join(localPath);
    html = html.split(url).join(localPath);
  }

  return { markdown, html, images };
}
