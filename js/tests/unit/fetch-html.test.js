import nock from 'nock';
import { fetchHtml } from '../../src/lib.js';

afterEach(() => {
  nock.cleanAll();
});

describe('fetchHtml', () => {
  it('requests identity encoding for document HTML fetches', async () => {
    nock('https://example.com', {
      reqheaders: {
        'accept-encoding': 'identity',
      },
    })
      .get('/article')
      .reply(200, '<html><body>ok</body></html>', {
        'content-type': 'text/html; charset=utf-8',
      });

    await expect(fetchHtml('https://example.com/article')).resolves.toContain(
      'ok'
    );
  });
});
