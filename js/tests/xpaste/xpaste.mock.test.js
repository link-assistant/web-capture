import request from 'supertest';
import nock from 'nock';
import { jest } from '@jest/globals';
import unzipper from 'unzipper';

let app;

beforeAll(async () => {
  app = (await import('../../src/index.js')).app;
});

describe('xpaste.pro integration tests', () => {
  beforeEach(() => {
    nock.cleanAll();
    jest.clearAllMocks();
  });

  describe('GET /txt with xpaste.pro URL', () => {
    const testUrl = 'https://xpaste.pro/p/t4q0Lsp0';
    // Using actual data from https://xpaste.pro/p/t4q0Lsp0 (captured on 2025-11-14)
    const testText = `# 1
#
# Time: 210707 15:39:36
# User@Host: 1703313381[1703313381] @  [136.243.53.188]  Id: 1138102510
# Schema: xxxxxx  Last_errno: 0  Killed: 0
# Query_time: 2.182754  Lock_time: 0.000120  Rows_sent: 0  Rows_examined: 324036  Rows_affected: 0
# Bytes_sent: 20494
SET timestamp=1625661576;
SELECT f.*, t.*, p.*, u.*, tt.mark_time AS topic_mark_time, ft.mark_time AS forum_mark_time FROM (phpbb_posts p CROSS JOIN phpbb_users u CROSS JOIN phpbb_topics t) LEFT JOIN phpbb_forums f ON (t.forum_id = f.forum_id) LEFT JOIN phpbb_topics_track tt ON (t.topic_id = tt.topic_id AND tt.user_id = 659822) LEFT JOIN phpbb_forums_track ft ON (f.forum_id = ft.forum_id AND ft.user_id = 659822) WHERE p.topic_id = t.topic_id
				AND p.poster_id = u.user_id
				 AND p.post_time > 1625660099
				 AND p.forum_id = 326



				AND p.post_approved = 1 ORDER BY t.topic_last_post_time DESC, p.post_time
 LIMIT 100;`;

    it('should fetch and return text content from xpaste.pro', async () => {
      nock('https://xpaste.pro')
        .get('/p/t4q0Lsp0/raw')
        .reply(200, testText, { 'content-type': 'text/plain; charset=utf-8' });

      const response = await request(app).get('/txt').query({ url: testUrl });

      expect(response.status).toBe(200);
      expect(response.type).toBe('text/plain');
      expect(response.text).toBe(testText);
      expect(response.headers['content-disposition']).toContain('attachment');
      expect(response.headers['content-disposition']).toContain('.txt');
    });

    it('should return 400 when URL is missing', async () => {
      const response = await request(app).get('/txt');

      expect(response.status).toBe(400);
      expect(response.text).toBe('Missing `url` parameter');
    });

    it('should return 500 when fetch fails', async () => {
      nock('https://xpaste.pro')
        .get('/p/t4q0Lsp0/raw')
        .replyWithError('Network error');

      const response = await request(app).get('/txt').query({ url: testUrl });

      expect(response.status).toBe(500);
      expect(response.text).toBe('Error fetching text content');
    });
  });

  describe('GET /markdown with xpaste.pro URL (small content)', () => {
    const testUrl = 'https://xpaste.pro/p/t4q0Lsp0';
    const rawText = `# 1
#
# Time: 210707 15:39:36
SET timestamp=1625661576;
SELECT * FROM phpbb_posts WHERE topic_id = 123;`;
    // Mock HTML that resembles actual xpaste.pro page structure
    const testHtml = `<!DOCTYPE html>
<html>
<head><title>xPaste</title></head>
<body>
  <h1>Xpaste</h1>
  <div>
    <strong>Формат:</strong> text<br>
    <strong>Время создания:</strong> 07.07.2021, 12:48 UTC<br>
    <strong>Будет удалена:</strong> 05.07.2031, 12:48 UTC
  </div>
  <pre># 1
#
# Time: 210707 15:39:36
# User@Host: 1703313381[1703313381] @  [136.243.53.188]  Id: 1138102510
# Schema: xxxxxx  Last_errno: 0  Killed: 0
# Query_time: 2.182754  Lock_time: 0.000120  Rows_sent: 0  Rows_examined: 324036  Rows_affected: 0
SET timestamp=1625661576;
SELECT * FROM phpbb_posts WHERE topic_id = 123;</pre>
  <footer>
    <a href="https://xpaste.pro/">xPaste</a>
    <p>Упакуем пароль или код в cсылку для передачи</p>
    <p>Сделано в <a href="https://southbridge.io/">Southbridge</a></p>
  </footer>
</body>
</html>`;

    it('should convert HTML to markdown with all page elements when content is less than 1500 lines', async () => {
      nock('https://xpaste.pro')
        .get('/p/t4q0Lsp0')
        .reply(200, testHtml, { 'content-type': 'text/html; charset=utf-8' });
      nock('https://xpaste.pro')
        .get('/p/t4q0Lsp0/raw')
        .reply(200, rawText, { 'content-type': 'text/plain; charset=utf-8' });

      const response = await request(app)
        .get('/markdown')
        .query({ url: testUrl });

      expect(response.status).toBe(200);
      expect(response.type).toBe('text/markdown');

      // Verify it includes page metadata (visible in screenshot)
      expect(response.text).toContain('Xpaste');
      expect(response.text).toContain('Формат:');
      expect(response.text).toContain('text');
      expect(response.text).toContain('07.07.2021');

      // Verify it includes the SQL query content
      expect(response.text).toContain('1703313381');
      // Note: markdown escapes special characters like * and _
      expect(response.text).toMatch(/SELECT.*FROM phpbb.*posts/);

      // Verify it includes footer elements (visible in screenshot)
      expect(response.text).toContain('Southbridge');
      expect(response.text).toContain('Упакуем пароль или код');

      // Verify the raw text file is embedded as a named markdown block.
      expect(response.text).toContain('## xpaste-pro-t4q0Lsp0.txt');
      expect(response.text).toContain('```text\n# 1\n#');
    });

    it('should normalize raw xpaste URLs before markdown conversion', async () => {
      nock('https://xpaste.pro')
        .get('/p/t4q0Lsp0')
        .reply(200, testHtml, { 'content-type': 'text/html; charset=utf-8' });
      nock('https://xpaste.pro')
        .get('/p/t4q0Lsp0/raw')
        .reply(200, rawText, { 'content-type': 'text/plain; charset=utf-8' });

      const response = await request(app)
        .get('/markdown')
        .query({ url: `${testUrl}/raw` });

      expect(response.status).toBe(200);
      expect(response.type).toBe('text/markdown');
      expect(response.text).toContain('Формат:');
      expect(response.text).toContain('## xpaste-pro-t4q0Lsp0.txt');
    });
  });

  describe('GET /markdown with xpaste.pro URL (large content)', () => {
    const testUrl = 'https://xpaste.pro/p/largefile';

    it('should create a zip archive when content is 1500 lines or more', async () => {
      // Create HTML content that will result in exactly 1500 lines of markdown
      const largeContent = Array(1480).fill('<p>Line of text</p>').join('\n');
      const largeHtml = `<!DOCTYPE html>
<html><head><title>Large File</title></head><body>${largeContent}</body></html>`;

      nock('https://xpaste.pro')
        .get('/p/largefile')
        .reply(200, largeHtml, { 'content-type': 'text/html; charset=utf-8' });
      nock('https://xpaste.pro')
        .get('/p/largefile/raw')
        .reply(200, largeContent.replace(/<\/?p>/g, ''), {
          'content-type': 'text/plain; charset=utf-8',
        });

      const response = await request(app)
        .get('/markdown')
        .query({ url: testUrl })
        .buffer(true)
        .parse((res, callback) => {
          const chunks = [];
          res.on('data', (chunk) => chunks.push(chunk));
          res.on('end', () => callback(null, Buffer.concat(chunks)));
        });

      expect(response.status).toBe(200);
      expect(response.type).toBe('application/zip');
      expect(response.headers['content-disposition']).toContain('attachment');
      expect(response.headers['content-disposition']).toContain(
        'largefile.zip'
      );

      const dir = await unzipper.Open.buffer(response.body);
      const names = dir.files.map((file) => file.path);
      expect(names).toEqual(
        expect.arrayContaining([
          'index.md',
          'xpaste-pro-largefile.md',
          'xpaste-pro-largefile.txt',
        ])
      );

      const index = await dir.files
        .find((file) => file.path === 'index.md')
        .buffer();
      const rawTextFile = await dir.files
        .find((file) => file.path === 'xpaste-pro-largefile.txt')
        .buffer();
      expect(index.toString()).toContain(
        '[xpaste-pro-largefile.txt](xpaste-pro-largefile.txt)'
      );
      expect(rawTextFile.toString()).toContain('Line of text');
    });

    it('should create a zip archive for content with more than 1500 lines', async () => {
      // Create HTML content that will result in more than 1500 lines of markdown
      const largeContent = Array(1600).fill('<p>Line of text</p>').join('\n');
      const largeHtml = `<!DOCTYPE html>
<html><head><title>Large File</title></head><body>${largeContent}</body></html>`;

      nock('https://xpaste.pro')
        .get('/p/largefile')
        .reply(200, largeHtml, { 'content-type': 'text/html; charset=utf-8' });
      nock('https://xpaste.pro')
        .get('/p/largefile/raw')
        .reply(200, largeContent.replace(/<\/?p>/g, ''), {
          'content-type': 'text/plain; charset=utf-8',
        });

      const response = await request(app)
        .get('/markdown')
        .query({ url: testUrl });

      expect(response.status).toBe(200);
      expect(response.type).toBe('application/zip');
    });
  });

  describe('GET /markdown with non-xpaste.pro URL', () => {
    const testUrl = 'https://example.com';
    const testHtml =
      '<html><body><h1>Test Page</h1><p>Regular HTML content</p></body></html>';

    it('should process regular HTML URLs normally', async () => {
      nock(testUrl).get('/').reply(200, testHtml);

      const response = await request(app)
        .get('/markdown')
        .query({ url: testUrl });

      expect(response.status).toBe(200);
      expect(response.type).toBe('text/markdown');
      expect(response.text).toContain('Test Page');
      expect(response.text).toContain('Regular HTML content');
      // Should not be a zip file
      expect(response.headers['content-type']).not.toBe('application/zip');
    });
  });
});
