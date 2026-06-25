import nock from 'nock';
import { fetchGoogleDocAsMarkdown } from '../../src/gdocs.js';

afterEach(() => {
  nock.cleanAll();
});

describe('Google Docs public export headers', () => {
  it('requests identity encoding for public export fetches', async () => {
    nock('https://docs.google.com', {
      reqheaders: {
        'accept-encoding': 'identity',
      },
    })
      .get('/document/d/export-doc/export')
      .query({ format: 'html' })
      .reply(200, '<html><body><h1>Export Doc</h1></body></html>', {
        'content-type': 'text/html; charset=utf-8',
      });

    const result = await fetchGoogleDocAsMarkdown(
      'https://docs.google.com/document/d/export-doc/edit'
    );

    expect(result.markdown).toContain('Export Doc');
    expect(nock.isDone()).toBe(true);
  });
});
