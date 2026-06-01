import * as cheerio from 'cheerio';
import {
  extractHabrFormula,
  extractKatexFormula,
  extractMathJaxFormula,
  isFormulaImage,
  isMathElement,
  extractFormula,
} from '../../src/latex.js';

describe('latex module', () => {
  describe('extractHabrFormula', () => {
    it('extracts LaTeX from Habr formula img source attribute', () => {
      const $ = cheerio.load(
        '<img class="formula" source=" L \\to L^2 " alt="formula">'
      );
      const el = $('img')[0];
      expect(extractHabrFormula($, el)).toBe('L \\to L^2');
    });

    it('falls back to alt text when source is missing', () => {
      const $ = cheerio.load('<img class="formula" alt=" x + y ">');
      const el = $('img')[0];
      expect(extractHabrFormula($, el)).toBe('x + y');
    });

    it('returns null when no source or alt', () => {
      const $ = cheerio.load('<img class="formula">');
      const el = $('img')[0];
      expect(extractHabrFormula($, el)).toBeNull();
    });
  });

  describe('extractKatexFormula', () => {
    it('extracts from annotation element', () => {
      const $ = cheerio.load(
        '<span class="katex"><annotation encoding="application/x-tex">E = mc^2</annotation></span>'
      );
      const el = $('span.katex')[0];
      expect(extractKatexFormula($, el)).toBe('E = mc^2');
    });

    it('extracts from data-tex attribute', () => {
      const $ = cheerio.load(
        '<span class="math" data-tex="\\alpha + \\beta"></span>'
      );
      const el = $('span.math')[0];
      expect(extractKatexFormula($, el)).toBe('\\alpha + \\beta');
    });

    it('returns null when no TeX source found', () => {
      const $ = cheerio.load('<span class="katex">rendered</span>');
      const el = $('span.katex')[0];
      expect(extractKatexFormula($, el)).toBeNull();
    });
  });

  describe('extractMathJaxFormula', () => {
    it('extracts from data-tex attribute', () => {
      const $ = cheerio.load(
        '<mjx-container data-tex="\\sum_{i=1}^{n}"></mjx-container>'
      );
      const el = $('mjx-container')[0];
      expect(extractMathJaxFormula($, el)).toBe('\\sum_{i=1}^{n}');
    });
  });

  describe('isFormulaImage', () => {
    it('identifies img.formula elements', () => {
      const $ = cheerio.load('<img class="formula" source="x^2">');
      expect(isFormulaImage($, $('img')[0])).toBe(true);
    });

    it('identifies img with source attribute', () => {
      const $ = cheerio.load('<img source="x^2">');
      expect(isFormulaImage($, $('img')[0])).toBe(true);
    });

    it('rejects regular images', () => {
      const $ = cheerio.load('<img src="photo.jpg" alt="photo">');
      expect(isFormulaImage($, $('img')[0])).toBe(false);
    });
  });

  describe('isMathElement', () => {
    it('identifies katex elements', () => {
      const $ = cheerio.load('<span class="katex">x</span>');
      expect(isMathElement($, $('span')[0])).toBe(true);
    });

    it('identifies math elements', () => {
      const $ = cheerio.load('<span class="math">x</span>');
      expect(isMathElement($, $('span')[0])).toBe(true);
    });

    it('identifies mjx-container', () => {
      const $ = cheerio.load('<mjx-container>x</mjx-container>');
      expect(isMathElement($, $('mjx-container')[0])).toBe(true);
    });

    it('rejects regular elements', () => {
      const $ = cheerio.load('<span class="text">x</span>');
      expect(isMathElement($, $('span')[0])).toBe(false);
    });
  });

  describe('extractFormula', () => {
    it('extracts from Habr formula image', () => {
      const $ = cheerio.load('<img class="formula" source="L \\to L^2">');
      expect(extractFormula($, $('img')[0])).toBe('L \\to L^2');
    });

    it('extracts from KaTeX element', () => {
      const $ = cheerio.load('<span class="katex" data-tex="\\alpha"></span>');
      expect(extractFormula($, $('span')[0])).toBe('\\alpha');
    });

    it('returns null for regular elements', () => {
      const $ = cheerio.load('<p>text</p>');
      expect(extractFormula($, $('p')[0])).toBeNull();
    });
  });
});
