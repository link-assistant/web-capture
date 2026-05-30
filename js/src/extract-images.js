import { createHash } from 'crypto';
import fs from 'fs';
import path from 'path';

// Capture groups: alt text, mime subtype, base64 payload. A trailing
// markdown title attribute (e.g. `![](src "")`) is matched but discarded so
// the empty title cannot leak into the base64 payload.
const BASE64_IMAGE_REGEX =
  /!\[([^\]]*)\]\(data:image\/(png|jpeg|jpg|gif|webp|svg\+xml);base64,([A-Za-z0-9+/=]+)(?:\s+"[^"]*")?\)/gi;

/**
 * @param {string} markdown - Markdown content with data URI images
 * @param {string} outputDir - Directory where the markdown file is being written
 * @param {Object} [options]
 * @param {string} [options.imagesDir='images'] - Subdirectory name for images
 * @returns {{markdown: string, extracted: number}}
 */
export function extractAndSaveImages(markdown, outputDir, options = {}) {
  const { imagesDir = 'images' } = options;
  const imagesPath = path.resolve(outputDir, imagesDir);

  const images = [];

  const updatedMarkdown = markdown.replace(
    BASE64_IMAGE_REGEX,
    (match, altText, mimeExt, base64Data) => {
      const ext =
        mimeExt === 'jpeg' ? 'jpg' : mimeExt === 'svg+xml' ? 'svg' : mimeExt;

      let buffer;
      try {
        buffer = Buffer.from(base64Data, 'base64');
      } catch {
        return match;
      }

      const hash = createHash('sha256')
        .update(buffer)
        .digest('hex')
        .slice(0, 8);
      const filename = `image-${hash}.${ext}`;
      const relativePath = `${imagesDir}/${filename}`;

      images.push({ filename, buffer });

      return `![${altText}](${relativePath})`;
    }
  );

  if (images.length > 0) {
    fs.mkdirSync(imagesPath, { recursive: true });
    for (const img of images) {
      fs.writeFileSync(path.join(imagesPath, img.filename), img.buffer);
    }
  }

  return { markdown: updatedMarkdown, extracted: images.length };
}

/**
 * Extract base64 images from markdown into memory buffers and rewrite paths.
 * Does NOT write to disk — intended for streaming into archives.
 *
 * @param {string} markdown - Markdown content with data URI images
 * @param {string} [imagesDir='images'] - Directory prefix for image paths
 * @returns {{markdown: string, images: Array<{filename: string, buffer: Buffer}>}}
 */
export function extractBase64ToBuffers(markdown, imagesDir = 'images') {
  const images = [];
  const updatedMarkdown = markdown.replace(
    BASE64_IMAGE_REGEX,
    (match, altText, mimeExt, base64Data) => {
      const ext =
        mimeExt === 'jpeg' ? 'jpg' : mimeExt === 'svg+xml' ? 'svg' : mimeExt;

      let buffer;
      try {
        buffer = Buffer.from(base64Data, 'base64');
      } catch {
        return match;
      }

      const hash = createHash('sha256')
        .update(buffer)
        .digest('hex')
        .slice(0, 8);
      const filename = `image-${hash}.${ext}`;
      const relativePath = `${imagesDir}/${filename}`;

      images.push({ filename, buffer });
      return `![${altText}](${relativePath})`;
    }
  );
  return { markdown: updatedMarkdown, images };
}

/**
 * Strip base64 data URI images from markdown, leaving a visible placeholder.
 * Used when keepOriginalLinks is enabled — base64 images have no original URL
 * to restore, so we remove the heavy data URI but still leave a marker so the
 * reader can see that an image was here.
 *
 * Non-empty alt becomes `*[image: <alt>]*`. Empty alt — common for Google Docs
 * HTML exports, which emit `<img alt="" src="data:...">` for every image —
 * becomes `![]()`, an empty markdown image reference that renderers still
 * surface as a slot. Emitting `''` for empty-alt would silently delete every
 * image in the document (see issue #117).
 *
 * @param {string} markdown - Markdown content with data URI images
 * @returns {{markdown: string, stripped: number}}
 */
export function stripBase64Images(markdown) {
  let stripped = 0;
  const updatedMarkdown = markdown.replace(
    BASE64_IMAGE_REGEX,
    (_match, altText) => {
      stripped++;
      return altText ? `*[image: ${altText}]*` : '![]()';
    }
  );
  return { markdown: updatedMarkdown, stripped };
}

/**
 * @param {string} markdown - Markdown content
 * @returns {boolean}
 */
export function hasBase64Images(markdown) {
  return BASE64_IMAGE_REGEX.test(markdown);
}

// Matches a markdown image whose source is a remote http(s) URL. A trailing
// markdown title attribute (e.g. `![](url "caption")`) is matched but excluded
// from the captured URL.
const REMOTE_IMAGE_REGEX =
  /!\[([^\]]*)\]\((https?:\/\/[^)\s]+)(?:\s+"[^"]*")?\)/g;

