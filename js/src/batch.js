/**
 * Batch processing and configuration module (R7).
 *
 * Supports processing multiple URLs from a configuration file.
 * Configuration format matches the articles-config pattern from meta-theory.
 *
 * Based on reference implementation from:
 * https://github.com/link-foundation/meta-theory/blob/main/scripts/articles-config.mjs
 *
 * @module batch
 */

import fs from 'fs';
import { URL } from 'url';

/**
 * @typedef {Object} ArticleConfig
 * @property {string} url - Article URL
 * @property {string} [title] - Article title
 * @property {string} [language] - Article language (e.g., 'en', 'ru')
 * @property {string} [archivePath] - Local archive directory path
 * @property {string} [markdownFile] - Output markdown filename
 * @property {string} [screenshotLightFile] - Light theme screenshot filename
 * @property {string} [screenshotDarkFile] - Dark theme screenshot filename
 * @property {string} [imagesDir] - Images directory name
 * @property {boolean} [hasLocalImages] - Whether to download images locally
 * @property {number} [expectedFigures] - Expected number of figure images
 * @property {string} [format] - Output format override
 */

/**
 * @typedef {Object} BatchConfig
 * @property {Object<string, ArticleConfig>} articles - Map of version/id to article config
 * @property {Object} [defaults] - Default options applied to all articles
 */

/**
 * Load batch configuration from a JSON or JavaScript file.
 *
 * Supports:
 * - JSON files (.json)
 * - JavaScript/ESM files (.mjs, .js) with default or named exports
 *
 * @param {string} configPath - Path to configuration file
 * @returns {Promise<BatchConfig>} Loaded configuration
 */
export async function loadConfig(configPath) {
  const ext = configPath.split('.').pop().toLowerCase();

  if (ext === 'json') {
    const content = fs.readFileSync(configPath, 'utf-8');
    return JSON.parse(content);
  }

  if (ext === 'mjs' || ext === 'js') {
    // Dynamic import for ESM modules
    const fileUrl = new URL(`file://${configPath}`);
    const module = await import(fileUrl.href);

    // Support both default export and named exports
    if (module.default) {
      return module.default;
    }

    // If module exports ARTICLES (matching meta-theory pattern)
    if (module.ARTICLES) {
      return { articles: module.ARTICLES };
    }

    return module;
  }

  throw new Error(
    `Unsupported config format: .${ext}. Use .json, .mjs, or .js`
  );
}

/**
 * Get article configuration by version/id.
 *
 * @param {BatchConfig} config - Batch configuration
 * @param {string} version - Article version/id
 * @returns {ArticleConfig} Article configuration
 */
export function getArticle(config, version) {
  const article = config.articles[version];
  if (!article) {
    throw new Error(
      `Unknown article version: ${version}. Available: ${Object.keys(config.articles).join(', ')}`
    );
  }
  // Merge defaults
  return { ...config.defaults, ...article };
}

/**
 * Get all article versions from configuration.
 *
 * @param {BatchConfig} config - Batch configuration
 * @returns {string[]} Array of version/id strings
 */
export function getAllVersions(config) {
  return Object.keys(config.articles);
}

/**
 * Get all article configurations.
 *
 * @param {BatchConfig} config - Batch configuration
 * @returns {ArticleConfig[]} Array of article configs (with defaults merged)
 */
export function getAllArticles(config) {
  return Object.values(config.articles).map((article) => ({
    ...config.defaults,
    ...article,
  }));
}

/**
 * Create a default batch configuration for a list of URLs.
 *
 * @param {string[]} urls - Array of URLs to process
 * @param {Object} [defaults] - Default options for all articles
 * @returns {BatchConfig} Generated configuration
 */
export function createConfigFromUrls(urls, defaults = {}) {
  const articles = {};

  urls.forEach((url, index) => {
    const id = String(index + 1);
    let hostname;
    try {
      hostname = new URL(url).hostname;
    } catch {
      hostname = 'article';
    }

    articles[id] = {
      url,
      title: `Article ${id}`,
      archivePath: `archive/${hostname.replace(/\./g, '-')}/${id}`,
      markdownFile: 'article.md',
      screenshotLightFile: 'article-light.png',
      screenshotDarkFile: 'article-dark.png',
      imagesDir: 'images',
      hasLocalImages: true,
    };
  });

  return { articles, defaults };
}

/**
 * Validate a batch configuration.
 *
 * @param {BatchConfig} config - Configuration to validate
 * @returns {Object} Validation result with {valid, errors}
 */
export function validateConfig(config) {
  const errors = [];

  if (!config.articles || typeof config.articles !== 'object') {
    errors.push('Configuration must have an "articles" object');
    return { valid: false, errors };
  }

  for (const [id, article] of Object.entries(config.articles)) {
    if (!article.url) {
      errors.push(`Article "${id}" missing required "url" field`);
    } else {
      try {
        new URL(article.url);
      } catch {
        errors.push(`Article "${id}" has invalid URL: ${article.url}`);
      }
    }
  }

  return { valid: errors.length === 0, errors };
}
