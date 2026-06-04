import {
  appendTextPasteMarkdownAttachment,
  getTextPasteFilename,
  isTextPasteUrl,
  normalizeUrlForTextContent,
  normalizeUrlForTextPage,
} from '../../src/lib.js';

describe('xpaste.pro URL handling utilities', () => {
  describe('normalizeUrlForTextContent', () => {
    it('should convert xpaste.pro URL to raw endpoint', () => {
      const url = 'https://xpaste.pro/p/t4q0Lsp0';
      const normalized = normalizeUrlForTextContent(url);
      expect(normalized).toBe('https://xpaste.pro/p/t4q0Lsp0/raw');
    });

    it('should convert localized xpaste.pro URLs to localized raw endpoints', () => {
      expect(
        normalizeUrlForTextContent('https://xpaste.pro/ru/p/t4q0Lsp0')
      ).toBe('https://xpaste.pro/ru/p/t4q0Lsp0/raw');
      expect(
        normalizeUrlForTextContent('https://xpaste.pro/en/p/t4q0Lsp0')
      ).toBe('https://xpaste.pro/en/p/t4q0Lsp0/raw');
    });

    it('should not modify xpaste.pro URL that already has /raw', () => {
      const url = 'https://xpaste.pro/p/t4q0Lsp0/raw';
      const normalized = normalizeUrlForTextContent(url);
      expect(normalized).toBe('https://xpaste.pro/p/t4q0Lsp0/raw');
    });

    it('should not modify non-xpaste.pro URLs', () => {
      const url = 'https://example.com/page';
      const normalized = normalizeUrlForTextContent(url);
      expect(normalized).toBe(url);
    });

    it('should handle invalid URLs gracefully', () => {
      const url = 'not-a-valid-url';
      const normalized = normalizeUrlForTextContent(url);
      expect(normalized).toBe(url);
    });
  });

  describe('normalizeUrlForTextPage', () => {
    it('should convert xpaste.pro raw URLs back to visual page URLs', () => {
      expect(normalizeUrlForTextPage('https://xpaste.pro/p/t4q0Lsp0/raw')).toBe(
        'https://xpaste.pro/p/t4q0Lsp0'
      );
      expect(
        normalizeUrlForTextPage('https://xpaste.pro/ru/p/t4q0Lsp0/raw')
      ).toBe('https://xpaste.pro/ru/p/t4q0Lsp0');
    });

    it('should not modify non-xpaste.pro URLs', () => {
      const url = 'https://example.com/page';
      expect(normalizeUrlForTextPage(url)).toBe(url);
    });
  });

  describe('isTextPasteUrl', () => {
    it('should return true for xpaste.pro paste URLs', () => {
      expect(isTextPasteUrl('https://xpaste.pro/p/t4q0Lsp0')).toBe(true);
      expect(isTextPasteUrl('https://xpaste.pro/p/abc123')).toBe(true);
      expect(isTextPasteUrl('https://xpaste.pro/ru/p/t4q0Lsp0')).toBe(true);
      expect(isTextPasteUrl('https://xpaste.pro/en/p/t4q0Lsp0')).toBe(true);
    });

    it('should return false for non-xpaste.pro URLs', () => {
      expect(isTextPasteUrl('https://example.com')).toBe(false);
      expect(isTextPasteUrl('https://pastebin.com/xyz')).toBe(false);
    });

    it('should return false for xpaste.pro URLs without /p/ path', () => {
      expect(isTextPasteUrl('https://xpaste.pro')).toBe(false);
      expect(isTextPasteUrl('https://xpaste.pro/about')).toBe(false);
      expect(isTextPasteUrl('https://xpaste.pro/foo/p/t4q0Lsp0')).toBe(false);
      expect(isTextPasteUrl('https://xpaste.pro/p/t4q0Lsp0/raw/extra')).toBe(
        false
      );
    });

    it('should return false for invalid URLs', () => {
      expect(isTextPasteUrl('not-a-url')).toBe(false);
    });
  });

  describe('getTextPasteFilename', () => {
    it('should derive a canonical text filename for paste URLs', () => {
      expect(getTextPasteFilename('https://xpaste.pro/p/t4q0Lsp0')).toBe(
        'xpaste-pro-t4q0Lsp0.txt'
      );
      expect(getTextPasteFilename('https://xpaste.pro/ru/p/t4q0Lsp0/raw')).toBe(
        'xpaste-pro-t4q0Lsp0.txt'
      );
    });

    it('should return null for non-paste URLs', () => {
      expect(getTextPasteFilename('https://example.com/page')).toBeNull();
    });
  });

  describe('appendTextPasteMarkdownAttachment', () => {
    it('should embed raw text as a named fenced attachment block', () => {
      const markdown = '# Page\n\nVisible content';
      const rawText = 'first line\n```inside paste```\nlast line';
      const result = appendTextPasteMarkdownAttachment(
        markdown,
        'https://xpaste.pro/p/t4q0Lsp0',
        rawText
      );

      expect(result).toContain('## xpaste-pro-t4q0Lsp0.txt');
      expect(result).toContain(
        '````text\nfirst line\n```inside paste```\nlast line\n````'
      );
    });
  });
});
