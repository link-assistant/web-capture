import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { convertHtmlToMarkdown } from '../../src/lib.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const HTML = fs.readFileSync(
  path.join(__dirname, '..', 'fixtures', 'ol-continuous-numbering.html'),
  'utf8'
);

it('numbers consecutive top-level ordered lists continuously', () => {
  const md = convertHtmlToMarkdown(HTML);
  expect(md).toMatch(/^\s*1\.\s+\*\*First\*\*/m);
  expect(md).toMatch(/^\s*2\.\s+\*\*Second\*\*/m);
  expect(md).toMatch(/^\s*3\.\s+\*\*Third\*\*/m);
  expect(md).toMatch(/^\s*4\.\s+\*\*Fourth\*\*/m);
  expect(md).toMatch(/^\s*13\.\s+\*\*Top-level/m);
});
