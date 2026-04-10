import {
  normalizeText,
  normalizeCode,
  verifyMarkdownContent,
} from '../../src/verify.js';

describe('verify module', () => {
  describe('normalizeText', () => {
    it('lowercases text', () => {
      expect(normalizeText('Hello World')).toBe('hello world');
    });

    it('normalizes unicode spaces', () => {
      expect(normalizeText('hello\u00A0world')).toBe('hello world');
    });

    it('normalizes curly quotes', () => {
      expect(normalizeText('\u201Chello\u201D')).toBe('"hello"');
    });

    it('removes LaTeX delimiters', () => {
      expect(normalizeText('$x + y$')).toBe('x + y');
      expect(normalizeText('$$x + y$$')).toBe('x + y');
    });

    it('normalizes arrows', () => {
      expect(normalizeText('\u2192')).toBe('->');
      expect(normalizeText('\\to')).toBe('->');
    });

    it('removes \\displaystyle', () => {
      expect(normalizeText('\\displaystyle x')).toBe('x');
    });

    it('extracts text from \\text{}', () => {
      expect(normalizeText('\\text{hello}')).toBe('hello');
    });
  });

  describe('normalizeCode', () => {
    it('lowercases and collapses whitespace', () => {
      expect(normalizeCode('  Hello   World  ')).toBe('hello world');
    });

    it('normalizes multiplication sign', () => {
      expect(normalizeCode('2\u00D73')).toBe('2x3');
    });
  });

  describe('verifyMarkdownContent', () => {
    it('verifies title presence', () => {
      const webContent = {
        title: 'My Article',
        headings: [],
        paragraphs: [],
        codeBlocks: [],
        formulas: [],
        blockquoteFormulas: [],
        listItems: [],
        links: [],
        figures: [],
      };
      const markdown = '# My Article\n\nSome content here.';
      const result = verifyMarkdownContent(webContent, markdown);
      expect(result.missing.title).toBe(false);
      expect(result.passedChecks).toBeGreaterThan(0);
    });

    it('detects missing title', () => {
      const webContent = {
        title: 'Missing Title',
        headings: [],
        paragraphs: [],
        codeBlocks: [],
        formulas: [],
        blockquoteFormulas: [],
        listItems: [],
        links: [],
        figures: [],
      };
      const markdown = '# Different Title\n\nContent.';
      const result = verifyMarkdownContent(webContent, markdown);
      expect(result.missing.title).toBe(true);
    });

    it('verifies headings', () => {
      const webContent = {
        title: '',
        headings: [
          { level: 'h2', text: 'Introduction' },
          { level: 'h3', text: 'Background' },
        ],
        paragraphs: [],
        codeBlocks: [],
        formulas: [],
        blockquoteFormulas: [],
        listItems: [],
        links: [],
        figures: [],
      };
      const markdown = '## Introduction\n\n### Background\n\nText.';
      const result = verifyMarkdownContent(webContent, markdown);
      expect(result.missing.headings).toHaveLength(0);
    });

    it('detects missing headings', () => {
      const webContent = {
        title: '',
        headings: [{ level: 'h2', text: 'Unique Heading XYZ' }],
        paragraphs: [],
        codeBlocks: [],
        formulas: [],
        blockquoteFormulas: [],
        listItems: [],
        links: [],
        figures: [],
      };
      const markdown = '## Different Heading\n\nText.';
      const result = verifyMarkdownContent(webContent, markdown);
      expect(result.missing.headings).toContain('Unique Heading XYZ');
    });

    it('verifies code blocks with fuzzy matching', () => {
      const webContent = {
        title: '',
        headings: [],
        paragraphs: [],
        codeBlocks: [
          'function hello() {\n  console.log("hello");\n  return true;\n}',
        ],
        formulas: [],
        blockquoteFormulas: [],
        listItems: [],
        links: [],
        figures: [],
      };
      const markdown =
        '```javascript\nfunction hello() {\n  console.log("hello");\n  return true;\n}\n```';
      const result = verifyMarkdownContent(webContent, markdown);
      expect(result.missing.codeBlocks).toHaveLength(0);
    });

    it('calculates pass rate', () => {
      const webContent = {
        title: 'Test',
        headings: [{ level: 'h2', text: 'Found' }],
        paragraphs: [],
        codeBlocks: [],
        formulas: [],
        blockquoteFormulas: [],
        listItems: [],
        links: [],
        figures: [],
      };
      const markdown = '# Test\n\n## Found\n\nContent.';
      const result = verifyMarkdownContent(webContent, markdown);
      expect(result.passRate).toBe(1.0);
      expect(result.success).toBe(true);
    });

    it('checks figure images when hasLocalImages is set', () => {
      const webContent = {
        title: '',
        headings: [],
        paragraphs: [],
        codeBlocks: [],
        formulas: [],
        blockquoteFormulas: [],
        listItems: [],
        links: [],
        figures: [1, 2, 3],
      };
      const markdown =
        '![Figure 1](images/figure-1.png)\n![Figure 2](images/figure-2.png)\n![Figure 3](images/figure-3.png)';
      const result = verifyMarkdownContent(webContent, markdown, {
        hasLocalImages: true,
        expectedFigures: 3,
      });
      expect(result.missing.images).toBe(0);
    });
  });
});
