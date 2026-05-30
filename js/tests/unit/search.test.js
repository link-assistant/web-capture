/**
 * Unit tests for the structured search-provider capture module (issue #130).
 *
 * Parsers are pure functions tested against fixtures; the orchestrating
 * `search()` is exercised with an injected fetch so no network is required.
 */

import {
  search,
  parseSearchResults,
  buildSearchUrl,
  looksLikeCaptcha,
  formatSearchAsMarkdown,
  SEARCH_PROVIDERS,
  DEFAULT_PROVIDER,
} from '../../src/search.js';

const WIKI_JSON = JSON.stringify({
  pages: [
    {
      id: 1,
      key: 'Formal_methods',
      title: 'Formal methods',
      excerpt: 'the <span class="searchmatch">study</span> of <b>formal</b>',
      description: 'mathematically rigorous techniques',
    },
    {
      id: 2,
      key: 'Formal_system',
      title: 'Formal system',
      excerpt: 'an abstract structure',
      description: '',
    },
  ],
});

const DDG_HTML = `
<div class="result__body">
  <a class="result__a" href="//duckduckgo.com/l/?uddg=https%3A%2F%2Fexample.com%2Fa&amp;rut=abc">First &amp; Best</a>
  <div class="result__snippet">Snippet about the <b>first</b> result</div>
</div>
<div class="result__body">
  <a class="result__a" href="//duckduckgo.com/l/?uddg=https%3A%2F%2Fexample.org%2Fb">Second result</a>
  <div class="result__snippet">Snippet two</div>
</div>
`;

const BING_HTML = `
<ol id="b_results">
  <li class="b_algo">
    <h2><a href="https://bing-result.example/1">Bing One</a></h2>
    <div class="b_caption"><p>Bing snippet one</p></div>
  </li>
</ol>
`;

