import { convertHtmlToMarkdown } from '../../src/lib.js';
import { extractBase64Images } from '../../src/gdocs.js';

const PNG_B64 =
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNgYAAAAAMAASsJTYQAAAAASUVORK5CYII=';

const IMG_REF_PATTERN = /!\[[^\]]*\]\([^)]*images\/[^)]+\)/g;

describe('heading image parity', () => {
  it('<img> inside <h1> survives Turndown and stays in sync with extraction', () => {
    const html = `<html><body><h1>Title <img src="data:image/png;base64,${PNG_B64}" alt="x"></h1><p>Body</p></body></html>`;

    const { html: localHtml, images } = extractBase64Images(html);
    const md = convertHtmlToMarkdown(localHtml);
    const mdImgCount = (md.match(IMG_REF_PATTERN) || []).length;

    expect(images).toHaveLength(1);
    expect(mdImgCount).toBe(images.length);
  });

  it('<img> inside all heading levels is preserved', () => {
    for (let level = 1; level <= 6; level++) {
      const tag = `h${level}`;
      const html = `<html><body><${tag}><img src="data:image/png;base64,${PNG_B64}" alt="icon"> Heading</${tag}></body></html>`;

      const { html: localHtml, images } = extractBase64Images(html);
      const md = convertHtmlToMarkdown(localHtml);
      const refs = (md.match(IMG_REF_PATTERN) || []).length;

      expect(refs).toBe(images.length);
    }
  });

  it('image count parity across full pipeline', () => {
    const html = `<html><body>
<h1><img src="data:image/png;base64,${PNG_B64}" alt="h1"> Chapter</h1>
<p>Text <img src="data:image/png;base64,${PNG_B64}" alt="p1"> here.</p>
<h2><img src="data:image/png;base64,${PNG_B64}" alt="h2"> Section</h2>
<p><img src="data:image/png;base64,${PNG_B64}" alt="p2"></p>
</body></html>`;

    const { html: localHtml, images } = extractBase64Images(html);
    const md = convertHtmlToMarkdown(localHtml);
    const mdRefCount = (md.match(IMG_REF_PATTERN) || []).length;

    expect(images).toHaveLength(4);
    expect(mdRefCount).toBe(images.length);
  });
});
