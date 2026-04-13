import { createHash } from 'crypto';
import fs from 'fs';
import path from 'path';

const BASE64_IMAGE_REGEX =
  /!\[([^\]]*)\]\(data:image\/(png|jpeg|jpg|gif|webp|svg\+xml);base64,([^)]+)\)/gi;

/**
 * Extract base64 data URI images from markdown text, save them as files,
 * and rewrite references to relative paths.
 *
 * Uses content-hash filenames (first 8 hex chars of SHA-256) so that
 * re-captures of the same document produce stable file names regardless
 * of image order.
 *
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
 * Check if markdown contains any base64 data URI images.
 *
 * @param {string} markdown - Markdown content
 * @returns {boolean}
 */
export function hasBase64Images(markdown) {
  return BASE64_IMAGE_REGEX.test(markdown);
}
