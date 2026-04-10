import { convertWithKreuzberg, isKreuzbergAvailable } from '../../src/kreuzberg.js';

describe('kreuzberg html-to-markdown integration', () => {
  it('should be available when the package is installed', async () => {
    const available = await isKreuzbergAvailable();
    expect(available).toBe(true);
  });

  it('converts basic HTML to Markdown', async () => {
    const result = await convertWithKreuzberg(
      '<h1>Hello World</h1><p>This is a test.</p>'
    );
    expect(result.content).toContain('# Hello World');
    expect(result.content).toContain('This is a test.');
  });

  it('returns structured result with all fields', async () => {
    const result = await convertWithKreuzberg('<p>Test</p>');
    expect(result).toHaveProperty('content');
    expect(result).toHaveProperty('metadata');
    expect(result).toHaveProperty('tables');
    expect(result).toHaveProperty('images');
    expect(result).toHaveProperty('warnings');
  });

  it('extracts metadata from HTML', async () => {
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
    const html = '<h1>First</h1><h2>Second</h2><h3>Third</h3>';
    const result = await convertWithKreuzberg(html);
    expect(result.metadata).toBeTruthy();
    expect(result.metadata.headers.length).toBe(3);
    expect(result.metadata.headers[0].text).toBe('First');
    expect(result.metadata.headers[0].level).toBe(1);
  });

  it('extracts links from metadata', async () => {
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
    const html = `<table>
      <thead><tr><th>Name</th><th>Value</th></tr></thead>
      <tbody><tr><td>A</td><td>1</td></tr><tr><td>B</td><td>2</td></tr></tbody>
    </table>`;
    const result = await convertWithKreuzberg(html);
    expect(result.content).toContain('| Name | Value |');
    expect(result.content).toContain('| A | 1 |');
    expect(result.content).toContain('| B | 2 |');
  });

  it('converts links correctly', async () => {
    const html = '<a href="https://example.com">Click here</a>';
    const result = await convertWithKreuzberg(html);
    expect(result.content).toContain('[Click here](https://example.com)');
  });

  it('converts bold and italic correctly', async () => {
    const html = '<p>This is <strong>bold</strong> and <em>italic</em></p>';
    const result = await convertWithKreuzberg(html);
    expect(result.content).toContain('**bold**');
    expect(result.content).toContain('*italic*');
  });

  it('converts code blocks correctly', async () => {
    const html = '<pre><code class="language-js">const x = 1;</code></pre>';
    const result = await convertWithKreuzberg(html);
    expect(result.content).toContain('```');
    expect(result.content).toContain('const x = 1;');
  });

  it('handles empty HTML gracefully', async () => {
    const result = await convertWithKreuzberg('');
    expect(result.content).toBeDefined();
  });

  it('removes script tags from output', async () => {
    const html = '<p>Content</p><script>alert("xss")</script>';
    const result = await convertWithKreuzberg(html);
    expect(result.content).toContain('Content');
    expect(result.content).not.toContain('alert');
    expect(result.content).not.toContain('script');
  });

  it('removes style tags from output', async () => {
    const html = '<style>body { color: red; }</style><p>Content</p>';
    const result = await convertWithKreuzberg(html);
    expect(result.content).toContain('Content');
    expect(result.content).not.toContain('color: red');
  });

  it('handles GFM strikethrough', async () => {
    const html = '<p>This is <del>deleted</del> text</p>';
    const result = await convertWithKreuzberg(html);
    expect(result.content).toContain('~~deleted~~');
  });

  it('handles lists correctly', async () => {
    const html = '<ul><li>Item 1</li><li>Item 2</li><li>Item 3</li></ul>';
    const result = await convertWithKreuzberg(html);
    expect(result.content).toContain('Item 1');
    expect(result.content).toContain('Item 2');
    expect(result.content).toContain('Item 3');
  });
});
