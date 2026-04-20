// Google Docs browser-model fallback helpers.
//
// When browser-model capture cannot read DOCS_modelChunk data from the editor
// page, fall back to the public export pipeline so that content and images
// are preserved (instead of returning an empty or lossy capture).

const GDOCS_BROWSER_MODEL_UNAVAILABLE = 'GDOCS_BROWSER_MODEL_UNAVAILABLE';

/**
 * Build the sentinel error thrown when browser-model capture finds no chunks.
 *
 * @param {string} message - Human-readable error message
 * @returns {Error} Error carrying the sentinel code
 */
export function googleDocsBrowserModelUnavailableError(message) {
  const err = new Error(message);
  err.code = GDOCS_BROWSER_MODEL_UNAVAILABLE;
  return err;
}

/**
 * Check whether an error means Google Docs browser-model data was unavailable.
 *
 * @param {Error} err - Error to classify
 * @returns {boolean} True if export fallback is appropriate
 */
export function isGoogleDocsBrowserModelUnavailableError(err) {
  return (
    err?.code === GDOCS_BROWSER_MODEL_UNAVAILABLE ||
    String(err?.message || '').includes('did not expose DOCS_modelChunk data')
  );
}

/**
 * Fetch a Google Doc through the public export pipeline for a requested output
 * format. This is used as the lossless fallback when browser-model capture
 * cannot read DOCS_modelChunk data from the editor page.
 *
 * @param {Object} deps - Injected dependencies from gdocs.js
 * @param {string} url - Google Docs URL
 * @param {Object} [options] - Options
 * @returns {Promise<Object>} Export result normalized for CLI rendering
 */
export async function fetchGoogleDocByExportFormat(deps, url, options = {}) {
  const { fetchGoogleDoc, fetchGoogleDocAsMarkdown, fetchGoogleDocAsArchive } =
    deps;
  const { format = 'markdown', apiToken, log } = options;
  const normalized = (format || 'markdown').toLowerCase();

  if (normalized === 'archive' || normalized === 'zip') {
    const archiveResult = await fetchGoogleDocAsArchive(url, { apiToken, log });
    return {
      ...archiveResult,
      content: archiveResult.markdown,
      sourceFormat: 'archive',
    };
  }

  if (normalized === 'markdown' || normalized === 'md') {
    const result = await fetchGoogleDocAsMarkdown(url, { apiToken, log });
    return {
      ...result,
      content: result.markdown,
      sourceFormat: 'markdown',
    };
  }

  if (normalized === 'html') {
    const result = await fetchGoogleDoc(url, {
      format: 'html',
      apiToken,
      log,
    });
    return {
      ...result,
      html: result.content,
      sourceFormat: 'html',
    };
  }

  if (normalized === 'txt' || normalized === 'text') {
    const result = await fetchGoogleDoc(url, {
      format: 'txt',
      apiToken,
      log,
    });
    return {
      ...result,
      text: result.content,
      sourceFormat: 'txt',
    };
  }

  throw new Error(
    `Unsupported Google Docs export fallback format "${format}".`
  );
}

/**
 * Capture a Google Doc through the browser model, falling back to public export
 * when the editor does not expose model chunks.
 *
 * @param {Object} deps - Injected dependencies from gdocs.js
 * @param {string} url - Google Docs URL
 * @param {Object} [options] - Capture options
 * @returns {Promise<Object>} Browser-model or public-export result
 */
export async function captureGoogleDocWithBrowserOrFallback(
  deps,
  url,
  options = {}
) {
  const { captureGoogleDocWithBrowser } = deps;
  const {
    format = 'markdown',
    fallback = true,
    onFallback,
    ...browserOptions
  } = options;

  try {
    const result = await captureGoogleDocWithBrowser(url, browserOptions);
    return {
      ...result,
      method: 'browser-model',
      fallback: false,
    };
  } catch (err) {
    if (!fallback || !isGoogleDocsBrowserModelUnavailableError(err)) {
      throw err;
    }

    onFallback?.(err);
    browserOptions.log?.warn?.(() => ({
      event: 'gdocs.browser-model.fallback-public-export',
      reason: err.message,
      format,
    }));

    const result = await fetchGoogleDocByExportFormat(deps, url, {
      format,
      apiToken: browserOptions.apiToken,
      log: browserOptions.log,
    });
    return {
      ...result,
      method: 'public-export',
      fallback: true,
      browserError: err.message,
    };
  }
}
