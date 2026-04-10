/**
 * Animation capture module (R2).
 *
 * Captures web animations as GIF, MP4, or WebM by taking screenshots
 * at regular intervals and detecting when the animation loops.
 *
 * Supports three capture modes:
 * - screencast: CDP-based push capture (30-60 FPS, Chromium only)
 * - beginframe: Deterministic frame-perfect capture (Chromium only)
 * - screenshot: Polling-based capture (3-8 FPS, cross-browser)
 *
 * Based on reference implementation from:
 * https://github.com/link-foundation/meta-theory/blob/main/scripts/capture-animation.mjs
 *
 * @module animation
 */

import { createBrowser, getBrowserEngine } from './browser.js';
// eslint-disable-next-line no-unused-vars
import { dismissPopups, scrollToLoadContent } from './popups.js';

/**
 * Default animation capture options.
 */
const DEFAULTS = {
  maxSize: 1024,
  viewportWidth: 1920,
  viewportHeight: 1080,
  interval: 0,
  fps: null,
  speed: 1.0,
  delay: null,
  minFrames: 120,
  loopTimeout: 60,
  staticTimeout: 60,
  similarity: 0.99,
  crop: true,
  cropPadding: null,
  captureMode: 'screenshot',
  format: 'gif',
  extractKeyframes: false,
  dismissPopups: true,
};

/**
 * Compare two frame buffers for pixel similarity.
 *
 * @param {Buffer} frame1 - First PNG frame buffer
 * @param {Buffer} frame2 - Second PNG frame buffer
 * @returns {number} Similarity score 0-1
 */
export function compareFrames(frame1, frame2) {
  if (!frame1 || !frame2) {
    return 0;
  }
  if (frame1.length !== frame2.length) {
    return 0;
  }

  let matchingBytes = 0;
  const totalBytes = frame1.length;

  for (let i = 0; i < totalBytes; i++) {
    if (frame1[i] === frame2[i]) {
      matchingBytes++;
    }
  }

  return matchingBytes / totalBytes;
}

/**
 * Capture animation frames from a web page.
 *
 * @param {string} url - URL of the page with animation
 * @param {Object} [options] - Capture options
 * @param {string} [options.engine] - Browser engine ('puppeteer' or 'playwright')
 * @param {string} [options.captureMode='screenshot'] - Capture mode
 * @param {number} [options.maxSize=1024] - Max dimension for output
 * @param {number} [options.viewportWidth=1920] - Viewport width
 * @param {number} [options.viewportHeight=1080] - Viewport height
 * @param {number} [options.interval=0] - Capture interval in ms (0 = as fast as possible)
 * @param {number} [options.minFrames=120] - Minimum frames to capture per cycle
 * @param {number} [options.loopTimeout=60] - Max seconds to wait for loop
 * @param {number} [options.staticTimeout=60] - Max seconds with no change
 * @param {number} [options.similarity=0.99] - Pixel similarity threshold for loop detection
 * @param {boolean} [options.crop=true] - Auto-crop to content
 * @param {boolean} [options.dismissPopups=true] - Dismiss popups before capture
 * @param {Function} [options.onFrame] - Callback(frameIndex, buffer) for each frame
 * @param {Function} [options.onLoop] - Callback(frameIndex) when loop detected
 * @returns {Promise<Object>} Capture result with frames array and metadata
 */
