import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import {
  normalizeGoogleDocsExportMarkdown,
  preprocessGoogleDocsExportHtml,
} from '../../src/gdocs.js';
import { convertHtmlToMarkdown } from '../../src/lib.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const HTML = fs.readFileSync(
  path.join(__dirname, '..', 'fixtures', 'bold-coalesce-and-leakage.html'),
  'utf8'
);

describe('bold-run coalescing and block boundary handling (issue #120)', () => {
  let md;
  beforeAll(() => {
    const preprocessed = preprocessGoogleDocsExportHtml(HTML);
    md = normalizeGoogleDocsExportMarkdown(
      convertHtmlToMarkdown(preprocessed.html)
    );
  });

  it('A: coalesces adjacent bold spans into a single bold run', () => {
    expect(md).toMatch(/\*\*13\.1 First subsection\*\*/);
    expect(md).not.toMatch(/\*\*13\.1\*\*\s+\*\*First subsection\*\*/);
  });

  it('B: never emits an empty "****" pair between adjacent bold runs', () => {
    expect(md).not.toMatch(/\*{4}/);
  });

  it('C: closes bold at block-level boundaries (<br>, <img>)', () => {
    // No single bold run may contain an image. CommonMark bold cannot span
    // a blank line (`\n\n`), so the inner content is restricted accordingly.
    const strongRe = /\*\*((?:(?!\*\*|\n\n)[\s\S])+?)\*\*/g;
    const imageRe = /!\[[^\]]*\]\([^)]+\)/;
    for (const match of md.matchAll(strongRe)) {
      expect(imageRe.test(match[1])).toBe(false);
    }
    expect(md).toMatch(/\*\*Caption A:\*\*/);
    expect(md).toMatch(/\*\*Caption B:\*\*/);
  });

  it('D: every "**" opener has a matching closer (balanced asterisks)', () => {
    const stripped = md
      .replace(/`[^`]*`/g, '')
      .replace(/!\[[^\]]*\]\([^)]*\)/g, '');
    const count = (stripped.match(/\*\*/g) || []).length;
    expect(count % 2).toBe(0);
  });
});
