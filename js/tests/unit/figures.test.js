import { extractFigures } from '../../src/figures.js';

describe('figures module', () => {
  describe('extractFigures', () => {
    it('extracts figures with captions', () => {
      const html = `
        <figure>
          <img src="https://example.com/fig1.png" alt="Graph">
          <figcaption>Figure 1. The relationship graph</figcaption>
        </figure>
      `;
      const figures = extractFigures(html, 'https://example.com');
      expect(figures).toHaveLength(1);
      expect(figures[0].figureNum).toBe(1);
      expect(figures[0].src).toBe('https://example.com/fig1.png');
      expect(figures[0].caption).toContain('Figure 1');
    });

    it('handles Russian figure captions', () => {
      const html = `
        <figure>
          <img src="https://example.com/fig.png" alt="">
          <figcaption>Рис. 5. Описание</figcaption>
        </figure>
      `;
      const figures = extractFigures(html, 'https://example.com');
      expect(figures[0].figureNum).toBe(5);
    });

    it('uses sequential numbering when no caption number', () => {
      const html = `
        <figure>
          <img src="https://example.com/a.png" alt="">
          <figcaption>Some caption without number</figcaption>
        </figure>
        <figure>
          <img src="https://example.com/b.png" alt="">
        </figure>
      `;
      const figures = extractFigures(html, 'https://example.com');
      expect(figures).toHaveLength(2);
      expect(figures[0].figureNum).toBe(1);
      expect(figures[1].figureNum).toBe(2);
    });

    it('skips SVG images', () => {
      const html = `
        <figure>
          <img src="https://example.com/icon.svg" alt="">
        </figure>
      `;
      const figures = extractFigures(html, 'https://example.com');
      expect(figures).toHaveLength(0);
    });

    it('resolves relative URLs', () => {
      const html = `
        <figure>
          <img src="/images/fig.png" alt="">
        </figure>
      `;
      const figures = extractFigures(html, 'https://example.com');
      expect(figures[0].src).toBe('https://example.com/images/fig.png');
    });

    it('returns empty array for no figures', () => {
      const figures = extractFigures(
        '<div>no figures</div>',
        'https://example.com'
      );
      expect(figures).toHaveLength(0);
    });
  });
});