function remoteImageExtension(url) {
  const cleaned = url.split(/[?#]/)[0];
  const ext = (cleaned.split('.').pop() || '').toLowerCase();
  if (ext === 'jpg' || ext === 'jpeg') return 'jpg';
  if (['gif', 'webp', 'svg'].includes(ext)) return ext;
  return 'png';
}

/**
 * Apply an image mode to markdown — the single image-handling chokepoint.
 *
 * Every CLI/server capture path routes through this function so the same flag
 * produces the same result regardless of capture method (browser vs API). See
 * issue #112.
 *
 * Modes:
 *  - `'default'`: keep remote URLs as direct links; strip inline base64 data
 *    URIs (no remote URL to restore) to a visible placeholder. No `images/`
 *    folder, no silently-kept multi-megabyte base64 blob.
 *  - `'embed'`: keep base64 inline (single self-contained file).
 *  - `'extract'`: extract base64 to files under `dir/subdir` and rewrite remote
 *    references to the same local `subdir/` paths. The remote bytes are
 *    downloaded by the caller — see `pendingRemote` in the result.
 *
 * @param {string} markdown - Markdown content
 * @param {Object} [options]
 * @param {'default'|'embed'|'extract'} [options.mode='default']
 * @param {string} [options.dir] - Output directory (required for 'extract')
 * @param {string} [options.subdir='images'] - Images subdirectory name
 * @returns {Promise<{markdown: string, extracted: number, stripped: number, pendingRemote: Array<{url: string, filename: string}>}>}
 */
export async function applyImageMode(markdown, options = {}) {
  const { mode = 'default', dir, subdir = 'images' } = options;

  if (mode === 'embed') {
    return { markdown, extracted: 0, stripped: 0, pendingRemote: [] };
  }

  if (mode === 'extract') {
    if (!dir) {
      throw new Error("applyImageMode: 'extract' mode requires an output dir");
    }
    // 1. Extract inline base64 images to files.
    const extracted = extractAndSaveImages(markdown, dir, {
      imagesDir: subdir,
    });
    // 2. Plan localization of remote image references to the same folder.
    const pendingRemote = [];
    let index = 0;
    const localized = extracted.markdown.replace(
      REMOTE_IMAGE_REGEX,
      (_match, altText, url) => {
        index++;
        const filename = `image-${String(index).padStart(2, '0')}.${remoteImageExtension(url)}`;
        pendingRemote.push({ url, filename });
        return `![${altText}](${subdir}/${filename})`;
      }
    );
    return {
      markdown: localized,
      extracted: extracted.extracted,
      stripped: 0,
      pendingRemote,
    };
  }

  // 'default'
  const strip = stripBase64Images(markdown);
  return {
    markdown: strip.markdown,
    extracted: 0,
    stripped: strip.stripped,
    pendingRemote: [],
  };
}
