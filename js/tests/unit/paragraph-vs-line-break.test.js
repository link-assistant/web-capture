import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import MarkdownIt from 'markdown-it';
import {
  convertHtmlToMarkdown,
  convertHtmlToMarkdownEnhanced,
} from '../../src/lib.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const HTML = fs.readFileSync(
  path.join(__dirname, '..', 'fixtures', 'paragraph-vs-line-break.html'),
  'utf8'
);

describe('<br><br> coalesces to a paragraph break (not two hard breaks)', () => {
  it('renders a paragraph break between Caption A and Caption B (convertHtmlToMarkdown)', () => {
    const md = convertHtmlToMarkdown(HTML);
    const lines = md.split('\n');
    const idxA = lines.findIndex((l) => l.includes('Caption A:'));
    const idxB = lines.findIndex((l) => l.includes('Caption B:'));
    expect(idxA).toBeGreaterThanOrEqual(0);
    expect(idxB).toBeGreaterThan(idxA);

    const between = lines.slice(idxA + 1, idxB);
    expect(between.some((l) => l === '')).toBe(true);

    expect(md).not.toMatch(/^[ \t]+ {2}$/m);
  });

  it('renders a paragraph break between Caption A and Caption B (convertHtmlToMarkdownEnhanced)', () => {
    const { markdown } = convertHtmlToMarkdownEnhanced(HTML);
    const lines = markdown.split('\n');
    const idxA = lines.findIndex((l) => l.includes('Caption A:'));
    const idxB = lines.findIndex((l) => l.includes('Caption B:'));
    expect(idxA).toBeGreaterThanOrEqual(0);
    expect(idxB).toBeGreaterThan(idxA);

    const between = lines.slice(idxA + 1, idxB);
    expect(between.some((l) => l === '')).toBe(true);

    expect(markdown).not.toMatch(/^[ \t]+ {2}$/m);
  });

  it('CommonMark renders Caption A and Caption B as separate paragraphs', () => {
    const md = convertHtmlToMarkdown(HTML);
    const html = new MarkdownIt('commonmark').render(md);
    const aIdx = html.indexOf('Caption A:');
    const bIdx = html.indexOf('Caption B:');
    expect(aIdx).toBeGreaterThan(-1);
    expect(bIdx).toBeGreaterThan(aIdx);
    const between = html.slice(aIdx, bIdx);
    expect(between).toMatch(/<\/p>\s*<p>/);
  });
});
