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
import unzipper from 'unzipper';
import { app } from '../../src/index.js';
import { isKreuzbergAvailable } from '../../src/kreuzberg.js';

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

function mockGithubRepository(owner = 'octocat', repo = 'Hello-World') {
  const readme = '# Hello World\n\nThis README came from GitHub.';
  nock('https://api.github.com')
    .get(`/repos/${owner}/${repo}`)
    .reply(200, {
      full_name: `${owner}/${repo}`,
      description: 'A friendly test repository',
      html_url: `https://github.com/${owner}/${repo}`,
      default_branch: 'master',
      language: 'JavaScript',
      stargazers_count: 42,
      forks_count: 7,
      open_issues_count: 3,
      license: { spdx_id: 'MIT' },
      topics: ['demo', 'capture'],
    })
    .get(`/repos/${owner}/${repo}/readme`)
    .query({ ref: 'master' })
    .reply(200, {
      name: 'README.md',
      path: 'README.md',
      encoding: 'base64',
      content: Buffer.from(readme, 'utf8').toString('base64'),
      html_url: `https://github.com/${owner}/${repo}/blob/master/README.md`,
    })
    .get(`/repos/${owner}/${repo}/contents`)
    .query({ ref: 'master' })
    .reply(200, [
      {
        name: 'src',
        path: 'src',
        type: 'dir',
        html_url: `https://github.com/${owner}/${repo}/tree/master/src`,
      },
      {
        name: 'README.md',
        path: 'README.md',
        type: 'file',
        size: readme.length,
        html_url: `https://github.com/${owner}/${repo}/blob/master/README.md`,
      },
    ]);
}

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

    it('returns a compact GitHub repository markdown snapshot', async () => {
      mockGithubRepository();

      const res = await request(app)
        .get('/markdown')
        .query({ url: 'https://github.com/octocat/Hello-World' })
        .expect(200);

      expect(res.headers['content-type']).toMatch(/text\/markdown/);
      expect(res.text).toContain('# octocat/Hello-World');
      expect(res.text).toContain('## Repository');
      expect(res.text).toContain('## Files');
      expect(res.text).toContain('- [src/](');
      expect(res.text).toContain('## README.md');
      expect(res.text).toContain('This README came from GitHub.');
      expect(res.text).not.toContain('Skip to content');
      expect(nock.isDone()).toBe(true);
    });

    it('returns a compact GitHub repository markdown snapshot for kreuzberg text format', async () => {
      mockGithubRepository();

      const res = await request(app)
        .get('/markdown')
        .query({
          url: 'https://github.com/octocat/Hello-World',
          converter: 'kreuzberg',
          format: 'text',
        })
        .expect(200);

      expect(res.headers['content-type']).toMatch(/text\/markdown/);
      expect(res.text).toContain('# octocat/Hello-World');
      expect(res.text).toContain('## Files');
      expect(res.text).toContain('This README came from GitHub.');
      expect(nock.isDone()).toBe(true);
    });

    it('rejects unsupported converter names', async () => {
      await request(app)
        .get('/markdown')
        .query({
          url: 'https://example.com/md-test',
          converter: 'unknown',
        })
        .expect(400);
    });

    it('rejects JSON format without the kreuzberg converter', async () => {
      await request(app)
        .get('/markdown')
        .query({
          url: 'https://example.com/md-test',
          format: 'json',
        })
        .expect(400);
    });

    it('returns structured kreuzberg JSON with selectors and absolute links', async () => {
      if (!(await isKreuzbergAvailable())) {
        return;
      }

      nock('https://example.com')
        .get('/kreuzberg-json')
        .reply(
          200,
          `<!DOCTYPE html><html><body>
            <main>
              <h1>Article Title</h1>
              <nav>Navigation</nav>
              <article><p>Wanted body with <a href="/about">relative link</a>.</p></article>
            </main>
          </body></html>`,
          { 'content-type': 'text/html' }
        );

      const res = await request(app)
        .get('/markdown')
        .query({
          url: 'https://example.com/kreuzberg-json',
          converter: 'kreuzberg',
          format: 'json',
          contentSelector: 'main',
          bodySelector: 'article',
        })
        .expect(200);

      expect(res.headers['content-type']).toMatch(/application\/json/);
      expect(res.body).toHaveProperty('content');
      expect(res.body).toHaveProperty('metadata');
      expect(res.body).toHaveProperty('tables');
      expect(res.body).toHaveProperty('images');
      expect(res.body).toHaveProperty('warnings');
      expect(res.body.content).toContain('Article Title');
      expect(res.body.content).toContain('Wanted body');
      expect(res.body.content).toContain('https://example.com/about');
      expect(res.body.content).not.toContain('Navigation');
    });
  });

  describe('GET /txt', () => {
    it('returns a compact GitHub repository plain-text snapshot', async () => {
      mockGithubRepository();

      const res = await request(app)
        .get('/txt')
        .query({ url: 'https://github.com/octocat/Hello-World' })
        .expect(200);

      expect(res.headers['content-type']).toMatch(/text\/plain/);
      expect(res.headers['content-disposition']).toContain(
        'filename="octocat-Hello-World.txt"'
      );
      expect(res.text).toContain('Repository: octocat/Hello-World');
      expect(res.text).toContain('Files:');
      expect(res.text).toContain('- src/');
      expect(res.text).toContain('README.md:');
      expect(res.text).toContain('This README came from GitHub.');
      expect(nock.isDone()).toBe(true);
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

      // Default archive layout contract (issue #113): the markdown archive must
      // bundle document.md AND document.html for reference.
      const dir = await unzipper.Open.buffer(res.body);
      const names = dir.files.map((f) => f.path);
      expect(names).toEqual(
        expect.arrayContaining(['document.md', 'document.html'])
      );
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
