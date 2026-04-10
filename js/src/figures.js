/**
 * Figure image extraction and download module (R4).
 *
 * Extracts figure images from web pages and downloads them locally.
 * Supports multi-language figure detection (English/Russian).
 *
 * Based on reference implementation from:
 * https://github.com/link-foundation/meta-theory/blob/main/scripts/download.mjs
 *
 * @module figures
 */

import fetch from 'node-fetch';
import * as cheerio from 'cheerio';
import { URL } from 'url';
import { retry } from './retry.js';
import { createBrowser, getBrowserEngine } from './browser.js';
import { dismissPopups, scrollToLoadContent } from './popups.js';

/**
 * Extract figure elements from HTML content.
 *
 * @param {string} html - HTML content
 * @param {string} baseUrl - Base URL for resolving relative URLs
 * @returns {Object[]} Array of figure objects with src, alt, caption, figureNum
 */
export function extractFigures(html, baseUrl) {
  const $ = cheerio.load(html);
  const figures = [];
  let sequentialIndex = 0;

  $('figure').each(function () {
    const img = $(this).find('img').first();
    if (!img.length) {
      return;
    }

    const src = img.attr('src');
    if (!src || src.startsWith('data:') || src.includes('.svg')) {
      return;
    }

    sequentialIndex++;
    const captionEl = $(this).find('figcaption');
    const captionText = captionEl.length ? captionEl.text().trim() : '';

    // Match multi-language figure numbers: "Figure X", "Рис. X", "Рисунок X"
    const figureMatch = captionText.match(/(?:Figure|Рис\.?|Рисунок)\s*(\d+)/i);
    const figureNum = figureMatch ? parseInt(figureMatch[1]) : sequentialIndex;

    let resolvedSrc;
    try {
      resolvedSrc = new URL(src, baseUrl).href;
    } catch {
      resolvedSrc = src;
    }

    figures.push({
      figureNum,
      src: resolvedSrc,
      alt: img.attr('alt') || '',
      caption: captionText,
      sequentialIndex,
    });
  });

  return figures;
}

/**
 * Download figure images to a local directory.
 *
 * @param {Object[]} figures - Array of figure objects from extractFigures
 * @param {Object} [options] - Download options
 * @param {Function} [options.onProgress] - Callback(figureNum, status)
 * @returns {Promise<Object[]>} Array of download results with metadata
 */
export async function downloadFigures(figures, options = {}) {
  const results = [];

  for (const figure of figures) {
    const ext =
      figure.src.includes('.jpeg') || figure.src.includes('.jpg')
        ? 'jpg'
        : 'png';
    const filename = `figure-${figure.figureNum}.${ext}`;

    try {
      const resp = await retry(() => fetch(figure.src), {
        retries: 3,
        baseDelay: 1000,
      });

      if (!resp.ok) {
        throw new Error(`HTTP ${resp.status}`);
      }

      const buffer = await resp.buffer();

      if (options.onProgress) {
        options.onProgress(figure.figureNum, 'downloaded');
      }

      results.push({
        figureNum: figure.figureNum,
        filename,
        buffer,
        caption: figure.caption,
        originalUrl: figure.src,
      });
    } catch (err) {
      if (options.onProgress) {
        options.onProgress(figure.figureNum, 'failed');
      }
      results.push({
        figureNum: figure.figureNum,
        filename,
        buffer: null,
        caption: figure.caption,
        originalUrl: figure.src,
        error: err.message,
      });
    }
  }

  return results;
}

/**
 * Extract and download figures from a URL using browser rendering.
 * This handles JavaScript-rendered pages that require a browser.
 *
 * @param {string} url - URL to extract figures from
 * @param {Object} [options] - Options
 * @param {string} [options.engine] - Browser engine
 * @returns {Promise<Object>} Result with figures and metadata
 */
export async function extractFiguresFromUrl(url, options = {}) {
  const absoluteUrl = url.startsWith('http') ? url : `https://${url}`;
  const engine = options.engine || 'puppeteer';

  const browser = await createBrowser(engine);
  try {
    const page = await browser.newPage();
    await page.setUserAgent(
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
    );
    await page.setViewport({ width: 1920, height: 1080 });
    await page.goto(absoluteUrl, {
      waitUntil: 'networkidle0',
      timeout: 30000,
    });

    await new Promise((resolve) => setTimeout(resolve, 5000));
    await scrollToLoadContent(page);
    await dismissPopups(page);

    const html = await page.content();
    const figures = extractFigures(html, absoluteUrl);
    const downloaded = await downloadFigures(figures, options);

    return {
      url: absoluteUrl,
      figures: downloaded,
      totalFound: figures.length,
      totalDownloaded: downloaded.filter((d) => d.buffer).length,
    };
  } finally {
    await browser.close();
  }
}

/**
 * Figures extraction handler for Express API.
 *
 * Query parameters:
 *   url    (required) - URL to extract figures from
 *   engine - 'puppeteer' or 'playwright'
 */
export async function figuresHandler(req, res) {
  const url = req.query.url;
  if (!url) {
    return res.status(400).send('Missing `url` parameter');
  }

  try {
    const engine = getBrowserEngine(req);
    const result = await extractFiguresFromUrl(url, { engine });

    // Return metadata (not the actual image buffers via JSON)
    res.json({
      url: result.url,
      totalFound: result.totalFound,
      totalDownloaded: result.totalDownloaded,
      figures: result.figures.map((f) => ({
        figureNum: f.figureNum,
        filename: f.filename,
        caption: f.caption,
        originalUrl: f.originalUrl,
        downloaded: !!f.buffer,
        error: f.error || null,
      })),
    });
  } catch (err) {
    console.error(err);
    res.status(500).send('Error extracting figures');
  }
}
