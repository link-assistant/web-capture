import fs from 'fs';
import path from 'path';

const BASE64_IMAGE_REGEX =
  /!\[([^\]]*)\]\(data:image\/(png|jpeg|jpg|gif|webp|svg\+xml);base64,([^)]+)\)/gi;

/**
 * Extract base64 data URI images from markdown text, save them as files,
 * and rewrite references to relative paths.
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

  let idx = 0;
  const images = [];

  const updatedMarkdown = markdown.replace(
    BASE64_IMAGE_REGEX,
    (match, altText, mimeExt, base64Data) => {
      idx++;
      const ext =
        mimeExt === 'jpeg' ? 'jpg' : mimeExt === 'svg+xml' ? 'svg' : mimeExt;
      const filename = `image-${String(idx).padStart(3, '0')}.${ext}`;
      const relativePath = `${imagesDir}/${filename}`;

      try {
        const buffer = Buffer.from(base64Data, 'base64');
        images.push({ filename, buffer });
      } catch {
        return match;
      }

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
