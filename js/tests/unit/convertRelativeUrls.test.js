import { convertRelativeUrls } from '../../src/lib.js';

describe('convertRelativeUrls', () => {
  const baseUrl = 'https://example.com/';

  it('should NOT inject runtimeHook if there are no <script> tags', () => {
    const html = `<!DOCTYPE html><html><head><title>Test</title></head><body><h1>Hello</h1><p>World</p></body></html>`;
    const result = convertRelativeUrls(html, baseUrl);
    // Should not inject the runtimeHook
    expect(result).not.toMatch(/MutationObserver/);
    expect(result).not.toMatch(/fixAllUrls/);
    expect(result).not.toMatch(/runtime JS hook/);
    // Should not add any <script> tag
    expect(result.match(/<script/gi)).toBeNull();
  });

  it('should inject runtimeHook if there is a <script> tag', () => {
    const html = `<!DOCTYPE html><html><head><title>Test</title><script src="foo.js"></script></head><body><h1>Hello</h1></body></html>`;
    const result = convertRelativeUrls(html, baseUrl);
    // Should inject the runtimeHook
    expect(result).toMatch(/MutationObserver/);
    expect(result).toMatch(/fixAllUrls/);
    // Should add a <script> tag for the hook
    expect((result.match(/<script/gi) || []).length).toBeGreaterThan(1);
  });

  it('should inject runtimeHook if there is an inline <script>', () => {
    const html = `<!DOCTYPE html><html><head><title>Test</title><script>console.log('hi');</script></head><body></body></html>`;
    const result = convertRelativeUrls(html, baseUrl);
    expect(result).toMatch(/MutationObserver/);
    expect(result).toMatch(/fixAllUrls/);
    expect((result.match(/<script/gi) || []).length).toBeGreaterThan(1);
  });
});
