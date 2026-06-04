/**
 * Integration tests to verify that markdown extraction from xpaste.pro
 * includes ALL text visible in screenshots of the same page
 *
 * This ensures 100% coverage of visual content extraction as required in issue #15
 */

import request from 'supertest';
import nock from 'nock';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

let app;

beforeAll(async () => {
  app = (await import('../../src/index.js')).app;
});

describe('xpaste.pro screenshot-to-markdown content matching', () => {
  beforeEach(() => {
    nock.cleanAll();
  });

  describe('GET /markdown for t4q0Lsp0', () => {
    const testUrl = 'https://xpaste.pro/p/t4q0Lsp0';

    // Load the actual HTML page content that was saved
    const htmlPath = path.join(
      __dirname,
      '../../../tests/xpaste/data/t4q0Lsp0-page.html'
    );
    const rawTextPath = path.join(
      __dirname,
      '../../../tests/xpaste/data/t4q0Lsp0-actual-content.txt'
    );
    let testHtml;
    let rawText;

    beforeAll(() => {
      if (fs.existsSync(htmlPath)) {
        testHtml = fs.readFileSync(htmlPath, 'utf-8');
      }
      if (fs.existsSync(rawTextPath)) {
        rawText = fs.readFileSync(rawTextPath, 'utf-8');
      }
    });

    beforeEach(() => {
      if (rawText) {
        nock('https://xpaste.pro')
          .persist()
          .get('/p/t4q0Lsp0/raw')
          .reply(200, rawText, {
            'content-type': 'text/plain; charset=utf-8',
          });
      }
    });

    it('should include all header/metadata text visible in screenshot', async () => {
      if (!testHtml) {
        console.warn('Skipping test - HTML file not found');
        return;
      }

      nock('https://xpaste.pro')
        .get('/p/t4q0Lsp0')
        .reply(200, testHtml, { 'content-type': 'text/html; charset=utf-8' });

      const response = await request(app)
        .get('/markdown')
        .query({ url: testUrl });

      expect(response.status).toBe(200);
      expect(response.type).toBe('text/markdown');

      // Verify page title/branding (top of screenshot)
      expect(response.text).toContain('Xpaste');
      expect(response.text).toContain('xPaste');

      // Verify metadata section (visible in screenshot)
      expect(response.text).toContain('Формат');
      expect(response.text).toContain('text');
      expect(response.text).toContain('Время создания');
      expect(response.text).toContain('07.07.2021');
      expect(response.text).toContain('12:48 UTC');
      expect(response.text).toContain('Будет удалена');
      expect(response.text).toContain('05.07.2031');
    });

    it('should include all SQL query content visible in screenshot', async () => {
      if (!testHtml) {
        console.warn('Skipping test - HTML file not found');
        return;
      }

      nock('https://xpaste.pro')
        .get('/p/t4q0Lsp0')
        .reply(200, testHtml, { 'content-type': 'text/html; charset=utf-8' });

      const response = await request(app)
        .get('/markdown')
        .query({ url: testUrl });

      expect(response.status).toBe(200);

      // Verify all 4 SQL queries visible in screenshot are present

      // Query #1 metadata (lines 1-8 in screenshot)
      expect(response.text).toContain('# 1');
      expect(response.text).toContain('Time: 210707 15:39:36');
      expect(response.text).toMatch(
        /User@Host:\s+1703313381\[1703313381\]\s+@\s+\[136\.243\.53\.188\]/
      );
      expect(response.text).toContain('Id: 1138102510');
      expect(response.text).toContain('Schema: xxxxxx');
      expect(response.text).toContain('Query_time: 2.182754');
      expect(response.text).toContain('Rows_examined: 324036');

      // Query #2 metadata (lines 19-28 in screenshot)
      expect(response.text).toContain('# 2');
      expect(response.text).toContain('Time: 210707 15:38:11');
      expect(response.text).toContain('Id: 1138100591');
      expect(response.text).toContain('Query_time: 9.259469');
      expect(response.text).toContain('DELETE FROM phpbb_post_revisions');
      expect(response.text).toContain('WHERE post_id = 10472158');

      // Query #3 metadata (lines 30-46 in screenshot)
      expect(response.text).toContain('# 3');
      expect(response.text).toContain('Time: 210707 15:32:18');
      expect(response.text).toContain('Id: 1138094492');
      expect(response.text).toContain('Query_time: 1.113014');
      expect(response.text).toContain('Rows_examined: 521597');

      // Query #4 metadata (lines 48-64 in screenshot)
      expect(response.text).toContain('# 4');
      expect(response.text).toContain('Time: 210707 15:27:56');
      expect(response.text).toContain('Id: 1138089558');
      expect(response.text).toContain('Query_time: 4.682828');
      expect(response.text).toContain('Rows_examined: 2457916');

      // Verify SQL statements contain key elements
      expect(response.text).toContain('SELECT f.*, t.*, p.*, u.*');
      expect(response.text).toContain('phpbb_posts');
      expect(response.text).toContain('phpbb_users');
      expect(response.text).toContain('phpbb_topics');
      expect(response.text).toContain('phpbb_forums');
    });

    it('should include all footer text visible in screenshot', async () => {
      if (!testHtml) {
        console.warn('Skipping test - HTML file not found');
        return;
      }

      nock('https://xpaste.pro')
        .get('/p/t4q0Lsp0')
        .reply(200, testHtml, { 'content-type': 'text/html; charset=utf-8' });

      const response = await request(app)
        .get('/markdown')
        .query({ url: testUrl });

      expect(response.status).toBe(200);

      // Verify footer elements (bottom of screenshot)
      expect(response.text).toContain('xPaste');
      expect(response.text).toContain('Упакуем пароль или код в');
      expect(response.text).toMatch(/cсылку для передачи/); // Note: 'c' can be different Unicode char
      expect(response.text).toContain('Сделано в');
      expect(response.text).toContain('Southbridge');
      expect(response.text).toContain('Справка');
      expect(response.text).toContain('Политика конфиденциальности');
    });

    it('should include language selector links visible in screenshot', async () => {
      if (!testHtml) {
        console.warn('Skipping test - HTML file not found');
        return;
      }

      nock('https://xpaste.pro')
        .get('/p/t4q0Lsp0')
        .reply(200, testHtml, { 'content-type': 'text/html; charset=utf-8' });

      const response = await request(app)
        .get('/markdown')
        .query({ url: testUrl });

      expect(response.status).toBe(200);

      // Verify language links (top right of screenshot)
      expect(response.text).toContain('Ru');
      expect(response.text).toContain('En');
    });

    it('should include RAW link visible in screenshot', async () => {
      if (!testHtml) {
        console.warn('Skipping test - HTML file not found');
        return;
      }

      nock('https://xpaste.pro')
        .get('/p/t4q0Lsp0')
        .reply(200, testHtml, { 'content-type': 'text/html; charset=utf-8' });

      const response = await request(app)
        .get('/markdown')
        .query({ url: testUrl });

      expect(response.status).toBe(200);

      // Verify RAW button (visible in screenshot)
      expect(response.text).toContain('RAW');
    });

    it('should embed the raw text file as a markdown text block', async () => {
      if (!testHtml || !rawText) {
        console.warn('Skipping test - fixture files not found');
        return;
      }

      nock('https://xpaste.pro')
        .get('/p/t4q0Lsp0')
        .reply(200, testHtml, { 'content-type': 'text/html; charset=utf-8' });

      const response = await request(app)
        .get('/markdown')
        .query({ url: testUrl });

      expect(response.status).toBe(200);
      expect(response.type).toBe('text/markdown');
      expect(response.text).toContain('## xpaste-pro-t4q0Lsp0.txt');
      expect(response.text).toContain('```text');
      expect(response.text).toContain(
        rawText.split('\n')[0].replace(/\r/g, '')
      );
      expect(response.text).toContain('DELETE FROM phpbb_post_revisions');
    });

    it('should verify correct element ordering - heading and languages at top', async () => {
      if (!testHtml) {
        console.warn('Skipping test - HTML file not found');
        return;
      }

      nock('https://xpaste.pro')
        .get('/p/t4q0Lsp0')
        .reply(200, testHtml, { 'content-type': 'text/html; charset=utf-8' });

      const response = await request(app)
        .get('/markdown')
        .query({ url: testUrl });

      expect(response.status).toBe(200);

      const lines = response.text.split('\n');

      // Find line numbers of key elements
      const headingLine = lines.findIndex((l) => l.includes('Упакуем пароль'));
      const languageLine = lines.findIndex(
        (l) => l.includes('[Ru]') || l.includes('[En]')
      );
      const formatLine = lines.findIndex((l) => l.includes('Формат:'));
      const firstQueryLine = lines.findIndex(
        (l) => l.includes('# 1') && l.includes('#')
      );

      // Verify heading comes before metadata (as shown in screenshot)
      expect(headingLine).toBeGreaterThan(0);
      expect(headingLine).toBeLessThan(formatLine);

      // Verify languages come before metadata (as shown in screenshot)
      expect(languageLine).toBeGreaterThan(0);
      expect(languageLine).toBeLessThan(formatLine);

      // Verify heading comes before main content
      expect(headingLine).toBeLessThan(firstQueryLine);

      // Verify metadata comes before main content
      expect(formatLine).toBeLessThan(firstQueryLine);

      console.log(
        `✓ Element ordering verified: heading (line ${headingLine + 1}) -> languages (line ${languageLine + 1}) -> metadata (line ${formatLine + 1}) -> content (line ${firstQueryLine + 1})`
      );
    });

    it('should verify markdown extraction matches screenshot - comprehensive check', async () => {
      if (!testHtml) {
        console.warn('Skipping test - HTML file not found');
        return;
      }

      nock('https://xpaste.pro')
        .get('/p/t4q0Lsp0')
        .reply(200, testHtml, { 'content-type': 'text/html; charset=utf-8' });

      const response = await request(app)
        .get('/markdown')
        .query({ url: testUrl });

      expect(response.status).toBe(200);

      // Define all key text elements visible in the screenshot
      const requiredElements = [
        // Header/branding
        'Xpaste',

        // Metadata section
        'Формат:',
        'text',
        'Время создания:',
        '07.07.2021, 12:48 UTC',
        'Будет удалена:',
        '05.07.2031, 12:48 UTC',

        // Query #1
        '# 1',
        'Time: 210707 15:39:36',
        'User@Host: 1703313381[1703313381]',
        '[136.243.53.188]',
        'Id: 1138102510',
        'Query_time: 2.182754',

        // Query #2
        '# 2',
        'Time: 210707 15:38:11',
        'Id: 1138100591',
        'DELETE FROM phpbb_post_revisions',

        // Query #3
        '# 3',
        'Time: 210707 15:32:18',
        'Id: 1138094492',

        // Query #4
        '# 4',
        'Time: 210707 15:27:56',
        'Id: 1138089558',

        // Footer
        'Упакуем пароль',
        'Southbridge',
        'Справка',
        'Политика конфиденциальности',

        // Language links
        'Ru',
        'En',

        // RAW button
        'RAW',
      ];

      // Verify ALL elements are present
      const missingElements = [];
      requiredElements.forEach((element) => {
        if (!response.text.includes(element)) {
          missingElements.push(element);
        }
      });

      expect(missingElements).toEqual([]);

      // Log success with coverage stats
      if (missingElements.length === 0) {
        console.log(
          `✓ All ${requiredElements.length} screenshot text elements found in markdown`
        );
      }
    });
  });
});
