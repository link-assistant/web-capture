import { jest } from '@jest/globals';
import {
  isGoogleDocsUrl,
  extractDocumentId,
  buildExportUrl,
  buildEditUrl,
  buildDocsApiUrl,
  extractBase64Images,
  parseGoogleDocsModelChunks,
  renderGoogleDocsCapture,
  renderDocsApiDocument,
  selectGoogleDocsCaptureMethod,
  GDOCS_EXPORT_FORMATS,
} from '../../src/gdocs.js';
import {
  extractAndSaveImages,
  extractBase64ToBuffers,
  stripBase64Images,
} from '../../src/extract-images.js';
import fs from 'fs';
import os from 'os';
import path from 'path';

jest.setTimeout(30000);

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
            { ty: 'ste', id: 'suggested-image', spi: 10 },
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
