import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { convertHtmlToMarkdown } from '../../src/lib.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const HTML = fs.readFileSync(
  path.join(__dirname, '..', 'fixtures', 'heading-numbering.html'),
  'utf8'
);

it('preserves hierarchical heading numbering (13, 13.1, 13.2, 13.3)', () => {
  const md = convertHtmlToMarkdown(HTML);

  // Parent number 13 must survive — either as Markdown heading or as numbered-list item.
  expect(md).toMatch(/(^|\n)#{1,6}\s+13\.|(^|\n)13\.\s/);

  // Sub-numbers 13.1, 13.2, 13.3 must each appear in heading-like context (line start, not buried mid-paragraph).
  for (const sub of ['13.1', '13.2', '13.3']) {
    expect(md).toMatch(
      new RegExp(`(^|\\n)\\s*\\*{0,3}\\s*${sub.replace('.', '\\.')}`, 'm')
    );
  }

  // Subsections must NOT be wrapped in markdown blockquotes — there is no <blockquote> in the fixture.
  expect(md).not.toMatch(/^>\s+\*{1,3}13\.\d/m);
});
