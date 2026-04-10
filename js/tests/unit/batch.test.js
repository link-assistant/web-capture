import {
  getArticle,
  getAllVersions,
  getAllArticles,
  createConfigFromUrls,
  validateConfig,
} from '../../src/batch.js';

describe('batch module', () => {
  const sampleConfig = {
    articles: {
      '0.0.0': {
        url: 'https://example.com/article-1',
        title: 'First Article',
        language: 'en',
      },
      '0.0.1': {
        url: 'https://example.com/article-2',
        title: 'Second Article',
        language: 'ru',
      },
    },
    defaults: {
      archivePath: 'archive',
      markdownFile: 'article.md',
      imagesDir: 'images',
      hasLocalImages: true,
    },
  };

  describe('getArticle', () => {
    it('returns article config by version', () => {
      const article = getArticle(sampleConfig, '0.0.0');
      expect(article.url).toBe('https://example.com/article-1');
      expect(article.title).toBe('First Article');
    });

    it('merges defaults into article config', () => {
      const article = getArticle(sampleConfig, '0.0.0');
      expect(article.markdownFile).toBe('article.md');
      expect(article.hasLocalImages).toBe(true);
    });

    it('throws for unknown version', () => {
      expect(() => getArticle(sampleConfig, '9.9.9')).toThrow(
        /Unknown article version/
      );
    });
  });

  describe('getAllVersions', () => {
    it('returns all version keys', () => {
      const versions = getAllVersions(sampleConfig);
      expect(versions).toEqual(['0.0.0', '0.0.1']);
    });
  });

  describe('getAllArticles', () => {
    it('returns all articles with defaults merged', () => {
      const articles = getAllArticles(sampleConfig);
      expect(articles).toHaveLength(2);
      expect(articles[0].markdownFile).toBe('article.md');
      expect(articles[1].language).toBe('ru');
    });
  });

  describe('createConfigFromUrls', () => {
    it('creates config from URL list', () => {
      const config = createConfigFromUrls([
        'https://example.com/a',
        'https://example.com/b',
      ]);
      expect(Object.keys(config.articles)).toHaveLength(2);
      expect(config.articles['1'].url).toBe('https://example.com/a');
      expect(config.articles['2'].url).toBe('https://example.com/b');
    });

    it('sets default archive paths', () => {
      const config = createConfigFromUrls(['https://habr.com/article/123']);
      expect(config.articles['1'].archivePath).toContain('habr-com');
      expect(config.articles['1'].markdownFile).toBe('article.md');
    });
  });

  describe('validateConfig', () => {
    it('validates correct config', () => {
      const result = validateConfig(sampleConfig);
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('rejects config without articles', () => {
      const result = validateConfig({});
      expect(result.valid).toBe(false);
      expect(result.errors[0]).toContain('articles');
    });

    it('rejects article without url', () => {
      const result = validateConfig({
        articles: { 1: { title: 'No URL' } },
      });
      expect(result.valid).toBe(false);
      expect(result.errors[0]).toContain('missing required "url"');
    });

    it('rejects article with invalid url', () => {
      const result = validateConfig({
        articles: { 1: { url: 'not-a-url' } },
      });
      expect(result.valid).toBe(false);
      expect(result.errors[0]).toContain('invalid URL');
    });
  });
});
