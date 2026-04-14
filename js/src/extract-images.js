import { createHash } from 'crypto';
import fs from 'fs';
import path from 'path';

const BASE64_IMAGE_REGEX =
  /!\[([^\]]*)\]\(data:image\/(png|jpeg|jpg|gif|webp|svg\+xml);base64,([^)]+)\)/gi;

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
 * Strip base64 data URI images from markdown, leaving only the alt text
 * as a placeholder. Used when keepOriginalLinks is enabled — base64 images
 * have no original URL to restore, so we remove the heavy data URI.
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
      return altText ? `*[image: ${altText}]*` : '';
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
