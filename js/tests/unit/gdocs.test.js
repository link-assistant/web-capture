import { jest } from '@jest/globals';
import {
  isGoogleDocsUrl,
  extractDocumentId,
  buildExportUrl,
  GDOCS_EXPORT_FORMATS,
} from '../../src/gdocs.js';

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
});
