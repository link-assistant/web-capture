import {
  copyProxyResponseHeaders,
  getProxyHeaderEntries,
} from '../../src/proxy-headers.js';

describe('proxy header helpers', () => {
  it('removes hop-by-hop headers and headers named by Connection', () => {
    const entries = getProxyHeaderEntries(
      headers({
        'Content-Type': 'text/html',
        Connection: 'keep-alive, X-Internal-Hop',
        'Keep-Alive': 'timeout=5',
        TE: 'trailers',
        Trailer: 'Expires',
        Upgrade: 'websocket',
        'Proxy-Authenticate': 'Basic',
        'Proxy-Authorization': 'Basic token',
        'Transfer-Encoding': 'chunked',
        'X-Internal-Hop': 'remove me',
        'X-End-To-End': 'keep me',
      })
    );

    expect(Object.fromEntries(entries)).toEqual({
      'content-type': 'text/html',
      'x-end-to-end': 'keep me',
    });
  });

  it('preserves content length only for unencoded streaming responses', () => {
    expect(
      Object.fromEntries(
        getProxyHeaderEntries(
          headers({
            'Content-Type': 'text/plain',
            'Content-Length': '12',
          }),
          { preserveContentLength: true }
        )
      )
    ).toEqual({
      'content-type': 'text/plain',
      'content-length': '12',
    });

    expect(
      Object.fromEntries(
        getProxyHeaderEntries(
          headers({
            'Content-Type': 'text/plain',
            'Content-Length': '12',
            'Content-Encoding': 'gzip',
          }),
          { preserveContentLength: true }
        )
      )
    ).toEqual({
      'content-type': 'text/plain',
    });
  });

  it('sets a default content type while copying safe headers', () => {
    const res = responseRecorder();

    copyProxyResponseHeaders(
      headers({
        ETag: '"abc"',
      }),
      res
    );

    expect(res.headers).toEqual({
      'content-type': 'text/plain',
      etag: '"abc"',
    });
  });
});

function headers(values) {
  const map = new Map(
    Object.entries(values).map(([key, value]) => [key.toLowerCase(), value])
  );
  return {
    get(key) {
      return map.get(key.toLowerCase()) || null;
    },
    entries() {
      return map.entries();
    },
  };
}

function responseRecorder() {
  return {
    headers: {},
    setHeader(key, value) {
      this.headers[key.toLowerCase()] = value;
    },
  };
}
