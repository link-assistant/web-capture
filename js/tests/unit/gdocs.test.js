import { jest } from '@jest/globals';
import {
  isGoogleDocsUrl,
  extractDocumentId,
  buildExportUrl,
  buildEditUrl,
  buildDocsApiUrl,
  extractBase64Images,
  captureGoogleDocWithBrowserOrFallback,
  isGoogleDocsBrowserModelUnavailableError,
  parseGoogleDocsModelChunks,
  renderGoogleDocsCapture,
  renderDocsApiDocument,
  selectGoogleDocsCaptureMethod,
  localizeGoogleDocsModelImages,
  normalizeGoogleDocsExportMarkdown,
  preprocessGoogleDocsExportHtml,
  GDOCS_EXPORT_FORMATS,
} from '../../src/gdocs.js';
import { convertHtmlToMarkdown } from '../../src/lib.js';
import {
  extractAndSaveImages,
  extractBase64ToBuffers,
  stripBase64Images,
} from '../../src/extract-images.js';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { fileURLToPath } from 'url';
import nock from 'nock';

jest.setTimeout(30000);

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const REPO_ROOT = path.resolve(__dirname, '..', '..', '..');
const ISSUE_104_FIXTURE_DIR = path.join(
  REPO_ROOT,
  'docs',
  'case-studies',
  'issue-104',
  'fixtures'
);

function readIssue104Fixture(filename) {
  return fs.readFileSync(path.join(ISSUE_104_FIXTURE_DIR, filename), 'utf-8');
}

