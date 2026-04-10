/**
 * Markdown image localization module (R5).
 *
 * Post-processing tool that:
 * 1. Reads markdown files
 * 2. Extracts all external image URLs
 * 3. Downloads images to local directory
 * 4. Updates markdown to reference local paths
 *
 * Based on reference implementation from:
 * https://github.com/link-foundation/meta-theory/blob/main/scripts/download-markdown-images.mjs
 *
 * @module localize-images
 */

import fetch from 'node-fetch';
import { URL } from 'url';
import { retry } from './retry.js';

/**
 * Extract image references from markdown text.
 *
 * @param {string} markdownText - Markdown content
 * @returns {Object[]} Array of {fullMatch, altText, url}
 */
export function extractImageReferences(markdownText) {
  const imageRegex = /!\[([^\]]*)\]\((https?:\/\/[^)]+)\)/g;
  const images = [];
  let match;

  while ((match = imageRegex.exec(markdownText)) !== null) {
    images.push({
      fullMatch: match[0],
      altText: match[1],
      url: match[2],
    });
  }

  return images;
}

/**
 * Get file extension from URL.
 *
 * @param {string} url - Image URL
 * @returns {string} File extension with dot (e.g., '.png')
 */
export function getExtensionFromUrl(url) {
  try {
    const pathname = new URL(url).pathname.split('?')[0];
    const ext = pathname.match(/\.(\w+)$/);
    if (ext) {
      const lower = ext[1].toLowerCase();
      if (['png', 'jpg', 'jpeg', 'gif', 'webp', 'svg'].includes(lower)) {
        return `.${lower}`;
      }
    }
  } catch {
    // ignore
  }
  return '.png';
}

/**
 * Generate local filename for a downloaded image.
 *
 * @param {string} url - Image URL
 * @param {number} index - Zero-based index
 * @returns {string} Local filename (e.g., 'image-01.png')
 */
export function generateLocalFilename(url, index) {
  const ext = getExtensionFromUrl(url);
  return `image-${String(index + 1).padStart(2, '0')}${ext}`;
}

/**
 * Localize images in markdown text by downloading external images
 * and replacing URLs with local paths.
 *
 * @param {string} markdownText - Input markdown
 * @param {Object} [options] - Options
 * @param {string} [options.imagesDir='images'] - Local images directory name
 * @param {boolean} [options.dryRun=false] - Only report what would be done
 * @param {Function} [options.onProgress] - Callback(index, total, status, url)
 * @param {string[]} [options.excludeDomains] - Domains to skip (already local)
 * @returns {Promise<Object>} Result with updated markdown and metadata
 */
export async function localizeImages(markdownText, options = {}) {
  const {
    imagesDir = 'images',
    dryRun = false,
    onProgress,
    excludeDomains = [],
  } = options;

  const allImages = extractImageReferences(markdownText);

  // Filter to only external images not already localized
  const externalImages = allImages.filter((img) => {
    if (!img.url.startsWith('http')) {
      return false;
    }
    if (img.url.includes(`${imagesDir}/`)) {
      return false;
    }
    for (const domain of excludeDomains) {
      if (img.url.includes(domain)) {
        return false;
      }
    }
    return true;
  });

  if (externalImages.length === 0) {
    return {
      markdown: markdownText,
      downloaded: 0,
      total: 0,
      replacements: [],
      metadata: [],
    };
  }

  const replacements = [];
  const metadata = [];
  let downloadedCount = 0;
  let updatedMarkdown = markdownText;

  for (let i = 0; i < externalImages.length; i++) {
    const image = externalImages[i];
    const localFilename = generateLocalFilename(image.url, i);
    const relativePath = `${imagesDir}/${localFilename}`;

    if (onProgress) {
      onProgress(i + 1, externalImages.length, 'downloading', image.url);
    }

    if (dryRun) {
      replacements.push({
        from: image.fullMatch,
        to: `![${image.altText}](${relativePath})`,
      });
      metadata.push({
        index: i + 1,
        originalUrl: image.url,
        altText: image.altText,
        localPath: relativePath,
      });
      continue;
    }

    try {
      const resp = await retry(() => fetch(image.url), {
        retries: 3,
        baseDelay: 1000,
      });

      if (!resp.ok) {
        throw new Error(`HTTP ${resp.status}`);
      }

      const buffer = await resp.buffer();
      downloadedCount++;

      replacements.push({
        from: image.fullMatch,
        to: `![${image.altText}](${relativePath})`,
        buffer,
        filename: localFilename,
      });

      metadata.push({
        index: i + 1,
        originalUrl: image.url,
        altText: image.altText,
        localPath: relativePath,
      });

      if (onProgress) {
        onProgress(i + 1, externalImages.length, 'downloaded', image.url);
      }
    } catch {
      if (onProgress) {
        onProgress(i + 1, externalImages.length, 'failed', image.url);
      }
      // Keep original URL if download fails
    }
  }

  // Apply replacements to markdown
  for (const replacement of replacements) {
    updatedMarkdown = updatedMarkdown.replace(replacement.from, replacement.to);
  }

  return {
    markdown: updatedMarkdown,
    downloaded: downloadedCount,
    total: externalImages.length,
    replacements,
    metadata,
  };
}
