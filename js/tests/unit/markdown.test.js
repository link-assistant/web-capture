import { shouldRenderHtmlWithBrowser } from '../../src/markdown.js';

describe('markdown rendering decisions', () => {
  it('uses browser rendering for JavaScript-heavy HTML shells', () => {
    const html = `<!doctype html>
      <html>
        <head><script src="/_next/static/app.js"></script></head>
        <body><div id="__next"></div></body>
      </html>`;

    expect(shouldRenderHtmlWithBrowser(html)).toBe(true);
  });

  it('keeps plain HTML on the direct fetch path', () => {
    const html = `<!doctype html>
      <html>
        <head><title>Static page</title></head>
        <body><main><h1>Static content</h1></main></body>
      </html>`;

    expect(shouldRenderHtmlWithBrowser(html)).toBe(false);
  });

  it('keeps static pages with incidental scripts on the direct fetch path', () => {
    const html = `<!doctype html>
      <html>
        <head>
          <title>Static page</title>
          <script src="/analytics.js"></script>
        </head>
        <body><main><h1>Static content</h1></main></body>
      </html>`;

    expect(shouldRenderHtmlWithBrowser(html)).toBe(false);
  });
});
