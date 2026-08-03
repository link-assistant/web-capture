import nock from 'nock';
import { jest } from '@jest/globals';
import { fetchHtml, fetchHtmlReceipt } from '../../src/lib.js';

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

  it('returns an exact-byte receipt through an injectable transport', async () => {
    const body = Buffer.from([0x00, 0xff, 0x41]);
    const transport = jest.fn(async ({ url, signal }) => ({
      body,
      finalUrl: `${url}/final`,
      status: 206,
      headers: { 'content-type': 'application/octet-stream', etag: 'v1' },
      diagnostics: { outcome: 'response' },
      signal,
    }));
    const controller = new globalThis.AbortController();

    const receipt = await fetchHtmlReceipt('https://example.com/bytes', {
      transport,
      signal: controller.signal,
    });

    expect(Buffer.from(receipt.body)).toEqual(body);
    expect(receipt).toMatchObject({
      finalUrl: 'https://example.com/bytes/final',
      status: 206,
      headers: { 'content-type': 'application/octet-stream', etag: 'v1' },
      diagnostics: { outcome: 'response' },
    });
    expect(transport).toHaveBeenCalledWith(
      expect.objectContaining({ signal: controller.signal })
    );
  });
});
