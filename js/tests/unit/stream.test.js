import express from 'express';
import http from 'http';
import request from 'supertest';
import { streamHandler } from '../../src/stream.js';

describe('streamHandler', () => {
  it('streams upstream content with proxy-safe framing', async () => {
    const body = '<!DOCTYPE html><html><body>Example Domain</body></html>';
    let upstreamHeaders;
    const { server, url } = await startUpstreamServer((req, res) => {
      upstreamHeaders = req.headers;
      res.writeHead(200, {
        'Content-Type': 'text/html; charset=utf-8',
        'Content-Length': Buffer.byteLength(body),
      });
      res.end(body);
    });

    try {
      const res = await request(testApp())
        .get('/stream')
        .query({ url })
        .expect(200);

      expect(upstreamHeaders['accept-encoding']).toBe('identity');
      expect(res.headers['content-type']).toBe('text/html; charset=utf-8');
      expect(res.headers['content-length']).toBe(
        String(Buffer.byteLength(body))
      );
      expect(res.text).toContain('Example Domain');
    } finally {
      await closeServer(server);
    }
  });

  it('ends the downstream response when upstream closes after body bytes', async () => {
    const body = '<!DOCTYPE html><html><body>Example Domain</body></html>';
    const { server, url } = await startUpstreamServer((req, res) => {
      res.writeHead(200, {
        'Content-Type': 'text/html; charset=utf-8',
      });
      res.write(body);
      res.socket.end();
    });

    try {
      const res = await request(testApp())
        .get('/stream')
        .query({ url })
        .expect(200);

      expect(res.text).toContain('Example Domain');
    } finally {
      await closeServer(server);
    }
  });
});

function testApp() {
  const app = express();
  app.get('/stream', streamHandler);
  return app;
}

async function startUpstreamServer(handler) {
  const server = http.createServer(handler);
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const { port } = server.address();
  return {
    server,
    url: `http://127.0.0.1:${port}`,
  };
}

async function closeServer(server) {
  await new Promise((resolve, reject) => {
    server.close((error) => {
      if (error) {
        reject(error);
      } else {
        resolve();
      }
    });
  });
}