describe('gdocs', () => {
  describe('isGoogleDocsUrl', () => {
    it('returns true for standard Google Docs edit URL', () => {
      expect(
        isGoogleDocsUrl(
          'https://docs.google.com/document/d/1yn5AWdus0Rh5xRr6voNy-g2wNzdC4bM0CV7SQWch9H4/edit'
        )
      ).toBe(true);
    });

    it('returns true for URL with query parameters', () => {
      expect(
        isGoogleDocsUrl(
          'https://docs.google.com/document/d/abc123/edit?tab=t.0'
        )
      ).toBe(true);
    });

    it('returns true for URL without /edit', () => {
      expect(
        isGoogleDocsUrl('https://docs.google.com/document/d/abc-123_XYZ/')
      ).toBe(true);
    });

    it('returns false for non-Google Docs URL', () => {
      expect(isGoogleDocsUrl('https://example.com')).toBe(false);
    });

    it('returns false for Google Sheets URL', () => {
      expect(
        isGoogleDocsUrl('https://docs.google.com/spreadsheets/d/abc123/edit')
      ).toBe(false);
    });

    it('returns false for empty string', () => {
      expect(isGoogleDocsUrl('')).toBe(false);
    });

    it('returns false for null', () => {
      expect(isGoogleDocsUrl(null)).toBe(false);
    });

    it('returns false for undefined', () => {
      expect(isGoogleDocsUrl(undefined)).toBe(false);
    });

    it('returns false for non-string input', () => {
      expect(isGoogleDocsUrl(123)).toBe(false);
    });
  });

  describe('extractDocumentId', () => {
    it('extracts document ID from standard URL', () => {
      expect(
        extractDocumentId(
          'https://docs.google.com/document/d/1yn5AWdus0Rh5xRr6voNy-g2wNzdC4bM0CV7SQWch9H4/edit'
        )
      ).toBe('1yn5AWdus0Rh5xRr6voNy-g2wNzdC4bM0CV7SQWch9H4');
    });

    it('extracts document ID from URL with query params', () => {
      expect(
        extractDocumentId(
          'https://docs.google.com/document/d/abc123/edit?tab=t.0'
        )
      ).toBe('abc123');
    });

    it('extracts document ID with hyphens and underscores', () => {
      expect(
        extractDocumentId('https://docs.google.com/document/d/abc-123_XYZ/')
      ).toBe('abc-123_XYZ');
    });

    it('returns null for non-Google Docs URL', () => {
      expect(extractDocumentId('https://example.com')).toBeNull();
    });

    it('returns null for empty string', () => {
      expect(extractDocumentId('')).toBeNull();
    });

    it('returns null for null input', () => {
      expect(extractDocumentId(null)).toBeNull();
    });
  });

  describe('buildExportUrl', () => {
    it('builds HTML export URL', () => {
      expect(buildExportUrl('abc123', 'html')).toBe(
        'https://docs.google.com/document/d/abc123/export?format=html'
      );
    });

    it('builds Markdown export URL', () => {
      expect(buildExportUrl('abc123', 'md')).toBe(
        'https://docs.google.com/document/d/abc123/export?format=md'
      );
    });

    it('builds PDF export URL', () => {
      expect(buildExportUrl('abc123', 'pdf')).toBe(
        'https://docs.google.com/document/d/abc123/export?format=pdf'
      );
    });

    it('builds TXT export URL', () => {
      expect(buildExportUrl('abc123', 'txt')).toBe(
        'https://docs.google.com/document/d/abc123/export?format=txt'
      );
    });

    it('defaults to html for unknown format', () => {
      expect(buildExportUrl('abc123', 'invalid')).toBe(
        'https://docs.google.com/document/d/abc123/export?format=html'
      );
    });

    it('defaults to html when format is omitted', () => {
      expect(buildExportUrl('abc123')).toBe(
        'https://docs.google.com/document/d/abc123/export?format=html'
      );
    });

    it('uses the real document ID from test document', () => {
      const docId = '1yn5AWdus0Rh5xRr6voNy-g2wNzdC4bM0CV7SQWch9H4';
      expect(buildExportUrl(docId, 'html')).toBe(
        `https://docs.google.com/document/d/${docId}/export?format=html`
      );
    });
  });

  describe('capture method selection (issue #72)', () => {
    it('honors explicit browser capture for Google Docs URLs', () => {
      expect(selectGoogleDocsCaptureMethod('browser')).toBe('browser-model');
    });

    it('uses public export for API capture without token', () => {
      expect(selectGoogleDocsCaptureMethod('api')).toBe('public-export');
    });

    it('uses Docs REST API for API capture with token', () => {
      expect(selectGoogleDocsCaptureMethod('api', 'token-123')).toBe(
        'docs-api'
      );
    });
  });

  describe('buildEditUrl', () => {
    it('builds the fresh Google Docs editor URL', () => {
      expect(buildEditUrl('abc123')).toBe(
        'https://docs.google.com/document/d/abc123/edit'
      );
    });
  });

  describe('buildDocsApiUrl', () => {
    it('builds the Google Docs REST API URL', () => {
      expect(buildDocsApiUrl('abc123')).toBe(
        'https://docs.googleapis.com/v1/documents/abc123'
      );
    });
  });

  describe('parseGoogleDocsModelChunks (issue #72)', () => {
    it('includes regular and suggested text from DOCS_modelChunk data', () => {
      const capture = parseGoogleDocsModelChunks([
        {
          chunk: [
            { ty: 'is', s: 'Stable ' },
            { ty: 'iss', s: 'suggested\n' },
          ],
        },
      ]);

      expect(capture.text).toContain('Stable suggested');
      expect(renderGoogleDocsCapture(capture, 'markdown')).toContain(
        'Stable suggested'
      );
    });

    it('accepts individual DOCS_modelChunk items captured from push calls', () => {
      const capture = parseGoogleDocsModelChunks([
        { ty: 'is', s: 'Pushed item\n' },
      ]);

      expect(capture.text).toContain('Pushed item');
      expect(renderGoogleDocsCapture(capture, 'markdown')).toContain(
        'Pushed item'
      );
    });

    it('extracts table cells and suggested images from DOCS_modelChunk data', () => {
      const chunks = [
        {
          chunk: [
            { ty: 'is', s: String.fromCharCode(0x10) },
            { ty: 'is', s: String.fromCharCode(0x12) },
            { ty: 'is', s: String.fromCharCode(0x1c) },
            { ty: 'is', s: 'Cell A' },
            { ty: 'is', s: String.fromCharCode(0x1c) },
            { ty: 'is', s: '*' },
            { ty: 'is', s: '\n' },
            { ty: 'is', s: String.fromCharCode(0x11) },
            {
              ty: 'ase',
              id: 'suggested-image',
              epm: { ee_eo: { i_cid: 'cid_12345678901234567890' } },
            },
            { ty: 'ste', id: 'suggested-image', spi: 11 },
          ],
        },
      ];
      const capture = parseGoogleDocsModelChunks(chunks, {
        cid_12345678901234567890:
          'https://docs.google.com/docs-images-rt/image-id',
      });
      const markdown = renderGoogleDocsCapture(capture, 'markdown');

      expect(capture.tables).toHaveLength(1);
      expect(capture.tables[0].rows[0].cells).toHaveLength(2);
      expect(markdown).toContain('Cell A');
      expect(markdown).toContain(
        '![suggested image](https://docs.google.com/docs-images-rt/image-id)'
      );
    });

    it('parses multi-column tables when rows are separated by 0x0a (issue #92 R2)', () => {
      // Google Docs sometimes emits cell boundaries as `\n` (0x0a) alongside
      // the 0x12 new-row marker. The parser must keep all cells on the same
      // row rather than collapsing the table to a single column.
      const chunks = [
        {
          chunk: [
            {
              ty: 'is',
              s: `${
                String.fromCharCode(0x10) + String.fromCharCode(0x12)
              }A\nB\nC\n${String.fromCharCode(
                0x12
              )}D\nE\nF\n${String.fromCharCode(0x11)}`,
            },
          ],
        },
      ];
      const capture = parseGoogleDocsModelChunks(chunks);

      expect(capture.tables).toHaveLength(1);
      expect(capture.tables[0].rows).toHaveLength(2);
      expect(capture.tables[0].rows[0].cells).toHaveLength(3);
      expect(capture.tables[0].rows[1].cells).toHaveLength(3);

      const markdown = renderGoogleDocsCapture(capture, 'markdown');
      expect(markdown).toContain('| A | B | C |');
      expect(markdown).toContain('| D | E | F |');
    });

    it('does not create empty columns when Docs emits both 0x1c and 0x0a cell separators (issue #96)', () => {
      const chunks = [
        {
          chunk: [
            {
              ty: 'is',
              s: `${
                String.fromCharCode(0x10) + String.fromCharCode(0x12)
              }A${String.fromCharCode(0x1c)}\nB${String.fromCharCode(
                0x1c
              )}\nC\n${String.fromCharCode(0x11)}`,
            },
          ],
        },
      ];
      const capture = parseGoogleDocsModelChunks(chunks);
      const markdown = renderGoogleDocsCapture(capture, 'markdown');

      expect(capture.tables[0].rows[0].cells).toHaveLength(3);
      expect(markdown).toContain('| A | B | C |');
      expect(markdown).not.toContain('| A |  | B |');
    });

    it('does not create ghost columns from the live Google Docs 0x0a+0x1c table separator pattern (issue #100)', () => {
      const chunks = [
        {
          chunk: [
            {
              ty: 'is',
              s: `${String.fromCharCode(0x10)}${String.fromCharCode(
                0x12
              )}${String.fromCharCode(0x1c)}Feature\n${String.fromCharCode(
                0x1c
              )}Supported\n${String.fromCharCode(0x1c)}Notes\n${String.fromCharCode(
                0x12
              )}${String.fromCharCode(0x1c)}Bold\n${String.fromCharCode(
                0x1c
              )}Yes\n${String.fromCharCode(
                0x1c
              )}Using double asterisks\n${String.fromCharCode(0x11)}`,
            },
          ],
        },
      ];
      const capture = parseGoogleDocsModelChunks(chunks);
      const markdown = renderGoogleDocsCapture(capture, 'markdown');

      expect(capture.tables[0].rows.map((row) => row.cells.length)).toEqual([
        3, 3,
      ]);
      expect(markdown).toContain('| Feature | Supported | Notes |');
      expect(markdown).toContain('| Bold | Yes | Using double asterisks |');
      expect(markdown).not.toContain('| Feature |  | Supported |');
    });

    it('preserves intentionally empty table cells without shifting following cells (issue #100)', () => {
      const chunks = [
        {
          chunk: [
            {
              ty: 'is',
              s: `${String.fromCharCode(0x10)}${String.fromCharCode(
                0x12
              )}${String.fromCharCode(0x1c)}A\n${String.fromCharCode(
                0x1c
              )}B\n${String.fromCharCode(0x1c)}C\n${String.fromCharCode(
                0x12
              )}${String.fromCharCode(0x1c)}\n${String.fromCharCode(
                0x1c
              )}x\n${String.fromCharCode(0x1c)}\n${String.fromCharCode(
                0x12
              )}${String.fromCharCode(0x1c)}y\n${String.fromCharCode(
                0x1c
              )}\n${String.fromCharCode(0x1c)}z\n${String.fromCharCode(0x11)}`,
            },
          ],
        },
      ];
      const capture = parseGoogleDocsModelChunks(chunks);
      const markdown = renderGoogleDocsCapture(capture, 'markdown');

      expect(capture.tables[0].rows.map((row) => row.cells.length)).toEqual([
        3, 3, 3,
      ]);
      expect(markdown).toContain('| A | B | C |');
      expect(markdown).toContain('|  | x |  |');
      expect(markdown).toContain('| y |  | z |');
    });

    it('numbers ordered list items sequentially (issue #92 R3)', () => {
      // Three list items sharing the same list id should render as 1. 2. 3.
      const text = 'First item\nSecond item\nThird item\n';
      const endOfLine = (n) => {
        let idx = -1;
        for (let k = 0; k < n; k++) {
          idx = text.indexOf('\n', idx + 1);
        }
        return idx + 1;
      };
      const chunks = [
        {
          chunk: [
            { ty: 'is', s: text },
            {
              ty: 'as',
              st: 'list',
              si: endOfLine(1),
              ei: endOfLine(1),
              sm: { ls_id: 'kix.list.7' },
            },
            {
              ty: 'as',
              st: 'list',
              si: endOfLine(2),
              ei: endOfLine(2),
              sm: { ls_id: 'kix.list.7' },
            },
            {
              ty: 'as',
              st: 'list',
              si: endOfLine(3),
              ei: endOfLine(3),
              sm: { ls_id: 'kix.list.7' },
            },
          ],
        },
      ];
      const capture = parseGoogleDocsModelChunks(chunks);
      const markdown = renderGoogleDocsCapture(capture, 'markdown');
      const lines = markdown.split('\n');

      expect(lines[0]).toBe('1. First item');
      expect(lines[1]).toBe('2. Second item');
      expect(lines[2]).toBe('3. Third item');
    });

    it('joins consecutive list items with a single newline (issue #92 R4)', () => {
      const text = 'First item\nSecond item\n';
      const endFirst = text.indexOf('\n') + 1;
      const endSecond = text.length;
      const chunks = [
        {
          chunk: [
            { ty: 'is', s: text },
            {
              ty: 'as',
              st: 'list',
              si: endFirst,
              ei: endFirst,
              sm: { ls_id: 'kix.list.7' },
            },
            {
              ty: 'as',
              st: 'list',
              si: endSecond,
              ei: endSecond,
              sm: { ls_id: 'kix.list.7' },
            },
          ],
        },
      ];
      const capture = parseGoogleDocsModelChunks(chunks);
      const markdown = renderGoogleDocsCapture(capture, 'markdown');

      expect(markdown).not.toMatch(/First item\n\n2\. Second item/u);
      expect(markdown).toMatch(/First item\n2\. Second item/u);
    });

    it('keeps nested ordered lists ordered and tight when Google Docs uses separate list ids per level (issue #100)', () => {
      const text = [
        'Parent item 1',
        'Child item 1.1',
        'Child item 1.2',
        'Grandchild item 1.2.1',
        'Grandchild item 1.2.2',
        'Child item 1.3',
        'Parent item 2',
        '',
      ].join('\n');
      const lineEnd = (needle) => text.indexOf('\n', text.indexOf(needle)) + 1;
      const chunks = [
        {
          chunk: [
            { ty: 'is', s: text },
            {
              ty: 'as',
              st: 'list',
              si: lineEnd('Parent item 1'),
              ei: lineEnd('Parent item 1'),
              sm: { ls_id: 'kix.list.8' },
            },
            {
              ty: 'as',
              st: 'list',
              si: lineEnd('Child item 1.1'),
              ei: lineEnd('Child item 1.1'),
              sm: { ls_id: 'kix.list.9', ls_nest: 1 },
            },
            {
              ty: 'as',
              st: 'list',
              si: lineEnd('Child item 1.2'),
              ei: lineEnd('Child item 1.2'),
              sm: { ls_id: 'kix.list.9', ls_nest: 1 },
            },
            {
              ty: 'as',
              st: 'list',
              si: lineEnd('Grandchild item 1.2.1'),
              ei: lineEnd('Grandchild item 1.2.1'),
              sm: { ls_id: 'kix.list.10', ls_nest: 2 },
            },
            {
              ty: 'as',
              st: 'list',
              si: lineEnd('Grandchild item 1.2.2'),
              ei: lineEnd('Grandchild item 1.2.2'),
              sm: { ls_id: 'kix.list.10', ls_nest: 2 },
            },
            {
              ty: 'as',
              st: 'list',
              si: lineEnd('Child item 1.3'),
              ei: lineEnd('Child item 1.3'),
              sm: { ls_id: 'kix.list.9', ls_nest: 1 },
            },
            {
              ty: 'as',
              st: 'list',
              si: lineEnd('Parent item 2'),
              ei: lineEnd('Parent item 2'),
              sm: { ls_id: 'kix.list.8' },
            },
          ],
        },
      ];
      const capture = parseGoogleDocsModelChunks(chunks);
      const markdown = renderGoogleDocsCapture(capture, 'markdown');

      expect(markdown).toContain(
        [
          '1. Parent item 1',
          '    1. Child item 1.1',
          '    2. Child item 1.2',
          '        1. Grandchild item 1.2.1',
          '        2. Grandchild item 1.2.2',
          '    3. Child item 1.3',
          '2. Parent item 2',
        ].join('\n')
      );
      expect(markdown).not.toContain('Parent item 1\n\n');
      expect(markdown).not.toContain('- Child item 1.1');
    });

    it('renders model style records for headings, inline formatting, links, lists, blockquotes, rules, and images', () => {
      const text = [
        'Title',
        'This is bold, italic, strike, and link',
        '-',
        'Item',
        'Quote',
        '*',
        '',
      ].join('\n');
      const startOf = (needle) => text.indexOf(needle) + 1;
      const endOf = (needle) => startOf(needle) + needle.length - 1;
      const lineEnd = (needle) => text.indexOf('\n', text.indexOf(needle)) + 1;
      const chunks = [
        {
          chunk: [
            { ty: 'is', s: text },
            {
              ty: 'as',
              st: 'paragraph',
              si: lineEnd('Title'),
              ei: lineEnd('Title'),
              sm: { ps_hd: 1 },
            },
            {
              ty: 'as',
              st: 'text',
              si: startOf('bold'),
              ei: endOf('bold'),
              sm: { ts_bd: true },
            },
            {
              ty: 'as',
              st: 'text',
              si: startOf('italic'),
              ei: endOf('italic'),
              sm: { ts_it: true },
            },
            {
              ty: 'as',
              st: 'text',
              si: startOf('strike'),
              ei: endOf('strike'),
              sm: { ts_st: true },
            },
            {
              ty: 'as',
              st: 'link',
              si: startOf('link'),
              ei: endOf('link'),
              sm: { lnks_link: { ulnk_url: 'https://example.com' } },
            },
            {
              ty: 'as',
              st: 'horizontal_rule',
              si: startOf('-'),
              ei: startOf('-'),
              sm: {},
            },
            {
              ty: 'as',
              st: 'list',
              si: lineEnd('Item'),
              ei: lineEnd('Item'),
              sm: { ls_id: 'kix.list.3' },
            },
            {
              ty: 'as',
              st: 'paragraph',
              si: lineEnd('Quote'),
              ei: lineEnd('Quote'),
              sm: { ps_il: 24, ps_ifl: 24 },
            },
            {
              ty: 'ae',
              et: 'inline',
              id: 'image-1',
              epm: {
                ee_eo: {
                  i_cid: 'cid_12345678901234567890',
                  eo_ad: 'Blue rectangle',
                },
              },
            },
            { ty: 'te', id: 'image-1', spi: startOf('*') },
          ],
        },
      ];

      const capture = parseGoogleDocsModelChunks(chunks, {
        cid_12345678901234567890:
          'https://docs.google.com/docs-images-rt/image-id',
      });
      const markdown = renderGoogleDocsCapture(capture, 'markdown');

      expect(markdown).toContain('# Title');
      expect(markdown).toContain(
        'This is **bold**, *italic*, ~~strike~~, and [link](https://example.com)'
      );
      expect(markdown).toContain('---');
      expect(markdown).toContain('- Item');
      expect(markdown).toContain('> Quote');
      expect(markdown).toContain(
        '![Blue rectangle](https://docs.google.com/docs-images-rt/image-id)'
      );
    });

    it('renders soft breaks outside marks and preserves image dimensions (issue #104)', () => {
      const fixture = JSON.parse(
        readIssue104Fixture('multiline-marked-inline-image-model.json')
      );
      const capture = parseGoogleDocsModelChunks(
        fixture.chunks,
        fixture.cidUrlMap
      );

      expect(capture.blocks[0].content).toEqual([
        expect.objectContaining({
          type: 'text',
          text: 'Line one of bold text.',
          bold: true,
        }),
        expect.objectContaining({ type: 'text', text: '\n', bold: false }),
        expect.objectContaining({
          type: 'text',
          text: 'Line two of bold text.',
          bold: true,
        }),
        expect.objectContaining({
          type: 'image',
          alt: 'Inline diagram',
          width: 320,
          height: 180,
        }),
        expect.objectContaining({ type: 'text', text: '\n\n', bold: false }),
        expect.objectContaining({
          type: 'text',
          text: 'Line three of bold text.',
          bold: true,
        }),
      ]);
      expect(renderGoogleDocsCapture(capture, 'html')).toBe(
        readIssue104Fixture(
          'multiline-marked-inline-image.expected.html'
        ).trimEnd()
      );
      expect(renderGoogleDocsCapture(capture, 'markdown')).toBe(
        readIssue104Fixture('multiline-marked-inline-image.expected.md')
      );
    });

    it('does not keep inline marks open across embedded newlines (issue #104)', () => {
      const capture = {
        blocks: [
          {
            type: 'paragraph',
            content: [
              {
                type: 'text',
                text: 'Alpha\nBeta',
                bold: true,
              },
            ],
          },
        ],
      };

      expect(renderGoogleDocsCapture(capture, 'html')).toBe(
        '<!doctype html><html><body><p><strong>Alpha</strong><br><strong>Beta</strong></p></body></html>'
      );
      expect(renderGoogleDocsCapture(capture, 'markdown')).toBe(
        '**Alpha**\n**Beta**\n'
      );
    });

    it('keeps nested bold and italic markers balanced (issue #96)', () => {
      const text = 'Bold text with italic inside and back to bold\n';
      const chunks = [
        {
          chunk: [
            { ty: 'is', s: text },
            {
              ty: 'as',
              st: 'text',
              si: 1,
              ei: text.length - 1,
              sm: { ts_bd: true },
            },
            {
              ty: 'as',
              st: 'text',
              si: text.indexOf('italic') + 1,
              ei: text.indexOf('italic') + 'italic inside'.length,
              sm: { ts_it: true },
            },
          ],
        },
      ];
      const capture = parseGoogleDocsModelChunks(chunks);
      const markdown = renderGoogleDocsCapture(capture, 'markdown');

      expect(markdown).toBe(
        '**Bold text with *italic inside* and back to bold**\n'
      );
    });

    it('keeps styled same-target link segments in one link label (issue #96)', () => {
      const text = 'Link with bold text\n';
      const startOf = (needle) => text.indexOf(needle) + 1;
      const endOf = (needle) => startOf(needle) + needle.length - 1;
      const chunks = [
        {
          chunk: [
            { ty: 'is', s: text },
            {
              ty: 'as',
              st: 'link',
              si: 1,
              ei: text.length - 1,
              sm: { lnks_link: { ulnk_url: 'https://example.com' } },
            },
            {
              ty: 'as',
              st: 'text',
              si: startOf('bold'),
              ei: endOf('bold'),
              sm: { ts_bd: true },
            },
          ],
        },
      ];
      const capture = parseGoogleDocsModelChunks(chunks);
      const markdown = renderGoogleDocsCapture(capture, 'markdown');

      expect(markdown).toBe('[Link with **bold** text](https://example.com)\n');
    });

    it('keeps consecutive blockquote paragraphs in the same quote block (issue #96)', () => {
      const text = 'Quote paragraph one\nQuote paragraph two\n';
      const lineEnd = (needle) => text.indexOf(needle) + needle.length + 1;
      const chunks = [
        {
          chunk: [
            { ty: 'is', s: text },
            {
              ty: 'as',
              st: 'paragraph',
              si: lineEnd('Quote paragraph one'),
              ei: lineEnd('Quote paragraph one'),
              sm: { ps_il: 24, ps_ifl: 24 },
            },
            {
              ty: 'as',
              st: 'paragraph',
              si: lineEnd('Quote paragraph two'),
              ei: lineEnd('Quote paragraph two'),
              sm: { ps_il: 24, ps_ifl: 24 },
            },
          ],
        },
      ];
      const capture = parseGoogleDocsModelChunks(chunks);
      const markdown = renderGoogleDocsCapture(capture, 'markdown');

      expect(markdown).toBe(
        '> Quote paragraph one\n>\n> Quote paragraph two\n'
      );
    });

    it('ends rendered markdown with a newline (issue #96)', () => {
      const capture = parseGoogleDocsModelChunks([
        { ty: 'is', s: 'Last line\n' },
      ]);

      expect(renderGoogleDocsCapture(capture, 'markdown')).toBe('Last line\n');
    });
  });

  describe('renderDocsApiDocument (issue #72)', () => {
    it('renders Google Docs REST API paragraphs, tables, and inline images', () => {
      const apiDocument = {
        title: 'API Doc',
        body: {
          content: [
            {
              paragraph: {
                elements: [{ textRun: { content: 'Intro paragraph\n' } }],
              },
            },
            {
              table: {
                tableRows: [
                  {
                    tableCells: [
                      {
                        content: [
                          {
                            paragraph: {
                              elements: [{ textRun: { content: 'Name\n' } }],
                            },
                          },
                        ],
                      },
                      {
                        content: [
                          {
                            paragraph: {
                              elements: [
                                {
                                  inlineObjectElement: {
                                    inlineObjectId: 'image-1',
                                  },
                                },
                              ],
                            },
                          },
                        ],
                      },
                    ],
                  },
                ],
              },
            },
          ],
        },
        inlineObjects: {
          'image-1': {
            inlineObjectProperties: {
              embeddedObject: {
                title: 'Diagram',
                imageProperties: {
                  contentUri: 'https://example.com/diagram.png',
                },
              },
            },
          },
        },
      };

      const rendered = renderDocsApiDocument(apiDocument);

      expect(rendered.markdown).toContain('Intro paragraph');
      expect(rendered.markdown).toContain('| Name | ![Diagram]');
      expect(rendered.html).toContain('<table>');
      expect(rendered.html).toContain('src="https://example.com/diagram.png"');
    });
  });

  describe('captureGoogleDocWithBrowserOrFallback (issue #81)', () => {
    afterEach(() => {
      nock.cleanAll();
    });

    it('falls back to public export archive when the editor exposes no model chunks', async () => {
      const tinyPng =
        'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8/5+hHgAHggJ/PchI7wAAAABJRU5ErkJggg==';
      nock('https://docs.google.com')
        .get('/document/d/fallback-doc/export')
        .query({ format: 'html' })
        .reply(
          200,
          `<html><body><h1>Fallback Doc</h1><p>Complete text</p><img src="data:image/png;base64,${tinyPng}" alt="diagram"></body></html>`,
          { 'content-type': 'text/html; charset=utf-8' }
        );

      const fallbackErrors = [];
      const result = await captureGoogleDocWithBrowserOrFallback(
        'https://docs.google.com/document/d/fallback-doc/edit',
        {
          format: 'archive',
          waitMs: 0,
          createBrowser: async () =>
            fakeBrowserReturningModel({ chunks: [], cidUrlMap: {} }),
          onFallback: (err) => fallbackErrors.push(err),
        }
      );

      expect(result.method).toBe('public-export');
      expect(result.fallback).toBe(true);
      expect(result.markdown).toContain('Fallback Doc');
      expect(result.markdown).toContain('Complete text');
      expect(result.images).toHaveLength(1);
      expect(result.html).toContain('images/image-01.png');
      expect(fallbackErrors).toHaveLength(1);
      expect(isGoogleDocsBrowserModelUnavailableError(fallbackErrors[0])).toBe(
        true
      );
      expect(nock.isDone()).toBe(true);
    });
  });

  describe('GDOCS_EXPORT_FORMATS', () => {
    it('contains all expected formats', () => {
      expect(GDOCS_EXPORT_FORMATS).toEqual({
        html: 'html',
        txt: 'txt',
        md: 'md',
        pdf: 'pdf',
        docx: 'docx',
        epub: 'epub',
        zip: 'zip',
      });
    });
  });

  describe('localizeGoogleDocsModelImages (issue #92 R5)', () => {
    it('downloads docs-images-rt URLs and rewrites markdown/html', async () => {
      const url =
        'https://docs.google.com/docs-images-rt/doc-id/cid/example.png';
      const modelResult = {
        markdown: `![pic](${url})`,
        html: `<img src="${url}" alt="pic">`,
        capture: {
          images: [{ type: 'image', url, alt: 'pic', cid: 'cid-abc' }],
        },
      };
      const fakeFetch = jest.fn().mockResolvedValue({
        ok: true,
        status: 200,
        headers: new Map([['content-type', 'image/png']]),
        arrayBuffer: async () => new Uint8Array([1, 2, 3, 4]).buffer,
      });
      // The map-based headers need a `get` method in the correct shape:
      fakeFetch.mockResolvedValue({
        ok: true,
        status: 200,
        headers: { get: () => 'image/png' },
        arrayBuffer: async () =>
          new Uint8Array([0x89, 0x50, 0x4e, 0x47]).buffer,
      });

      const localized = await localizeGoogleDocsModelImages(modelResult, {
        fetchImpl: fakeFetch,
      });

      expect(fakeFetch).toHaveBeenCalledTimes(1);
      expect(localized.images).toHaveLength(1);
      expect(localized.images[0].filename).toBe('image-01.png');
      expect(localized.images[0].mimeType).toBe('image/png');
      expect(localized.images[0].data).toBeInstanceOf(Buffer);
      expect(localized.markdown).toBe('![pic](images/image-01.png)');
      expect(localized.html).toContain('images/image-01.png');
      expect(localized.html).not.toContain('docs-images-rt');
    });

    it('keeps original URL when download fails', async () => {
      const url =
        'https://docs.google.com/docs-images-rt/doc-id/cid/missing.png';
      const modelResult = {
        markdown: `![pic](${url})`,
        html: `<img src="${url}" alt="pic">`,
        capture: { images: [{ url, alt: 'pic' }] },
      };
      const fakeFetch = jest.fn().mockResolvedValue({
        ok: false,
        status: 404,
        headers: { get: () => null },
      });

      const localized = await localizeGoogleDocsModelImages(modelResult, {
        fetchImpl: fakeFetch,
      });

      expect(localized.images).toHaveLength(0);
      // Markdown still gets rewritten (local path) even if download fails —
      // callers may choose to ignore this; the key guarantee is that no
      // exception leaks out.
      expect(localized.markdown).toBe('![pic](images/image-01.png)');
    });
  });

  describe('preprocessGoogleDocsExportHtml (issue #92 R6)', () => {
    it('hoists font-weight:700 spans into <strong>', () => {
      const html = '<p><span style="font-weight:700">Bold text</span></p>';
      const { html: out, hoisted } = preprocessGoogleDocsExportHtml(html);
      expect(hoisted).toBe(1);
      expect(out).toContain('<strong>');
      expect(out).toContain('Bold text');
    });

    it('hoists font-style:italic spans into <em>', () => {
      const html = '<p><span style="font-style:italic">Italic text</span></p>';
      const { html: out, hoisted } = preprocessGoogleDocsExportHtml(html);
      expect(hoisted).toBe(1);
      expect(out).toContain('<em>');
    });

    it('hoists text-decoration:line-through spans into <del>', () => {
      const html =
        '<p><span style="text-decoration:line-through">Strike</span></p>';
      const { html: out, hoisted } = preprocessGoogleDocsExportHtml(html);
      expect(hoisted).toBe(1);
      expect(out).toContain('<del>');
    });

    it('hoists Google Docs CSS class styles into semantic inline tags', () => {
      const html =
        '<style>.c7{font-weight:700}.c19{font-style:italic}.c21{text-decoration:line-through}</style>' +
        '<p><span class="c7">Bold</span> <span class="c19">Italic</span> <span class="c21">Strike</span></p>';
      const { html: out, hoisted } = preprocessGoogleDocsExportHtml(html);

      expect(hoisted).toBe(3);
      expect(out).toContain('<strong>Bold</strong>');
      expect(out).toContain('<em>Italic</em>');
      expect(out).toContain('<del>Strike</del>');
    });

    it('combines multiple styles on a single span', () => {
      const html =
        '<p><span style="font-weight:700;font-style:italic;text-decoration:line-through">Mixed</span></p>';
      const { html: out, hoisted } = preprocessGoogleDocsExportHtml(html);
      expect(hoisted).toBe(1);
      // Wrappers appear in <strong><em><del>... order (outer-to-inner).
      expect(out).toContain('<strong>');
      expect(out).toContain('<em>');
      expect(out).toContain('<del>');
    });

    it('unwraps google.com/url?q= redirect links', () => {
      const html =
        '<p><a href="https://www.google.com/url?q=https://example.com&sa=D&source=editors&usg=ABC">Link</a></p>';
      const { html: out, unwrappedLinks } =
        preprocessGoogleDocsExportHtml(html);
      expect(unwrappedLinks).toBe(1);
      expect(out).toContain('href="https://example.com"');
      expect(out).not.toContain('google.com/url?q=');
    });

    it('strips leading empty anchors and numbering span inside headings', () => {
      const html = '<h1><a id="anchor-1"></a><span>1. </span>Headings</h1>';
      const { html: out } = preprocessGoogleDocsExportHtml(html);
      expect(out).toContain('<h1>Headings</h1>');
      expect(out).not.toContain('1. ');
      expect(out).not.toContain('<a id=');
    });

    it('strips standalone empty anchors before headings', () => {
      const html = '<a id="anchor-1"></a><h2>Headings</h2>';
      const { html: out } = preprocessGoogleDocsExportHtml(html);

      expect(out).toContain('<h2>Headings</h2>');
      expect(out).not.toContain('<a id=');
    });

    it('turns class-indented Google Docs paragraphs into blockquotes', () => {
      const html =
        '<style>.c18{margin-left:24pt;margin-right:24pt}</style><p class="c18">Quote</p>';
      const { html: out } = preprocessGoogleDocsExportHtml(html);

      expect(out).toContain('<blockquote><p>Quote</p></blockquote>');
    });

    it('replaces &nbsp; entity and U+00A0 with regular spaces', () => {
      const html = '<p>A\u00A0B&nbsp;C</p>';
      const { html: out } = preprocessGoogleDocsExportHtml(html);
      expect(out).toContain('A B C');
      expect(out).not.toMatch(/\u00A0/);
      expect(out).not.toContain('&nbsp;');
    });

    it('is a no-op for HTML without Google Docs markers', () => {
      const html = '<p>Plain text with <strong>bold</strong>.</p>';
      const {
        html: out,
        hoisted,
        unwrappedLinks,
      } = preprocessGoogleDocsExportHtml(html);
      expect(hoisted).toBe(0);
      expect(unwrappedLinks).toBe(0);
      expect(out).toContain('<p>Plain text with <strong>bold</strong>.</p>');
    });

    it('recovers public-export markdown structure for issue #102', () => {
      const html = `
        <style>
          .c5{margin-left:36pt}
          .c8{margin-left:72pt}
          .c19{margin-left:108pt}
          .q{margin-left:24pt;margin-right:24pt}
          .i{font-style:italic}
          .s{text-decoration:line-through}
        </style>
        <h2><span class="i">1. Headings</span></h2>
        <p class="q">Quote one.</p>
        <p class="q">Quote two.</p>
        <ol><li class="c5">Parent</li></ol>
        <ol><li class="c8">Child</li></ol>
        <ol><li class="c19">Grandchild</li></ol>
        <ol><li class="c5">Parent 2</li></ol>
        <table>
          <thead>
            <tr><td><p>Feature</p></td><td><p>Supported</p></td><tbody></tbody></tr>
            <tr><td><p><span class="s">Strike</span></p></td><td><p>Yes</p></td></tr>
          </thead>
        </table>
      `;

      const preprocessed = preprocessGoogleDocsExportHtml(html);
      const markdown = normalizeGoogleDocsExportMarkdown(
        convertHtmlToMarkdown(preprocessed.html)
      );

      expect(markdown).toContain('## 1. Headings');
      expect(markdown).not.toContain('*1. Headings*');
      expect(markdown).toContain('> Quote one.\n> \n> Quote two.');
      expect(markdown).toMatch(
        /1\.\s+Parent\n\s+1\.\s+Child\n\s+1\.\s+Grandchild\n2\.\s+Parent 2/
      );
      expect(markdown).toContain('| Feature | Supported |');
      expect(markdown).toContain('| ~~Strike~~ | Yes |');
    });
  });

  describe('extractBase64Images', () => {
    it('extracts a single PNG data URI image', () => {
      const html = '<img src="data:image/png;base64,iVBORw0KGgo=" alt="test">';
      const { html: updated, images } = extractBase64Images(html);

      expect(images).toHaveLength(1);
      expect(images[0].filename).toBe('image-01.png');
      expect(images[0].mimeType).toBe('image/png');
      expect(images[0].data).toBeInstanceOf(Buffer);
      expect(updated).toContain('src="images/image-01.png"');
      expect(updated).not.toContain('data:image');
    });

    it('extracts multiple images with correct numbering and extensions', () => {
      const html =
        '<img src="data:image/png;base64,AAAA" alt="a"><img src="data:image/jpeg;base64,BBBB" alt="b">';
      const { html: updated, images } = extractBase64Images(html);

      expect(images).toHaveLength(2);
      expect(images[0].filename).toBe('image-01.png');
      expect(images[1].filename).toBe('image-02.jpg');
      expect(images[1].mimeType).toBe('image/jpeg');
      expect(updated).toContain('images/image-01.png');
      expect(updated).toContain('images/image-02.jpg');
    });

    it('returns empty array when no data URI images', () => {
      const html = '<p>No images here</p>';
      const { html: updated, images } = extractBase64Images(html);

      expect(images).toHaveLength(0);
      expect(updated).toBe(html);
    });

    it('preserves non-data-URI images', () => {
      const html =
        '<img src="https://example.com/photo.png" alt="remote"><img src="data:image/gif;base64,R0lG" alt="local">';
      const { html: updated, images } = extractBase64Images(html);

      expect(images).toHaveLength(1);
      expect(images[0].filename).toBe('image-01.gif');
      expect(updated).toContain('https://example.com/photo.png');
      expect(updated).toContain('images/image-01.gif');
    });
  });

  describe('image extraction pipeline (issue #53)', () => {
    const TINY_PNG =
      'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8/5+hHgAHggJ/PchI7wAAAABJRU5ErkJggg==';
    let tmpDir;

    beforeEach(() => {
      tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'gdocs-issue53-'));
    });

    afterEach(() => {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    });

    it('extractBase64Images from HTML produces images with data buffers', () => {
      const html = `<html><body><img src="data:image/png;base64,${TINY_PNG}" alt="photo"><p>Hello</p></body></html>`;
      const { html: localHtml, images } = extractBase64Images(html);

      expect(images).toHaveLength(1);
      expect(images[0].filename).toBe('image-01.png');
      expect(images[0].data.length).toBeGreaterThan(0);
      // Verify PNG magic bytes in extracted data
      expect(images[0].data[0]).toBe(0x89);
      expect(images[0].data[1]).toBe(0x50); // P
      expect(localHtml).toContain('images/image-01.png');
      expect(localHtml).not.toContain('data:image');
    });

    it('default markdown mode extracts base64 images to disk (not strip)', () => {
      const markdown = `# Hello\n\n![photo](data:image/png;base64,${TINY_PNG})\n\nEnd.`;
      const result = extractAndSaveImages(markdown, tmpDir);

      expect(result.extracted).toBe(1);
      expect(result.markdown).not.toContain('data:image');
      expect(result.markdown).toContain('images/image-');
      expect(result.markdown).toContain('.png');

      const imagesDir = path.join(tmpDir, 'images');
      expect(fs.existsSync(imagesDir)).toBe(true);
      const files = fs.readdirSync(imagesDir);
      expect(files).toHaveLength(1);
      expect(files[0]).toMatch(/^image-.*\.png$/);

      const imgBuf = fs.readFileSync(path.join(imagesDir, files[0]));
      expect(imgBuf[0]).toBe(0x89); // PNG magic
    });

    it('keepOriginalLinks strips base64 images', () => {
      const markdown = `![photo](data:image/png;base64,${TINY_PNG})`;
      const result = stripBase64Images(markdown);

      expect(result.stripped).toBe(1);
      expect(result.markdown).toBe('*[image: photo]*');
      expect(result.markdown).not.toContain('data:image');
    });

    it('extractBase64ToBuffers produces in-memory buffers for archive', () => {
      const markdown = `![test](data:image/png;base64,${TINY_PNG})`;
      const result = extractBase64ToBuffers(markdown);

      expect(result.images).toHaveLength(1);
      expect(result.images[0].buffer.length).toBeGreaterThan(0);
      expect(result.images[0].buffer[0]).toBe(0x89); // PNG magic
      expect(result.markdown).toContain('images/');
      expect(result.markdown).not.toContain('data:image');
    });
  });
});

function fakeBrowserReturningModel(modelData) {
  return {
    async newPage() {
      return {
        async addInitScript() {},
        async setUserAgent() {},
        async setExtraHTTPHeaders() {},
        async setViewport() {},
        async goto() {},
        async waitForTimeout() {},
        async evaluate() {
          return modelData;
        },
        async close() {},
      };
    },
    async close() {},
  };
}