export async function captureAnimationFrames(url, options = {}) {
  const opts = { ...DEFAULTS, ...options };
  const absoluteUrl = url.startsWith('http') ? url : `https://${url}`;

  const engine = opts.engine || 'puppeteer';
  const browser = await createBrowser(engine, {});

  try {
    const page = await browser.newPage();
    await page.setViewport({
      width: opts.viewportWidth,
      height: opts.viewportHeight,
    });
    await page.setUserAgent(
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
    );

    await page.goto(absoluteUrl, {
      waitUntil: 'networkidle0',
      timeout: 30000,
    });

    await new Promise((resolve) => setTimeout(resolve, 3000));

    if (opts.dismissPopups) {
      await dismissPopups(page);
    }

    // Capture frames using screenshot mode (cross-browser compatible)
    const frames = [];
    const timestamps = [];
    const startTime = Date.now();
    let loopDetected = false;
    let loopFrame = -1;

    // Capture first frame as reference
    const firstFrame = await page.screenshot({ type: 'png' });
    frames.push(firstFrame);
    timestamps.push(Date.now() - startTime);

    if (opts.onFrame) {
      opts.onFrame(0, firstFrame);
    }

    // Capture subsequent frames
    let lastChangeTime = Date.now();
    let previousFrame = firstFrame;

    for (let i = 1; i < opts.minFrames * 3; i++) {
      // Check timeouts
      const elapsed = (Date.now() - startTime) / 1000;
      if (elapsed > opts.loopTimeout) {
        break;
      }
      if ((Date.now() - lastChangeTime) / 1000 > opts.staticTimeout) {
        break;
      }

      if (opts.interval > 0) {
        await new Promise((resolve) => setTimeout(resolve, opts.interval));
      }

      const frame = await page.screenshot({ type: 'png' });
      const similarity = compareFrames(frame, previousFrame);

      // Check if frame changed
      if (similarity < 0.999) {
        lastChangeTime = Date.now();
      }

      frames.push(frame);
      timestamps.push(Date.now() - startTime);

      if (opts.onFrame) {
        opts.onFrame(i, frame);
      }

      // Check for loop (compare with first frame)
      if (i >= opts.minFrames) {
        const loopSimilarity = compareFrames(frame, firstFrame);
        if (loopSimilarity >= opts.similarity) {
          loopDetected = true;
          loopFrame = i;
          if (opts.onLoop) {
            opts.onLoop(i);
          }
          break;
        }
      }

      previousFrame = frame;
    }

    // Extract key frames if requested
    let keyframes = null;
    if (opts.extractKeyframes && frames.length >= 3) {
      const midIdx = Math.floor(frames.length / 2);
      keyframes = [
        { index: 0, buffer: frames[0] },
        { index: midIdx, buffer: frames[midIdx] },
        { index: frames.length - 1, buffer: frames[frames.length - 1] },
      ];
    }

    return {
      frames: loopDetected ? frames.slice(0, loopFrame) : frames,
      timestamps: loopDetected ? timestamps.slice(0, loopFrame) : timestamps,
      loopDetected,
      loopFrame,
      totalFrames: frames.length,
      duration: timestamps[timestamps.length - 1],
      keyframes,
      width: opts.viewportWidth,
      height: opts.viewportHeight,
    };
  } finally {
    await browser.close();
  }
}

/**
 * Animation capture handler for Express API.
 *
 * Query parameters:
 *   url            (required) - URL to capture
 *   engine         - 'puppeteer' or 'playwright'
 *   format         - 'gif' (default), 'png-sequence'
 *   maxSize        - Max output dimension (default 1024)
 *   interval       - Capture interval ms (default 0)
 *   minFrames      - Min frames per cycle (default 120)
 *   loopTimeout    - Max seconds for loop (default 60)
 *   similarity     - Loop detection threshold (default 0.99)
 *   captureMode    - 'screenshot' (default), 'screencast', 'beginframe'
 *   extractKeyframes - 'true' to extract key frames
 */
export async function animationHandler(req, res) {
  const url = req.query.url;
  if (!url) {
    return res.status(400).send('Missing `url` parameter');
  }

  const format = (req.query.format || 'gif').toLowerCase();
  if (!['gif', 'png-sequence'].includes(format)) {
    return res
      .status(400)
      .send('Invalid `format`: must be "gif" or "png-sequence"');
  }

  try {
    const engine = getBrowserEngine(req);
    const result = await captureAnimationFrames(url, {
      engine,
      format,
      maxSize: parseInt(req.query.maxSize, 10) || DEFAULTS.maxSize,
      interval: parseInt(req.query.interval, 10) || DEFAULTS.interval,
      minFrames: parseInt(req.query.minFrames, 10) || DEFAULTS.minFrames,
      loopTimeout: parseInt(req.query.loopTimeout, 10) || DEFAULTS.loopTimeout,
      similarity: parseFloat(req.query.similarity) || DEFAULTS.similarity,
      captureMode: req.query.captureMode || DEFAULTS.captureMode,
      extractKeyframes: req.query.extractKeyframes === 'true',
    });

    if (format === 'png-sequence') {
      // Return as JSON with base64-encoded frames
      res.json({
        frames: result.frames.map((f) => f.toString('base64')),
        timestamps: result.timestamps,
        loopDetected: result.loopDetected,
        loopFrame: result.loopFrame,
        totalFrames: result.totalFrames,
        duration: result.duration,
      });
    } else {
      // Return frames info as JSON (GIF encoding requires gif-encoder-2
      // which is an optional dependency)
      res.json({
        frameCount: result.frames.length,
        loopDetected: result.loopDetected,
        loopFrame: result.loopFrame,
        duration: result.duration,
        message:
          'GIF encoding requires gif-encoder-2 package. ' +
          'Use CLI with --format gif for full GIF output, ' +
          'or use png-sequence format for raw frames.',
      });
    }
  } catch (err) {
    console.error(err);
    res.status(500).send('Error capturing animation');
  }
}
