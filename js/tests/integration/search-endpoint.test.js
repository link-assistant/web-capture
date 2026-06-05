/**
 * Integration tests for the GET /search endpoint (issue #130).
 *
 * Provider HTTP calls are mocked with nock so the test is fast and offline.
 */

import request from 'supertest';
import nock from 'nock';
import { app } from '../../src/index.js';

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

afterEach(() => {
  nock.cleanAll();
});

describe('GET /search', () => {
  it('returns structured JSON for the wikipedia provider', async () => {
    nock('https://en.wikipedia.org')
      .get('/w/rest.php/v1/search/page')
      .query(true)
      .reply(200, WIKI_JSON);

    const res = await request(app)
      .get('/search')
      .query({ q: 'formal-ai', provider: 'wikipedia', limit: 5 })
      .expect(200)
      .expect('Content-Type', /json/);

    expect(res.body.query).toBe('formal-ai');
    expect(res.body.provider).toBe('wikipedia');
    expect(res.body.results).toHaveLength(1);
    expect(res.body.results[0].url).toBe(
      'https://en.wikipedia.org/wiki/Formal_methods'
    );
    expect(res.body.diagnostics.status).toBe(200);
  });

  it('returns markdown when format=markdown', async () => {
    nock('https://en.wikipedia.org')
      .get('/w/rest.php/v1/search/page')
      .query(true)
      .reply(200, WIKI_JSON);

    const res = await request(app)
      .get('/search')
      .query({ q: 'formal-ai', provider: 'wikipedia', format: 'markdown' })
      .expect(200)
      .expect('Content-Type', /markdown/);

    expect(res.text).toContain('# Search results for "formal-ai"');
    expect(res.text).toContain('[Formal methods]');
  });

  it('defaults to the wikipedia provider', async () => {
    nock('https://en.wikipedia.org')
      .get('/w/rest.php/v1/search/page')
      .query(true)
      .reply(200, WIKI_JSON);

    const res = await request(app)
      .get('/search')
      .query({ q: 'formal-ai' })
      .expect(200);
    expect(res.body.provider).toBe('wikipedia');
  });

  it('rejects a missing query', async () => {
    await request(app).get('/search').expect(400);
  });

  it('rejects an unknown provider', async () => {
    await request(app)
      .get('/search')
      .query({ q: 'x', provider: 'yahoo' })
      .expect(400);
  });
});
