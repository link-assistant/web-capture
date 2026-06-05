/**
 * Integration tests for downloading the StackOverflow page from issue #11.
 *
 * These tests hit the live StackOverflow page:
 * https://stackoverflow.com/questions/927358/how-do-i-undo-the-most-recent-local-commits-in-git
 *
 * Set STACKOVERFLOW_INTEGRATION=true to run them. The suite is skipped by
 * default so offline/local test runs stay deterministic.
 */

import { jest } from '@jest/globals';
import request from 'supertest';
import unzipper from 'unzipper';
import { app } from '../../src/index.js';
import { retry } from '../../src/retry.js';

const STACKOVERFLOW_URL =
  'https://stackoverflow.com/questions/927358/how-do-i-undo-the-most-recent-local-commits-in-git';
const STACKOVERFLOW_TITLE =
  'How do I undo the most recent local commits in Git';

const PNG_SIGNATURE = Buffer.from([
  0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a,
]);
const ZIP_SIGNATURE = Buffer.from([0x50, 0x4b]);
const PDF_SIGNATURE = Buffer.from([0x25, 0x50, 0x44, 0x46]);

const SKIP_LIVE =
  !process.env.STACKOVERFLOW_INTEGRATION ||
  process.env.STACKOVERFLOW_INTEGRATION === 'false';
const describeIfLive = SKIP_LIVE ? describe.skip : describe;

jest.setTimeout(180000);

function parseBinary(res, callback) {
  const chunks = [];
  res.on('data', (chunk) => chunks.push(Buffer.from(chunk)));
  res.on('end', () => callback(null, Buffer.concat(chunks)));
}

async function getText(path, query = {}) {
  return await retry(
    () =>
      request(app)
        .get(path)
        .query({ url: STACKOVERFLOW_URL, ...query })
        .expect(200),
    {
      retries: 2,
      baseDelay: 2000,
      onRetry: (err, attempt, delay) => {
        console.log(
          `Retry ${attempt} for ${path} after ${delay}ms: ${err.message}`
        );
      },
    }
  );
}

async function getBinary(path, query = {}) {
  return await retry(
    () =>
      request(app)
        .get(path)
        .query({ url: STACKOVERFLOW_URL, ...query })
        .buffer(true)
        .parse(parseBinary)
        .expect(200),
    {
      retries: 2,
      baseDelay: 2000,
      onRetry: (err, attempt, delay) => {
        console.log(
          `Retry ${attempt} for ${path} after ${delay}ms: ${err.message}`
        );
      },
    }
  );
}

function expectStackOverflowContent(text) {
  expect(text).toContain(STACKOVERFLOW_TITLE);
  expect(text).toMatch(/Stack Overflow/i);
  expect(text).toMatch(/\bgit\b/i);
}

function expectBufferWithSignature(buffer, signature) {
  expect(Buffer.isBuffer(buffer)).toBe(true);
  expect(buffer.length).toBeGreaterThan(1000);
  expect(buffer.subarray(0, signature.length)).toEqual(signature);
}

describeIfLive('StackOverflow page downloads (JavaScript)', () => {
  it('downloads the page as Markdown and plain text', async () => {
    const markdown = await getText('/markdown');
    expect(markdown.headers['content-type']).toMatch(/text\/markdown/);
    expectStackOverflowContent(markdown.text);
    expect(markdown.text).not.toMatch(/<html/i);

    const text = await getText('/txt');
    expect(text.headers['content-type']).toMatch(/text\/plain/);
    expect(text.headers['content-disposition']).toContain('stackoverflow-com');
    expectStackOverflowContent(text.text);
  });

  it('downloads Markdown and HTML archives with the expected files', async () => {
    const markdownArchive = await getBinary('/archive', {
      documentFormat: 'markdown',
      localImages: 'false',
    });
    expect(markdownArchive.headers['content-type']).toMatch(/application\/zip/);
    expectBufferWithSignature(markdownArchive.body, ZIP_SIGNATURE);

    const markdownZip = await unzipper.Open.buffer(markdownArchive.body);
    const markdownEntries = new Map(
      markdownZip.files.map((file) => [file.path, file])
    );
    expect(markdownEntries.has('document.md')).toBe(true);
    expect(markdownEntries.has('document.html')).toBe(true);
    expectStackOverflowContent(
      (await markdownEntries.get('document.md').buffer()).toString('utf8')
    );

    const htmlArchive = await getBinary('/archive', {
      documentFormat: 'html',
      localImages: 'false',
    });
    expect(htmlArchive.headers['content-type']).toMatch(/application\/zip/);
    expectBufferWithSignature(htmlArchive.body, ZIP_SIGNATURE);

    const htmlZip = await unzipper.Open.buffer(htmlArchive.body);
    const htmlEntries = new Map(htmlZip.files.map((file) => [file.path, file]));
    expect(htmlEntries.has('document.html')).toBe(true);
    expectStackOverflowContent(
      (await htmlEntries.get('document.html').buffer()).toString('utf8')
    );
  });

  it('downloads the page as DOCX and PDF', async () => {
    const docx = await getBinary('/docx');
    expect(docx.headers['content-type']).toMatch(
      /application\/vnd\.openxmlformats-officedocument\.wordprocessingml\.document/
    );
    expectBufferWithSignature(docx.body, ZIP_SIGNATURE);

    const pdf = await getBinary('/pdf');
    expect(pdf.headers['content-type']).toMatch(/application\/pdf/);
    expectBufferWithSignature(pdf.body, PDF_SIGNATURE);
  }, 180000);
});

describe.each(['puppeteer', 'playwright'])(
  'StackOverflow browser downloads (%s engine)',
  (engine) => {
    describeIfLive(`${engine}`, () => {
      it('downloads rendered HTML for the page', async () => {
        const html = await getText('/html', { engine });
        expect(html.headers['content-type']).toMatch(/text\/html/);
        expectStackOverflowContent(html.text);
        expect(html.text).toMatch(/<html/i);
      }, 120000);

      it('downloads a PNG screenshot for the page', async () => {
        const image = await getBinary('/image', {
          engine,
          dismissPopups: 'true',
        });
        expect(image.headers['content-type']).toMatch(/image\/png/);
        expectBufferWithSignature(image.body, PNG_SIGNATURE);
      }, 120000);
    });
  }
);
