/**
 * Smoke tests for the FormalAI-facing HTTP contract (issue #135).
 *
 * These tests intentionally assert the stable response shapes documented in
 * docs/formalai-contract.md rather than endpoint internals.
 */

import request from 'supertest';
import nock from 'nock';
import unzipper from 'unzipper';
import { app, SEARCH_PROVIDERS } from '../../src/index.js';

const HTML = `<!doctype html>
<html>
  <head><title>FormalAI fixture</title></head>
  <body><h1>FormalAI Fixture</h1><p>Stable HTTP shape.</p></body>
</html>`;

const PNG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

const WIKI_JSON = {
  pages: [
    {
      id: 1,
      key: 'Formal_methods',
      title: 'Formal methods',
      excerpt: 'the study of <b>formal</b> methods',
      description: 'rigorous techniques',
    },
  ],
};

function parseBinary(res, callback) {
  const chunks = [];
  res.on('data', (chunk) => chunks.push(chunk));
  res.on('end', () => callback(null, Buffer.concat(chunks)));
}

afterEach(() => {
  nock.cleanAll();
});

describe('FormalAI HTTP contract (#135)', () => {
  it('returns stable text artifact shapes for /html, /txt, and /markdown', async () => {
    nock('https://formalai.example').get('/page').reply(200, HTML, {
      'content-type': 'text/html; charset=utf-8',
    });
    const html = await request(app)
      .get('/html')
      .query({ url: 'https://formalai.example/page' })
      .expect(200)
      .expect('Content-Type', /text\/html/);
    expect(html.text).toContain('<h1>FormalAI Fixture</h1>');

    nock('https://formalai.example')
      .get('/text')
      .reply(200, 'FormalAI plain text', {
        'content-type': 'text/plain; charset=utf-8',
      });
    const text = await request(app)
      .get('/txt')
      .query({ url: 'https://formalai.example/text' })
      .expect(200)
      .expect('Content-Type', /text\/plain/);
    expect(text.headers['content-disposition']).toContain('.txt');
    expect(text.text).toBe('FormalAI plain text');

    nock('https://formalai.example').get('/markdown').reply(200, HTML, {
      'content-type': 'text/html; charset=utf-8',
    });
    const markdown = await request(app)
      .get('/markdown')
      .query({ url: 'https://formalai.example/markdown' })
      .expect(200)
      .expect('Content-Type', /text\/markdown/);
    expect(markdown.text).toContain('FormalAI Fixture');
    expect(markdown.text).toContain('Stable HTTP shape.');
  });

  it('preserves upstream status and content for /fetch and /stream', async () => {
    nock('https://formalai.example')
      .get('/fetch-source')
      .reply(203, 'fetch body', {
        'content-type': 'text/plain; charset=utf-8',
      });
    const fetched = await request(app)
      .get('/fetch')
      .query({ url: 'https://formalai.example/fetch-source' })
      .expect(203)
      .expect('Content-Type', /text\/plain/);
    expect(fetched.text).toBe('fetch body');

    nock('https://formalai.example')
      .get('/stream-source')
      .reply(206, 'stream body', {
        'content-type': 'text/plain; charset=utf-8',
      });
    const streamed = await request(app)
      .get('/stream')
      .query({ url: 'https://formalai.example/stream-source' })
      .expect(206)
      .expect('Content-Type', /text\/plain/);
    expect(streamed.text).toBe('stream body');
  });

  it('returns stable binary artifact shapes for /image and /archive', async () => {
    nock('https://drive.google.com')
      .get('/uc')
      .query({ export: 'download', id: 'formalaiimage' })
      .reply(200, PNG, { 'content-type': 'image/png' });
    const image = await request(app)
      .get('/image')
      .query({
        url: 'https://drive.google.com/file/d/formalaiimage/view',
      })
      .buffer(true)
      .parse(parseBinary)
      .expect(200)
      .expect('Content-Type', /image\/png/);
    expect(image.headers['content-disposition']).toContain(
      'google-drive-formalaiimage.png'
    );
    expect(image.body.subarray(0, 8)).toEqual(PNG);

    nock('https://formalai.example').get('/archive').reply(200, HTML, {
      'content-type': 'text/html; charset=utf-8',
    });
    const archive = await request(app)
      .get('/archive')
      .query({
        url: 'https://formalai.example/archive',
        localImages: 'false',
      })
      .buffer(true)
      .parse(parseBinary)
      .expect(200)
      .expect('Content-Type', /application\/zip/);
    expect(archive.body[0]).toBe(0x50);
    expect(archive.body[1]).toBe(0x4b);
    const zip = await unzipper.Open.buffer(archive.body);
    expect(zip.files.map((file) => file.path)).toEqual(
      expect.arrayContaining(['document.md', 'document.html'])
    );
  });

  it('returns normalized /search JSON diagnostics and the documented provider catalog', async () => {
    expect(SEARCH_PROVIDERS).toEqual([
      'wikipedia',
      'duckduckgo',
      'google',
      'bing',
      'brave',
    ]);

    nock('https://en.wikipedia.org')
      .get('/w/rest.php/v1/search/page')
      .query(true)
      .reply(200, WIKI_JSON);

    const res = await request(app)
      .get('/search')
      .query({ q: 'formal-ai', provider: 'wikipedia', limit: 1 })
      .expect(200)
      .expect('Content-Type', /application\/json/);

    expect(res.body).toMatchObject({
      query: 'formal-ai',
      provider: 'wikipedia',
      captureMode: 'fetch',
      results: [
        {
          rank: 1,
          title: 'Formal methods',
          url: 'https://en.wikipedia.org/wiki/Formal_methods',
          snippet: 'the study of formal methods',
        },
      ],
      diagnostics: {
        status: 200,
        blockedByCors: false,
        blockedByCaptcha: false,
      },
    });
    expect(res.body.capturedAt).toEqual(expect.any(String));
    expect(res.body.diagnostics.sourceUrl).toContain('en.wikipedia.org');
  });

  it('keeps normalized /search diagnostics when provider capture fails', async () => {
    nock('https://en.wikipedia.org')
      .get('/w/rest.php/v1/search/page')
      .query(true)
      .replyWithError(new Error('provider offline'));

    const res = await request(app)
      .get('/search')
      .query({ q: 'formal-ai', provider: 'wikipedia', limit: 1 })
      .expect(200)
      .expect('Content-Type', /application\/json/);

    expect(res.body).toMatchObject({
      query: 'formal-ai',
      provider: 'wikipedia',
      captureMode: 'fetch',
      results: [],
      diagnostics: {
        status: 0,
        blockedByCors: false,
        blockedByCaptcha: false,
      },
    });
    expect(res.body.diagnostics.sourceUrl).toContain('en.wikipedia.org');
    expect(res.body.diagnostics.error).toContain('provider offline');
  });
});
