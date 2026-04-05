/**
 * Integration tests for the new API endpoints.
 *
 * Tests /image, /archive, /pdf, /docx endpoints with various options.
 * Uses nock to mock external requests for fast, reliable testing.
 */

import { jest } from '@jest/globals';
import request from 'supertest';
import nock from 'nock';
import { app } from '../../src/index.js';

jest.setTimeout(60000);

const MOCK_HTML = `<!DOCTYPE html>
<html><head><title>Test</title></head>
<body>
<h1>Test Page</h1>
<p>Hello world</p>
<img src="https://example.com/image.png" alt="test">
</body></html>`;

beforeAll(() => {
  nock('https://example.com').get('/test').reply(200, MOCK_HTML, {
    'content-type': 'text/html',
  });
});

afterAll(() => {
  nock.cleanAll();
});

describe('API Endpoint Tests', () => {
  describe('GET /image', () => {
    it('rejects invalid format', async () => {
      await request(app)
        .get('/image')
        .query({ url: 'https://example.com/test', format: 'bmp' })
        .expect(400);
    });

    it('returns 400 without url', async () => {
      await request(app).get('/image').expect(400);
    });
  });

  describe('GET /markdown', () => {
    it('returns markdown', async () => {
      nock('https://example.com').get('/md-test').reply(200, MOCK_HTML, {
        'content-type': 'text/html',
      });

      const res = await request(app)
        .get('/markdown')
        .query({ url: 'https://example.com/md-test' })
        .expect(200);

      expect(res.headers['content-type']).toMatch(/text\/markdown/);
      expect(res.text).toContain('Test Page');
      expect(res.text).toContain('Hello world');
    });
  });

  describe('GET /archive', () => {
    it('returns a ZIP archive with remote images', async () => {
      nock('https://example.com').get('/archive-test').reply(200, MOCK_HTML, {
        'content-type': 'text/html',
      });

      const res = await request(app)
        .get('/archive')
        .query({
          url: 'https://example.com/archive-test',
          localImages: 'false',
        })
        .buffer(true)
        .parse((res, callback) => {
          const chunks = [];
          res.on('data', (chunk) => chunks.push(chunk));
          res.on('end', () => callback(null, Buffer.concat(chunks)));
        })
        .expect(200);

      expect(res.body).toBeInstanceOf(Buffer);
      expect(res.body.length).toBeGreaterThan(50);
      // ZIP signature: PK (0x50 0x4B)
      expect(res.body[0]).toBe(0x50);
      expect(res.body[1]).toBe(0x4b);
    });

    it('returns 400 without url', async () => {
      await request(app).get('/archive').expect(400);
    });
  });

  describe('GET /docx', () => {
    it('returns a DOCX document', async () => {
      nock('https://example.com').get('/docx-test').reply(200, MOCK_HTML, {
        'content-type': 'text/html',
      });

      const res = await request(app)
        .get('/docx')
        .query({ url: 'https://example.com/docx-test' })
        .buffer(true)
        .parse((res, callback) => {
          const chunks = [];
          res.on('data', (chunk) => chunks.push(chunk));
          res.on('end', () => callback(null, Buffer.concat(chunks)));
        })
        .expect(200);

      expect(res.body).toBeInstanceOf(Buffer);
      expect(res.body.length).toBeGreaterThan(100);
      // DOCX is a ZIP file
      expect(res.body[0]).toBe(0x50);
      expect(res.body[1]).toBe(0x4b);
    });

    it('returns 400 without url', async () => {
      await request(app).get('/docx').expect(400);
    });
  });

  describe('GET /pdf', () => {
    it('returns 400 without url', async () => {
      await request(app).get('/pdf').expect(400);
    });
  });
});
