/* global document, window */
import { googleDocsBrowserModelUnavailableError } from './gdocs-fallback.js';

const DEFAULT_GDOCS_MODEL_STABILITY_MS = 1500;
const DEFAULT_GDOCS_MODEL_MAX_WAIT_MS = 30000;
const DEFAULT_GDOCS_MODEL_POLL_MS = 250;

export async function waitForGoogleDocsModelQuiescence(
  page,
  { documentId, maxWaitMs, stabilityMs, pollMs, log }
) {
  const started = Date.now();
  let lastFingerprint = null;
  let stableSince = null;
  let lastModelData = null;
  let lastStableForMs = 0;
  let pollCount = 0;

  while (true) {
    const modelData = await readGoogleDocsModelData(page);
    pollCount += 1;
    const fingerprint = googleDocsModelFingerprint(modelData);
    lastModelData = modelData;

    if (
      fingerprint.chunks > 0 &&
      sameModelFingerprint(fingerprint, lastFingerprint)
    ) {
      if (stableSince === null) {
        stableSince = Date.now();
      }
      lastStableForMs = Date.now() - stableSince;
      if (lastStableForMs >= stabilityMs) {
        log?.debug?.(() => ({
          event: 'gdocs.browser-model.quiesced',
          documentId,
          chunks: fingerprint.chunks,
          chunkPayloadBytes: fingerprint.payloadBytes,
          cidUrls: Object.keys(modelData.cidUrlMap || {}).length,
          pollCount,
          stableForMs: lastStableForMs,
          elapsedMs: Date.now() - started,
        }));
        return {
          ...modelData,
          chunkPayloadBytes: fingerprint.payloadBytes,
          pollCount,
          stableForMs: lastStableForMs,
        };
      }
    } else {
      lastFingerprint = fingerprint;
      stableSince = null;
      lastStableForMs = 0;
    }

    const elapsedMs = Date.now() - started;
    if (elapsedMs >= maxWaitMs) {
      const lastChunks = lastModelData?.chunks?.length || 0;
      const lastCidUrls = Object.keys(lastModelData?.cidUrlMap || {}).length;
      throw googleDocsBrowserModelUnavailableError(
        `Google Docs DOCS_modelChunk stream did not quiesce within ${maxWaitMs} ms for document ${documentId} (last chunks=${lastChunks}, payload_bytes=${fingerprint.payloadBytes}, cid_urls=${lastCidUrls}, poll_count=${pollCount}, stable_for_ms=${lastStableForMs})`
      );
    }

    await waitForPage(page, Math.min(pollMs, maxWaitMs - elapsedMs));
  }
}

export function resolveGoogleDocsModelWaitOptions(options) {
  return {
    stabilityMs: readDurationMs(
      options.modelStabilityMs,
      'WEB_CAPTURE_GDOCS_STABILITY_MS',
      DEFAULT_GDOCS_MODEL_STABILITY_MS
    ),
    maxWaitMs: readDurationMs(
      options.modelMaxWaitMs ?? options.waitMs,
      'WEB_CAPTURE_GDOCS_MAX_WAIT_MS',
      DEFAULT_GDOCS_MODEL_MAX_WAIT_MS
    ),
    pollMs: Math.max(
      1,
      readDurationMs(
        options.modelPollMs,
        'WEB_CAPTURE_GDOCS_POLL_MS',
        DEFAULT_GDOCS_MODEL_POLL_MS
      )
    ),
  };
}

async function readGoogleDocsModelData(page) {
  return await evaluateOnPage(page, () => {
    const chunks = [...(window.__captured_chunks || [])];
    if (
      window.DOCS_modelChunk &&
      chunks.length === 0 &&
      !chunks.includes(window.DOCS_modelChunk)
    ) {
      chunks.push(window.DOCS_modelChunk);
    }
    const cidUrlMap = {};
    const scripts = document.querySelectorAll('script');
    for (const script of scripts) {
      const text = script.textContent || '';
      if (!text.includes('docs-images-rt')) {
        continue;
      }
      const regex =
        /"([A-Za-z0-9_-]{20,})"\s*:\s*"(https:\/\/docs\.google\.com\/docs-images-rt\/[^"]+)"/g;
      let match;
      while ((match = regex.exec(text)) !== null) {
        cidUrlMap[match[1]] = match[2]
          .replace(/\\u003d/g, '=')
          .replace(/\\u0026/g, '&')
          .replace(/\\\//g, '/');
      }
    }
    return { chunks, cidUrlMap };
  });
}

function googleDocsModelFingerprint(modelData) {
  const chunks = modelData?.chunks || [];
  return {
    chunks: chunks.length,
    payloadBytes: chunks.reduce(
      (total, chunk) => total + jsonPayloadByteLength(chunk),
      0
    ),
  };
}

function sameModelFingerprint(left, right) {
  return (
    Boolean(left) &&
    Boolean(right) &&
    left.chunks === right.chunks &&
    left.payloadBytes === right.payloadBytes
  );
}

function jsonPayloadByteLength(value) {
  try {
    return Buffer.byteLength(JSON.stringify(value) || '');
  } catch {
    return 0;
  }
}

function readDurationMs(optionValue, envName, defaultValue) {
  const rawValue = optionValue ?? process.env[envName];
  if (rawValue === undefined || rawValue === null || rawValue === '') {
    return defaultValue;
  }
  const parsed = Number(rawValue);
  if (!Number.isFinite(parsed) || parsed < 0) {
    return defaultValue;
  }
  return Math.floor(parsed);
}

async function waitForPage(page, waitMs) {
  if (waitMs <= 0) {
    return;
  }
  const rawPage = page.rawPage || page;
  if (typeof rawPage.waitForTimeout === 'function') {
    await rawPage.waitForTimeout(waitMs);
    return;
  }
  if (typeof page.waitForTimeout === 'function') {
    await page.waitForTimeout(waitMs);
    return;
  }
  await new Promise((resolve) => setTimeout(resolve, waitMs));
}

async function evaluateOnPage(page, fn) {
  const rawPage = page.rawPage || page;
  if (rawPage !== page && typeof rawPage.evaluate === 'function') {
    return await rawPage.evaluate(fn);
  }
  return await page.evaluate(fn);
}
