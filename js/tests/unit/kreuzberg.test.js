import {
  convertWithKreuzberg,
  isKreuzbergAvailable,
  normalizeStructuredKeys,
} from '../../src/kreuzberg.js';

let available;

beforeAll(async () => {
  available = await isKreuzbergAvailable();
});

function skipIfUnavailable() {
  if (!available) {
    return 'kreuzberg native binding not installed';
  }
  return false;
}

describe('kreuzberg html-to-markdown integration', () => {
  it('reports availability correctly', async () => {
    expect(typeof available).toBe('boolean');
  });

  it('converts basic HTML to Markdown', async () => {
    const skip = skipIfUnavailable();
    if (skip) {
      return;
    }
    const result = await convertWithKreuzberg(
      '<h1>Hello World</h1><p>This is a test.</p>'
    );
    expect(result.content).toContain('# Hello World');
    expect(result.content).toContain('This is a test.');
  });

  it('returns structured result with all fields', async () => {
    const skip = skipIfUnavailable();
    if (skip) {
      return;
    }
    const result = await convertWithKreuzberg('<p>Test</p>');
    expect(result).toHaveProperty('content');
    expect(result).toHaveProperty('metadata');
    expect(result).toHaveProperty('tables');
    expect(result).toHaveProperty('images');
    expect(result).toHaveProperty('warnings');
  });

  it('extracts metadata from HTML', async () => {
    const skip = skipIfUnavailable();
    if (skip) {
      return;
    }
    const html = `<html>
      <head>
        <title>Test Page</title>
        <meta property="og:description" content="A test page">
      </head>
      <body><h1>Hello</h1></body>
    </html>`;
    const result = await convertWithKreuzberg(html);
    expect(result.metadata).toBeTruthy();
    expect(result.metadata.document.title).toBe('Test Page');
    expect(result.metadata.document.open_graph.description).toBe('A test page');
  });

  it('extracts headings from metadata', async () => {
    const skip = skipIfUnavailable();
    if (skip) {
      return;
    }
    const html = '<h1>First</h1><h2>Second</h2><h3>Third</h3>';
    const result = await convertWithKreuzberg(html);
    expect(result.metadata).toBeTruthy();
    expect(result.metadata.headers.length).toBe(3);
    expect(result.metadata.headers[0].text).toBe('First');
    expect(result.metadata.headers[0].level).toBe(1);
  });

  it('extracts links from metadata', async () => {
    const skip = skipIfUnavailable();
    if (skip) {
      return;
    }
    const html =
      '<a href="https://example.com">Example</a><a href="mailto:test@test.com">Email</a>';
    const result = await convertWithKreuzberg(html);
    expect(result.metadata).toBeTruthy();
    expect(result.metadata.links.length).toBeGreaterThanOrEqual(1);
    const externalLink = result.metadata.links.find(
      (l) => l.href === 'https://example.com'
    );
    expect(externalLink).toBeTruthy();
    expect(externalLink.text).toBe('Example');
  });

  it('converts tables to Markdown', async () => {
    const skip = skipIfUnavailable();
    if (skip) {
      return;
    }
    const html = `<table>
      <thead><tr><th>Name</th><th>Value</th></tr></thead>
      <tbody><tr><td>A</td><td>1</td></tr><tr><td>B</td><td>2</td></tr></tbody>
    </table>`;
    const result = await convertWithKreuzberg(html);
    expect(result.content).toContain('| Name | Value |');
    expect(result.content).toMatch(/\| A\s+\| 1\s+\|/);
    expect(result.content).toMatch(/\| B\s+\| 2\s+\|/);
  });

  it('converts links correctly', async () => {
    const skip = skipIfUnavailable();
    if (skip) {
      return;
    }
    const html = '<a href="https://example.com">Click here</a>';
    const result = await convertWithKreuzberg(html);
    expect(result.content).toContain('[Click here](https://example.com)');
  });

  it('resolves relative links with baseUrl', async () => {
    const skip = skipIfUnavailable();
    if (skip) {
      return;
    }
    const html = '<a href="/about">About</a>';
    const result = await convertWithKreuzberg(html, {
      baseUrl: 'https://example.com/docs/page',
    });
    expect(result.content).toContain('[About](https://example.com/about)');
  });

  it('converts bold and italic correctly', async () => {
    const skip = skipIfUnavailable();
    if (skip) {
      return;
    }
    const html = '<p>This is <strong>bold</strong> and <em>italic</em></p>';
    const result = await convertWithKreuzberg(html);
    expect(result.content).toContain('**bold**');
    expect(result.content).toContain('*italic*');
  });

  it('converts code blocks correctly', async () => {
    const skip = skipIfUnavailable();
    if (skip) {
      return;
    }
    const html = '<pre><code class="language-js">const x = 1;</code></pre>';
    const result = await convertWithKreuzberg(html);
    expect(result.content).toContain('```');
    expect(result.content).toContain('const x = 1;');
  });

  it('handles empty HTML gracefully', async () => {
    const skip = skipIfUnavailable();
    if (skip) {
      return;
    }
    const result = await convertWithKreuzberg('');
    expect(result.content).toBeDefined();
  });

  it('removes script tags from output', async () => {
    const skip = skipIfUnavailable();
    if (skip) {
      return;
    }
    const html = '<p>Content</p><script>alert("xss")</script>';
    const result = await convertWithKreuzberg(html);
    expect(result.content).toContain('Content');
    expect(result.content).not.toContain('alert');
    expect(result.content).not.toContain('script');
  });

  it('removes style tags from output', async () => {
    const skip = skipIfUnavailable();
    if (skip) {
      return;
    }
    const html = '<style>body { color: red; }</style><p>Content</p>';
    const result = await convertWithKreuzberg(html);
    expect(result.content).toContain('Content');
    expect(result.content).not.toContain('color: red');
  });

  it('handles GFM strikethrough', async () => {
    const skip = skipIfUnavailable();
    if (skip) {
      return;
    }
    const html = '<p>This is <del>deleted</del> text</p>';
    const result = await convertWithKreuzberg(html);
    expect(result.content).toContain('~~deleted~~');
  });

  it('handles lists correctly', async () => {
    const skip = skipIfUnavailable();
    if (skip) {
      return;
    }
    const html = '<ul><li>Item 1</li><li>Item 2</li><li>Item 3</li></ul>';
    const result = await convertWithKreuzberg(html);
    expect(result.content).toContain('Item 1');
    expect(result.content).toContain('Item 2');
    expect(result.content).toContain('Item 3');
  });
});

