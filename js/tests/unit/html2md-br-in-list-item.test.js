import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { convertHtmlToMarkdown } from '../../src/lib.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const HTML = fs.readFileSync(
  path.join(__dirname, '..', 'fixtures', 'list-item-with-br.html'),
  'utf8'
);

it('preserves <br> as a line separator inside list items', () => {
  const md = convertHtmlToMarkdown(HTML);
  for (const tag of ['TAG1', 'TAG2', 'TAG3']) {
    expect(md).toMatch(
      new RegExp(`(^|\\n)\\s*\\*{0,2}${tag}\\*{0,2}\\s*–`, 'm')
    );
  }
  // Definitions must not be glued on the same line (no <br> dropped).
  expect(md).not.toMatch(/Definition one\.[ \t]*\*{0,2}TAG2/);
  expect(md).not.toMatch(/Definition two\.[ \t]*\*{0,2}TAG3/);
});
