import {
  postProcessMarkdown,
  applyUnicodeNormalization,
  applyLatexSpacingFixes,
  applyPercentSignFix,
  applyBoldFormattingFixes,
} from '../../src/postprocess.js';

describe('postprocess module', () => {
  describe('applyUnicodeNormalization', () => {
    it('replaces non-breaking spaces with regular spaces', () => {
      expect(applyUnicodeNormalization('hello\u00A0world')).toBe('hello world');
    });

    it('normalizes curly quotes to straight quotes', () => {
      expect(applyUnicodeNormalization('\u2018hello\u2019')).toBe("'hello'");
      expect(applyUnicodeNormalization('\u201Chello\u201D')).toBe('"hello"');
    });

    it('normalizes en-dash to hyphen', () => {
      expect(applyUnicodeNormalization('2\u20133')).toBe('2-3');
    });

    it('normalizes ellipsis', () => {
      expect(applyUnicodeNormalization('wait\u2026')).toBe('wait...');
    });
  });

  describe('applyLatexSpacingFixes', () => {
    it('adds space before formula after word character', () => {
      const result = applyLatexSpacingFixes('where$x$is');
      expect(result).toBe('where $x$ is');
    });

    it('trims whitespace inside formula delimiters', () => {
      const result = applyLatexSpacingFixes('$ x + y $');
      expect(result).toBe('$x + y$');
    });

    it('does not modify block formulas', () => {
      const result = applyLatexSpacingFixes('$$x + y$$');
      expect(result).toBe('$$x + y$$');
    });

    it('does not modify blockquote block formulas', () => {
      const result = applyLatexSpacingFixes('> $$x + y$$');
      expect(result).toBe('> $$x + y$$');
    });

    it('handles multiple formulas on one line', () => {
      const result = applyLatexSpacingFixes('$a$and$b$');
      expect(result).toBe('$a$ and $b$');
    });
  });

  describe('applyPercentSignFix', () => {
    it('fixes percent sign in inline formulas', () => {
      const result = applyPercentSignFix('$50\\%$');
      expect(result).toBe('$50\\\\%$');
    });

    it('fixes \\text{%} notation', () => {
      const result = applyPercentSignFix('$50\\text{%}$');
      expect(result).toBe('$50\\\\%$');
    });
  });

  describe('applyBoldFormattingFixes', () => {
    it('removes empty bold markers', () => {
      const result = applyBoldFormattingFixes('hello ** ** world');
      expect(result).toBe('hello  world');
    });

    it('trims content inside bold markers', () => {
      const result = applyBoldFormattingFixes('** hello **');
      expect(result).toBe('**hello**');
    });

    it('adds space between word and bold', () => {
      const result = applyBoldFormattingFixes('word**bold**next');
      expect(result).toBe('word **bold** next');
    });
  });

  describe('postProcessMarkdown', () => {
    it('applies all transformations by default', () => {
      const input = 'hello\u00A0$x$world';
      const result = postProcessMarkdown(input);
      expect(result).toContain('hello');
      expect(result).toContain('$x$');
      expect(result).not.toContain('\u00A0');
    });

    it('respects option flags', () => {
      const input = 'hello\u00A0world';
      const result = postProcessMarkdown(input, {
        normalizeUnicode: false,
      });
      expect(result).toContain('\u00A0');
    });

    it('removes stray standalone $ signs', () => {
      const input = 'line1\n$\nline2';
      const result = postProcessMarkdown(input);
      expect(result).toBe('line1\n\nline2');
    });
  });
});
