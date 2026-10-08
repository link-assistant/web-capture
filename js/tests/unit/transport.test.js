import { createServer } from 'node:net';
import { captureResponse } from '../../src/transport.js';

async function closedPortUrl() {
  const server = createServer();
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const { port } = server.address();
  await new Promise((resolve) => server.close(resolve));
  return `http://127.0.0.1:${port}/`;
}

async function captureError(url, options) {
  try {
    await captureResponse(url, options);
  } catch (error) {
    return error;
  }
  throw new Error('captureResponse did not reject');
}

test("Node's built-in fetch failures keep their cause and are not reported as CORS", async () => {
  const url = await closedPortUrl();
  const error = await captureError(url);
  expect(error.message).toMatch(/^fetch failed: .*ECONNREFUSED/);
  expect(error.diagnostics).toMatchObject({
    outcome: 'error',
    errorKind: 'transport',
    sourceUrl: url,
    error: error.message,
  });
});

test('a browser-style cause-less TypeError stays ambiguous between CORS and transport', async () => {
  const error = await captureError('https://example.test/', {
    transport: async () => {
      throw new TypeError('Failed to fetch');
    },
  });
  expect(error.diagnostics).toMatchObject({
    errorKind: 'cors_or_transport',
    error: 'Failed to fetch',
  });
});

test('undici timeout causes are classified as timeouts', async () => {
  const error = await captureError('https://example.test/', {
    transport: async () => {
      throw new TypeError('fetch failed', {
        cause: Object.assign(new Error('Connect Timeout Error'), {
          code: 'UND_ERR_CONNECT_TIMEOUT',
        }),
      });
    },
  });
  expect(error.diagnostics.errorKind).toBe('timeout');
  expect(error.message).toBe('fetch failed: Connect Timeout Error');
});
