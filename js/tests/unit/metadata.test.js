import * as cheerio from 'cheerio';
import {
  extractMetadata,
  formatMetadataBlock,
  formatFooterBlock,
} from '../../src/metadata.js';

describe('metadata module', () => {
  describe('extractMetadata', () => {
    it('extracts author information', () => {
      const $ = cheerio.load(
        '<a class="tm-user-info__username" href="/user/john">john_doe</a>'
      );
      const meta = extractMetadata($);
      expect(meta.author).toBe('john_doe');
      expect(meta.authorUrl).toBe('/user/john');
    });

    it('extracts publication date', () => {
      const $ = cheerio.load(
        '<time datetime="2024-01-15T10:00:00Z">Jan 15</time>'
      );
      const meta = extractMetadata($);
      expect(meta.publishDate).toBe('2024-01-15T10:00:00Z');
      expect(meta.publishDateText).toBe('Jan 15');
    });

    it('extracts hubs', () => {
      const $ = cheerio.load(`
        <a class="tm-publication-hub__link"><span>Math</span></a>
        <a class="tm-publication-hub__link"><span>Science</span></a>
      `);
      const meta = extractMetadata($);
      expect(meta.hubs).toEqual(['Math', 'Science']);
    });

    it('extracts tags from meta keywords', () => {
      const $ = cheerio.load(
        '<meta name="keywords" content="math, science, theory">'
      );
      const meta = extractMetadata($);
      expect(meta.tags).toEqual(['math', 'science', 'theory']);
    });

    it('extracts LD+JSON author name', () => {
      const $ = cheerio.load(
        '<script type="application/ld+json">{"author":{"name":"John Doe"},"dateModified":"2024-02-01"}</script>'
      );
      const meta = extractMetadata($);
      expect(meta.authorFullName).toBe('John Doe');
      expect(meta.dateModified).toBe('2024-02-01');
    });

    it('extracts votes and comments', () => {
      const $ = cheerio.load(`
        <span class="tm-votes-meter__value">+42</span>
        <span class="tm-article-comments-counter-link__value">15</span>
      `);
      const meta = extractMetadata($);
      expect(meta.votes).toBe('+42');
      expect(meta.comments).toBe('15');
    });

    it('returns empty object for minimal HTML', () => {
      const $ = cheerio.load('<div>plain content</div>');
      const meta = extractMetadata($);
      expect(meta).toBeDefined();
      expect(meta.author).toBeUndefined();
    });
  });

  describe('formatMetadataBlock', () => {
    it('formats author line with link', () => {
      const lines = formatMetadataBlock({
        author: 'john',
        authorUrl: '/user/john',
      });
      expect(lines).toContain('**Author:** [john](/user/john)');
    });

    it('formats author with full name', () => {
      const lines = formatMetadataBlock({
        author: 'john',
        authorFullName: 'John Doe',
        authorUrl: '/user/john',
      });
      expect(lines[0]).toContain('John Doe (john)');
    });

    it('formats publication date', () => {
      const lines = formatMetadataBlock({
        publishDate: '2024-01-15T10:00:00Z',
      });
      expect(lines.some((l) => l.includes('Published:'))).toBe(true);
      expect(lines.some((l) => l.includes('January 15, 2024'))).toBe(true);
    });

    it('includes hubs and tags', () => {
      const lines = formatMetadataBlock({
        hubs: ['Math', 'Science'],
        tags: ['theory', 'links'],
      });
      expect(lines.some((l) => l.includes('Math, Science'))).toBe(true);
      expect(lines.some((l) => l.includes('theory, links'))).toBe(true);
    });

    it('returns empty array for null metadata', () => {
      expect(formatMetadataBlock(null)).toEqual([]);
    });
  });

  describe('formatFooterBlock', () => {
    it('includes separator line', () => {
      const lines = formatFooterBlock({ author: 'test' });
      expect(lines[0]).toBe('---');
    });

    it('formats tag links', () => {
      const lines = formatFooterBlock({
        tagLinks: [{ name: 'math', url: '/tag/math' }],
      });
      expect(lines.some((l) => l.includes('[math](/tag/math)'))).toBe(true);
    });

    it('formats article stats', () => {
      const lines = formatFooterBlock({
        votes: '+10',
        views: '5000',
        comments: '3',
      });
      const statsLine = lines.find((l) => l.includes('Votes:'));
      expect(statsLine).toContain('+10');
      expect(statsLine).toContain('5000');
    });

    it('returns empty array for null metadata', () => {
      expect(formatFooterBlock(null)).toEqual([]);
    });
  });
});
