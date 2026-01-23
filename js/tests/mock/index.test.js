import request from 'supertest';
import nock from 'nock';
import { jest } from '@jest/globals';

let app;

beforeAll(async () => {
  app = (await import('../../src/index.js')).app;
});

describe('Web Capture Microservice', () => {
  beforeEach(() => {
    nock.cleanAll();
    jest.clearAllMocks();
  });

  describe('GET /html', () => {
    const testUrl = 'https://example.com';
    const testHtml = '<html><body><h1>Test Page</h1></body></html>';

    it('should return HTML content when URL is provided', async () => {
      nock(testUrl).get('/').reply(200, testHtml);

      const response = await request(app).get('/html').query({ url: testUrl });

      expect(response.status).toBe(200);
      expect(response.type).toBe('text/html');
      expect(response.text).toBe(testHtml);
    });

    it('should return 400 when URL is missing', async () => {
      const response = await request(app).get('/html');

      expect(response.status).toBe(400);
      expect(response.text).toBe('Missing `url` parameter');
    });

    it('should return 500 when fetch fails', async () => {
      nock(testUrl).get('/').replyWithError('Network error');

      const response = await request(app).get('/html').query({ url: testUrl });

      expect(response.status).toBe(500);
      expect(response.text).toBe('Error fetching HTML');
    });
  });

  describe('GET /markdown', () => {
    const testUrl = 'https://example.com';
    const testHtml =
      '<html><body><h1>Test Page</h1><p>Some text</p></body></html>';
    const expectedMarkdown = '# Test Page\n\nSome text';

    it('should convert HTML to Markdown when URL is provided', async () => {
      nock(testUrl).get('/').reply(200, testHtml);

      const response = await request(app)
        .get('/markdown')
        .query({ url: testUrl });

      expect(response.status).toBe(200);
      expect(response.type).toBe('text/markdown');
      expect(response.text).toBe(expectedMarkdown);
    });

    it('should remove CSS from the markdown output', async () => {
      const htmlWithCss = `
        <html>
          <head>
            <style>
              body { background-color: #f0f0f2; }
              div { width: 600px; }
            </style>
          </head>
          <body>
            <h1>Test Page</h1>
            <p>Some text</p>
          </body>
        </html>
      `;

      nock(testUrl).get('/').reply(200, htmlWithCss);

      const response = await request(app)
        .get('/markdown')
        .query({ url: testUrl });

      expect(response.status).toBe(200);
      expect(response.type).toBe('text/markdown');
      expect(response.text).not.toContain('background-color');
      expect(response.text).not.toContain('width: 600px');
      expect(response.text).toContain('Test Page');
      expect(response.text).toContain('Some text');
    });

    it('should return 400 when URL is missing', async () => {
      const response = await request(app).get('/markdown');

      expect(response.status).toBe(400);
      expect(response.text).toBe('Missing `url` parameter');
    });

    it('should return 500 when fetch fails', async () => {
      nock(testUrl).get('/').replyWithError('Network error');

      const response = await request(app)
        .get('/markdown')
        .query({ url: testUrl });

      expect(response.status).toBe(500);
      expect(response.text).toBe('Error converting to Markdown');
    });
  });

  describe('GET /image', () => {
    const testUrl = 'https://example.com';
    // Buffer for PNG image mock
    // eslint-disable-next-line no-unused-vars
    const mockBuffer = Buffer.from([
      0x89,
      0x50,
      0x4e,
      0x47,
      0x0d,
      0x0a,
      0x1a,
      0x0a, // PNG signature
      0x00,
      0x00,
      0x00,
      0x0d,
      0x49,
      0x48,
      0x44,
      0x52, // IHDR chunk
      // ... (rest can be arbitrary for test)
      0x00,
      0x00,
      0x00,
      0x00,
      0x49,
      0x45,
      0x4e,
      0x44,
      0xae,
      0x42,
      0x60,
      0x82, // IEND chunk
    ]);

    it('should return PNG image when URL is provided', async () => {
      const response = await request(app).get('/image').query({ url: testUrl });

      expect(response.status).toBe(200);
      expect(response.type).toBe('image/png');
      const pngSignature = Buffer.from([
        0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a,
      ]);
      expect(response.body.slice(0, 8)).toEqual(pngSignature);
      // Skipping strict buffer match: Puppeteer output is not deterministic
      // expect(response.body.equals(mockBuffer)).toBe(true);
    });

    it('should return 400 when URL is missing', async () => {
      const response = await request(app).get('/image');

      expect(response.status).toBe(400);
      expect(response.text).toBe('Missing `url` parameter');
    });
  });

  describe('GET /stream', () => {
    it('should stream content from the given URL', async () => {
      const testUrl = 'https://example.com';
      const response = await request(app).get(`/stream?url=${testUrl}`);
      expect(response.status).toBe(200);
      expect(response.text).toMatch(/<html/i);
    });

    it('should return 400 when URL is missing', async () => {
      const response = await request(app).get('/stream');
      expect(response.status).toBe(400);
      expect(response.text).toBe('Missing `url` parameter');
    });

    it('should return 500 when fetch fails', async () => {
      const testUrl = 'https://nonexistent.example.com';
      const response = await request(app).get(`/stream?url=${testUrl}`);
      expect(response.status).toBe(500);
      expect(response.text).toBe('Error proxying content');
    });
  });

  describe('GET /fetch', () => {
    const testUrl = 'https://example.com';
    const testHtml = '<html><body><h1>Test Page</h1></body></html>';

    it('should return content when URL is provided', async () => {
      nock(testUrl).get('/').reply(200, testHtml);

      const response = await request(app).get('/fetch').query({ url: testUrl });

      expect(response.status).toBe(200);
      expect(response.text).toBe(testHtml);
    });

    it('should return 400 when URL is missing', async () => {
      const response = await request(app).get('/fetch');

      expect(response.status).toBe(400);
      expect(response.text).toBe('Missing `url` parameter');
    });

    it('should return 500 when fetch fails', async () => {
      nock(testUrl).get('/').replyWithError('Network error');

      const response = await request(app).get('/fetch').query({ url: testUrl });

      expect(response.status).toBe(500);
      expect(response.text).toBe('Error fetching content');
    });
  });
});
