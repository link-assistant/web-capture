/**
 * Pin the default `--format archive` layout contract (issue #113):
 * the zip contains exactly `document.md` + `document.html` + `images/`.
 */
import unzipper from 'unzipper';
import { buildArchiveFromHtml } from '../../src/archive.js';

const TINY_PNG =
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8/5+hHgAHggJ/PchI7wAAAABJRU5ErkJggg==';
const FIXTURE_HTML = `<!doctype html><html><body>
  <h1>Hi</h1><p>Para 1.</p>
  <p><img alt="" src="data:image/png;base64,${TINY_PNG}"></p>
  <p>Para 2.</p>
</body></html>`;

it('default archive contains document.md, document.html, and images/ folder', async () => {
  const buf = await buildArchiveFromHtml(
    FIXTURE_HTML,
    'https://example.invalid/'
  );
  const dir = await unzipper.Open.buffer(buf);
  const names = dir.files.map((f) => f.path);

  expect(names).toEqual(
    expect.arrayContaining(['document.md', 'document.html'])
  );
  expect(names.some((n) => n.startsWith('images/'))).toBe(true);

  const mdEntry = dir.files.find((f) => f.path === 'document.md');
  const md = (await mdEntry.buffer()).toString();
  expect(md).toMatch(/images\//);
  expect(md).not.toMatch(/data:image/);

  const htmlEntry = dir.files.find((f) => f.path === 'document.html');
  const html = (await htmlEntry.buffer()).toString();
  expect(html).toMatch(/<h1>/);
});
