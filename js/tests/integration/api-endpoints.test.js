/**
 * Integration tests for the new API endpoints.
 *
 * Tests /image, /archive, /pdf, /docx endpoints with various options.
 * Uses the Express app directly via supertest.
 */

import request from 'supertest';
import { app } from '../../src/index.js';

// These tests hit live servers and may take a while
jest.setTimeout(120000);

const TEST_URL = 'https://habr.com/en/articles/895896/';

describe('API Endpoint Tests', () => {
  describe('GET /image', () => {
    it('returns PNG by default', async () => {
      const res = await request(app)
        .get('/image')
        .query({ url: TEST_URL })
        .expect(200);

      expect(res.headers['content-type']).toBe('image/png');
      expect(res.body.length).toBeGreaterThan(10000);
      // PNG signature
      expect(res.body[0]).toBe(137);
    });

    it('returns JPEG when format=jpeg', async () => {
      const res = await request(app)
        .get('/image')
        .query({ url: TEST_URL, format: 'jpeg', quality: '60' })
        .expect(200);

      expect(res.headers['content-type']).toBe('image/jpeg');
      expect(res.body.length).toBeGreaterThan(5000);
      // JPEG signature
      expect(res.body[0]).toBe(0xff);
      expect(res.body[1]).toBe(0xd8);
    });

    it('supports custom viewport width', async () => {
      const res = await request(app)
        .get('/image')
        .query({ url: TEST_URL, width: '1920', height: '1080' })
        .expect(200);

      expect(res.headers['content-type']).toBe('image/png');
      expect(res.body.length).toBeGreaterThan(10000);
    });

    it('supports fullPage=true', async () => {
      const res = await request(app)
        .get('/image')
        .query({ url: TEST_URL, fullPage: 'true' })
        .expect(200);

      expect(res.headers['content-type']).toBe('image/png');
      expect(res.body.length).toBeGreaterThan(10000);
    });

    it('supports theme=dark', async () => {
      const res = await request(app)
        .get('/image')
        .query({ url: TEST_URL, theme: 'dark' })
        .expect(200);

      expect(res.headers['content-type']).toBe('image/png');
      expect(res.body.length).toBeGreaterThan(10000);
    });

    it('rejects invalid format', async () => {
      await request(app)
        .get('/image')
        .query({ url: TEST_URL, format: 'bmp' })
        .expect(400);
    });

    it('returns 400 without url', async () => {
      await request(app).get('/image').expect(400);
    });
  });

  describe('GET /markdown', () => {
    it('returns markdown for habr article', async () => {
      const res = await request(app)
        .get('/markdown')
        .query({ url: TEST_URL })
        .expect(200);

      expect(res.headers['content-type']).toMatch(/text\/markdown/);
      expect(res.text.length).toBeGreaterThan(100);
      expect(res.text).toMatch(/^#{1,3}\s/m);
    });
  });

  describe('GET /archive', () => {
    it('returns a ZIP archive', async () => {
      const res = await request(app)
        .get('/archive')
        .query({ url: TEST_URL })
        .expect(200);

      expect(res.headers['content-type']).toBe('application/zip');
      expect(res.body.length).toBeGreaterThan(100);
      // ZIP signature: PK (0x50 0x4B)
      expect(res.body[0]).toBe(0x50);
      expect(res.body[1]).toBe(0x4b);
    });

    it('returns ZIP with remote images when localImages=false', async () => {
      const res = await request(app)
        .get('/archive')
        .query({ url: TEST_URL, localImages: 'false' })
        .expect(200);

      expect(res.headers['content-type']).toBe('application/zip');
      expect(res.body.length).toBeGreaterThan(100);
    });
  });

  describe('GET /pdf', () => {
    it('returns a PDF document', async () => {
      const res = await request(app)
        .get('/pdf')
        .query({ url: TEST_URL })
        .expect(200);

      expect(res.headers['content-type']).toBe('application/pdf');
      expect(res.body.length).toBeGreaterThan(1000);
      // PDF signature: %PDF
      const header = res.body.slice(0, 4).toString();
      expect(header).toBe('%PDF');
    });

    it('supports theme=light', async () => {
      const res = await request(app)
        .get('/pdf')
        .query({ url: TEST_URL, theme: 'light' })
        .expect(200);

      expect(res.headers['content-type']).toBe('application/pdf');
    });
  });

  describe('GET /docx', () => {
    it('returns a DOCX document', async () => {
      const res = await request(app)
        .get('/docx')
        .query({ url: TEST_URL })
        .expect(200);

      expect(res.headers['content-type']).toMatch(
        /application\/vnd\.openxmlformats/
      );
      expect(res.body.length).toBeGreaterThan(100);
      // DOCX is a ZIP file, so it has the PK signature
      expect(res.body[0]).toBe(0x50);
      expect(res.body[1]).toBe(0x4b);
    });
  });
});
