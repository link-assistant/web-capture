const HOP_BY_HOP_HEADERS = new Set([
  'connection',
  'keep-alive',
  'proxy-authenticate',
  'proxy-authorization',
  'te',
  'trailer',
  'transfer-encoding',
  'upgrade',
]);

const TRANSFORMED_BODY_HEADERS = new Set(['content-encoding']);

export function getProxyHeaderEntries(sourceHeaders, options = {}) {
  const { preserveContentLength = false } = options;
  const connectionTokens = getConnectionTokens(sourceHeaders);
  const isEncoded = Boolean(sourceHeaders.get('content-encoding'));
  const entries = [];

  for (const [key, value] of sourceHeaders.entries()) {
    const lowerKey = key.toLowerCase();
    if (
      HOP_BY_HOP_HEADERS.has(lowerKey) ||
      TRANSFORMED_BODY_HEADERS.has(lowerKey) ||
      connectionTokens.has(lowerKey)
    ) {
      continue;
    }
    if (
      lowerKey === 'content-length' &&
      (!preserveContentLength || isEncoded)
    ) {
      continue;
    }
    entries.push([key, value]);
  }

  return entries;
}

export function copyProxyResponseHeaders(sourceHeaders, res, options = {}) {
  const contentType = sourceHeaders.get('content-type') || 'text/plain';
  res.setHeader('Content-Type', contentType);

  for (const [key, value] of getProxyHeaderEntries(sourceHeaders, options)) {
    if (key.toLowerCase() !== 'content-type') {
      res.setHeader(key, value);
    }
  }
}

function getConnectionTokens(sourceHeaders) {
  const connection = sourceHeaders.get('connection') || '';
  return new Set(
    connection
      .split(',')
      .map((token) => token.trim().toLowerCase())
      .filter(Boolean)
  );
}