describe('search module (#130)', () => {
  describe('buildSearchUrl', () => {
    it('builds the Wikipedia REST API url with limit', () => {
      expect(buildSearchUrl('wikipedia', 'formal ai', 5)).toBe(
        'https://en.wikipedia.org/w/rest.php/v1/search/page?q=formal%20ai&limit=5'
      );
    });

    it('builds the DuckDuckGo HTML url', () => {
      expect(buildSearchUrl('duckduckgo', 'a b')).toContain(
        'https://html.duckduckgo.com/html/?q=a%20b'
      );
    });

    it('throws for an unknown provider', () => {
      expect(() => buildSearchUrl('yahoo', 'x')).toThrow(
        /Unknown search provider/
      );
    });
  });

  describe('parseSearchResults', () => {
    it('normalizes Wikipedia REST JSON and strips markup', () => {
      const { results } = parseSearchResults('wikipedia', WIKI_JSON, {
        limit: 10,
      });
      expect(results).toHaveLength(2);
      expect(results[0]).toEqual({
        rank: 1,
        title: 'Formal methods',
        url: 'https://en.wikipedia.org/wiki/Formal_methods',
        snippet: 'the study of formal',
      });
      expect(results[1].url).toBe(
        'https://en.wikipedia.org/wiki/Formal_system'
      );
    });

    it('respects the limit', () => {
      const { results } = parseSearchResults('wikipedia', WIKI_JSON, {
        limit: 1,
      });
      expect(results).toHaveLength(1);
    });

    it('decodes DuckDuckGo redirect hrefs and entities', () => {
      const { results } = parseSearchResults('duckduckgo', DDG_HTML, {
        limit: 10,
      });
      expect(results).toHaveLength(2);
      expect(results[0]).toEqual({
        rank: 1,
        title: 'First & Best',
        url: 'https://example.com/a',
        snippet: 'Snippet about the first result',
      });
      expect(results[1].url).toBe('https://example.org/b');
    });

    it('parses Bing algorithmic results', () => {
      const { results } = parseSearchResults('bing', BING_HTML, { limit: 10 });
      expect(results).toEqual([
        {
          rank: 1,
          title: 'Bing One',
          url: 'https://bing-result.example/1',
          snippet: 'Bing snippet one',
        },
      ]);
    });

    it('returns empty results for malformed JSON', () => {
      const { results } = parseSearchResults('wikipedia', 'not json', {
        limit: 10,
      });
      expect(results).toEqual([]);
    });

    it('flags CAPTCHA pages', () => {
      const { blockedByCaptcha } = parseSearchResults(
        'google',
        '<html>Our systems have detected unusual traffic</html>',
        { limit: 10 }
      );
      expect(blockedByCaptcha).toBe(true);
    });
  });

  describe('looksLikeCaptcha', () => {
    it('detects common bot-block phrases', () => {
      expect(looksLikeCaptcha('Please solve the CAPTCHA')).toBe(true);
      expect(looksLikeCaptcha('normal results page')).toBe(false);
      expect(looksLikeCaptcha('')).toBe(false);
    });
  });

  describe('search()', () => {
    const fixedNow = () => '2026-05-30T00:00:00.000Z';

    it('returns the normalized contract for a provider', async () => {
      const fetchImpl = async (url) => {
        expect(url).toContain('en.wikipedia.org');
        return { status: 200, text: async () => WIKI_JSON };
      };
      const result = await search({
        query: 'formal-ai',
        provider: 'wikipedia',
        limit: 2,
        fetchImpl,
        now: fixedNow,
      });
      expect(result).toMatchObject({
        query: 'formal-ai',
        provider: 'wikipedia',
        captureMode: 'fetch',
        capturedAt: '2026-05-30T00:00:00.000Z',
      });
      expect(result.results).toHaveLength(2);
      expect(result.diagnostics).toEqual({
        status: 200,
        blockedByCors: false,
        blockedByCaptcha: false,
        sourceUrl:
          'https://en.wikipedia.org/w/rest.php/v1/search/page?q=formal-ai&limit=2',
      });
    });

    it('defaults to the Wikipedia provider', async () => {
      const fetchImpl = async () => ({
        status: 200,
        text: async () => WIKI_JSON,
      });
      const result = await search({ query: 'x', fetchImpl, now: fixedNow });
      expect(result.provider).toBe(DEFAULT_PROVIDER);
      expect(DEFAULT_PROVIDER).toBe('wikipedia');
    });

    it('records transport failures in diagnostics without throwing', async () => {
      const fetchImpl = async () => {
        throw new Error('network down');
      };
      const result = await search({
        query: 'x',
        provider: 'google',
        fetchImpl,
        now: fixedNow,
      });
      expect(result.results).toEqual([]);
      expect(result.diagnostics.error).toBe('network down');
    });

    it('rejects an empty query', async () => {
      await expect(search({ query: '   ' })).rejects.toThrow(/Missing .query/);
    });

    it('rejects an unknown provider', async () => {
      await expect(search({ query: 'x', provider: 'yahoo' })).rejects.toThrow(
        /Unknown search provider/
      );
    });
  });

  describe('formatSearchAsMarkdown', () => {
    it('renders a markdown document with ranked links', () => {
      const md = formatSearchAsMarkdown({
        query: 'formal-ai',
        provider: 'wikipedia',
        captureMode: 'fetch',
        capturedAt: '2026-05-30T00:00:00.000Z',
        results: [
          {
            rank: 1,
            title: 'Formal methods',
            url: 'https://en.wikipedia.org/wiki/Formal_methods',
            snippet: 'study of formal',
          },
        ],
        diagnostics: {
          sourceUrl: 'https://example.com',
          blockedByCaptcha: false,
        },
      });
      expect(md).toContain('# Search results for "formal-ai"');
      expect(md).toContain(
        '1. [Formal methods](https://en.wikipedia.org/wiki/Formal_methods)'
      );
      expect(md).toContain('study of formal');
    });

    it('reports no results', () => {
      const md = formatSearchAsMarkdown({
        query: 'nothing',
        provider: 'bing',
        captureMode: 'fetch',
        capturedAt: 't',
        results: [],
        diagnostics: { sourceUrl: 'u', blockedByCaptcha: false },
      });
      expect(md).toContain('_No results._');
    });
  });

  it('exposes the documented provider list', () => {
    expect(SEARCH_PROVIDERS).toEqual([
      'wikipedia',
      'duckduckgo',
      'google',
      'bing',
      'brave',
    ]);
  });
});
