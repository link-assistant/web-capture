import getPort from 'get-port';
import nock from 'nock';
import { app } from '../../src/index.js';

describe('xpaste.pro HTTP e2e', () => {
  let server;

  afterEach(async () => {
    nock.cleanAll();
    if (server) {
      await new Promise((resolve) => server.close(resolve));
      server = null;
    }
  });

  it('serves raw paste text through the real HTTP server', async () => {
    const pasteText = 'console.log("xpaste fixture");\n';
    nock('https://xpaste.pro')
      .get('/p/js123/raw')
      .reply(200, pasteText, { 'content-type': 'text/plain; charset=utf-8' });

    const port = await getPort();
    server = app.listen(port);

    const response = await fetch(
      `http://127.0.0.1:${port}/txt?url=${encodeURIComponent('https://xpaste.pro/p/js123')}`
    );

    expect(response.status).toBe(200);
    expect(response.headers.get('content-type')).toMatch(/text\/plain/);
    expect(response.headers.get('content-disposition')).toContain(
      'xpaste-pro-js123.txt'
    );
    expect(await response.text()).toBe(pasteText);
  });
});
