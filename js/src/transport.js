export const RECEIPT_HEADERS = [
  'cache-control',
  'content-encoding',
  'content-length',
  'content-type',
  'etag',
  'last-modified',
  'location',
];

function selectedHeaders(headers) {
  const selected = {};
  for (const name of RECEIPT_HEADERS) {
    const value =
      typeof headers?.get === 'function' ? headers.get(name) : headers?.[name];
    if (value !== null && value !== undefined) {
      selected[name] = String(value);
    }
  }
  return selected;
}

const TIMEOUT_CAUSE_CODES = new Set([
  'ETIMEDOUT',
  'UND_ERR_CONNECT_TIMEOUT',
  'UND_ERR_HEADERS_TIMEOUT',
  'UND_ERR_BODY_TIMEOUT',
]);

function classifyTransportError(error, signal) {
  if (signal?.aborted || error?.name === 'AbortError') {
    return 'cancelled';
  }
  if (
    error?.name === 'TimeoutError' ||
    TIMEOUT_CAUSE_CODES.has(error?.cause?.code)
  ) {
    return 'timeout';
  }
  // Node's built-in fetch rejects every network failure with
  // TypeError('fetch failed') and the real reason in `cause`. Browsers give a
  // cause-less TypeError for CORS and network errors alike.
  if (error?.name === 'TypeError' && !error.cause) {
    return 'cors_or_transport';
  }
  return 'transport';
}

/** Message of `error` including its `cause`, e.g. "fetch failed: getaddrinfo ENOTFOUND host". */
export function describeTransportError(error) {
  const message = error?.message || String(error);
  const cause = error?.cause?.message;
  return cause && !message.includes(cause) ? `${message}: ${cause}` : message;
}

export class CaptureTransportError extends Error {
  constructor(error, url, signal) {
    super(describeTransportError(error));
    this.name = 'CaptureTransportError';
    this.cause = error;
    this.diagnostics = {
      outcome: 'error',
      errorKind: classifyTransportError(error, signal),
      sourceUrl: url,
      error: this.message,
    };
  }
}

/** Default caller-replaceable transport. Dropping/aborting `signal` cancels fetch. */
export function fetchTransport({ url, method = 'GET', headers, signal }) {
  return fetch(url, { method, headers, signal });
}

/**
 * Capture an HTTP response without decoding its body.
 *
 * A custom transport receives `{url, method, headers, signal}` and may return
 * either a Fetch `Response` or an already materialized receipt. The returned
 * body is a Buffer containing the exact response bytes.
 */
export async function captureResponse(
  url,
  { transport = fetchTransport, signal, headers = {}, method = 'GET' } = {}
) {
  if (!url) {
    throw new Error('Missing URL parameter');
  }
  const request = { url, method, headers, signal };
  try {
    const response = await transport(request);
    if (
      response?.body !== null &&
      response?.body !== undefined &&
      response?.finalUrl &&
      response?.diagnostics
    ) {
      return { ...response, body: Buffer.from(response.body) };
    }
    if (
      !response ||
      (typeof response.arrayBuffer !== 'function' &&
        typeof response.text !== 'function')
    ) {
      throw new TypeError(
        'Transport must return a Response or response receipt'
      );
    }
    const body =
      typeof response.arrayBuffer === 'function'
        ? Buffer.from(await response.arrayBuffer())
        : Buffer.from(await response.text());
    return {
      body,
      finalUrl: response.url || url,
      status: response.status,
      headers: selectedHeaders(response.headers),
      diagnostics: { outcome: 'response' },
    };
  } catch (error) {
    if (error instanceof CaptureTransportError) {
      throw error;
    }
    throw new CaptureTransportError(error, url, signal);
  }
}