describe('kreuzberg structured key normalization (issue #137 parity)', () => {
  // Mirrors the Rust `inline_image_to_json` regression tests: after the
  // html-to-markdown 3.6 change, inline image dimensions are a structured
  // `{ width, height }` value rather than a tuple. The normalization pipeline
  // that backs `result.images` must preserve those `width`/`height` keys.
  it('preserves width/height keys on inline image dimensions', () => {
    const images = normalizeStructuredKeys([
      {
        format: 'png',
        filename: 'pixel.png',
        description: 'one pixel',
        dimensions: { width: 800, height: 600 },
        source: 'ImgDataUri',
      },
    ]);

    expect(images).toHaveLength(1);
    expect(images[0].dimensions).toEqual({ width: 800, height: 600 });
    expect(images[0].format).toBe('png');
    expect(images[0].filename).toBe('pixel.png');
  });

  it('leaves images without dimensions untouched', () => {
    const images = normalizeStructuredKeys([
      { format: 'svg', source: 'SvgElement', dimensions: null },
    ]);

    expect(images[0].dimensions).toBeNull();
  });

  it('snake_cases nested structured keys', () => {
    const normalized = normalizeStructuredKeys({
      openGraph: { siteName: 'Example' },
    });

    expect(normalized).toEqual({ open_graph: { site_name: 'Example' } });
  });
});
