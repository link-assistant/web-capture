/**
 * Integration tests for the API endpoints.
 *
 * Tests /image, /archive, /pdf, /docx endpoints with various options.
 * Uses nock to mock external requests for fast, reliable unit-level testing.
 * These tests validate endpoint behavior and response formats.
 */

import { jest } from '@jest/globals';
import request from 'supertest';
import nock from 'nock';
import { app } from '../../src/index.js';

jest.setTimeout(60000);

const MOCK_HTML = `<!DOCTYPE html>
<html><head><title>Test</title>
<link rel="stylesheet" href="https://example.com/style.css">
</head>
<body>
<h1>Test Page</h1>
<p>Hello world</p>
<img src="https://example.com/image.png" alt="test">
</body></html>`;

afterEach(() => {
  nock.cleanAll();
});

describe('API Endpoint Tests', () => {
  describe('unsupported routes', () => {
    it('does not expose /gdocs as an output-format endpoint', async () => {
      await request(app)
        .get('/gdocs')
        .query({
          url: 'https://docs.google.com/document/d/test-doc/edit',
        })
        .expect(404);
    });
  });

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
    it('returns a ZIP archive with remote images (markdown format)', async () => {
      nock('https://example.com').get('/archive-test').reply(200, MOCK_HTML, {
        'content-type': 'text/html',
      });

      const res = await request(app)
        .get('/archive')
        .query({
          url: 'https://example.com/archive-test',
          localImages: 'false',
          documentFormat: 'markdown',
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

    it('returns a ZIP archive with HTML format', async () => {
      nock('https://example.com')
        .get('/archive-html-test')
        .reply(200, MOCK_HTML, {
          'content-type': 'text/html',
        });

      const res = await request(app)
        .get('/archive')
        .query({
          url: 'https://example.com/archive-html-test',
          localImages: 'false',
          documentFormat: 'html',
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
      // ZIP signature
      expect(res.body[0]).toBe(0x50);
      expect(res.body[1]).toBe(0x4b);
    });

    it('returns a ZIP archive with local images and folders', async () => {
      const mockPng = Buffer.from([
        0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a,
      ]);

      nock('https://example.com')
        .get('/archive-local-test')
        .reply(200, MOCK_HTML, { 'content-type': 'text/html' });

      nock('https://example.com')
        .get('/image.png')
        .reply(200, mockPng, { 'content-type': 'image/png' });

      const res = await request(app)
        .get('/archive')
        .query({
          url: 'https://example.com/archive-local-test',
          localImages: 'true',
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
      // ZIP signature
      expect(res.body[0]).toBe(0x50);
      expect(res.body[1]).toBe(0x4b);
    });

    it('returns a ZIP archive with HTML format and local CSS', async () => {
      const mockCss = 'body { background: #fff; }';
      const mockPng = Buffer.from([
        0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a,
      ]);

      nock('https://example.com')
        .get('/archive-html-local')
        .reply(200, MOCK_HTML, { 'content-type': 'text/html' });

      nock('https://example.com')
        .get('/style.css')
        .reply(200, mockCss, { 'content-type': 'text/css' });

      nock('https://example.com')
        .get('/image.png')
        .reply(200, mockPng, { 'content-type': 'image/png' });

      const res = await request(app)
        .get('/archive')
        .query({
          url: 'https://example.com/archive-html-local',
          localImages: 'true',
          documentFormat: 'html',
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
      // ZIP signature
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
