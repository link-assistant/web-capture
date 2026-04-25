/**
 * Integration tests for the Google Docs markdown round-trip reference document.
 *
 * The document at
 *   https://docs.google.com/document/d/1f5zI2xOFpKa90v0GjamO_t7lqSdzMlaM/edit
 * is a public document created specifically for validating web-capture's Google
 * Docs support across every URL variation and every Markdown feature category
 * documented in issue #90. The ground-truth markdown and authoring archive are
 * preserved under docs/case-studies/issue-90/reference/.
 *
 * Live capture tests are gated behind GDOCS_INTEGRATION=true so normal PR CI
 * stays hermetic. The URL-variation, document-id extraction and feature
 * checklist tests always run so regressions in the parsing surface are caught
 * even without network access.
 */

import { jest } from '@jest/globals';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

import {
  isGoogleDocsUrl,
  extractDocumentId,
  buildExportUrl,
  buildEditUrl,
  buildDocsApiUrl,
  selectGoogleDocsCaptureMethod,
  fetchGoogleDocAsMarkdown,
  captureGoogleDocWithBrowser,
} from '../../src/gdocs.js';
import { retry } from '../../src/retry.js';

const LIVE =
  process.env.GDOCS_INTEGRATION === 'true' ||
  process.env.GDOCS_INTEGRATION === '1';
const describeIfLive = LIVE ? describe : describe.skip;

jest.setTimeout(120000);

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const REFERENCE_DIR = path.resolve(
  __dirname,
  '..',
  '..',
  '..',
  'docs',
  'case-studies',
  'issue-90',
  'reference'
);

// The public document referenced in issue #90.
// https://docs.google.com/document/d/1f5zI2xOFpKa90v0GjamO_t7lqSdzMlaM/edit
export const PUBLIC_TEST_DOCUMENT = {
  id: '1f5zI2xOFpKa90v0GjamO_t7lqSdzMlaM',
  canonicalUrl:
    'https://docs.google.com/document/d/1f5zI2xOFpKa90v0GjamO_t7lqSdzMlaM/edit',
  urlVariations: [
    'https://docs.google.com/document/d/1f5zI2xOFpKa90v0GjamO_t7lqSdzMlaM',
    'https://docs.google.com/document/d/1f5zI2xOFpKa90v0GjamO_t7lqSdzMlaM/edit',
    'https://docs.google.com/document/d/1f5zI2xOFpKa90v0GjamO_t7lqSdzMlaM/edit?usp=sharing',
    'https://docs.google.com/document/d/1f5zI2xOFpKa90v0GjamO_t7lqSdzMlaM/edit?usp=sharing&ouid=102030405060708090100&rtpof=true&sd=true',
    'https://docs.google.com/document/d/1f5zI2xOFpKa90v0GjamO_t7lqSdzMlaM/edit?tab=t.0',
  ],
  // Section headings from the reference markdown. Each one should be present
  // in any Markdown produced from the document, regardless of capture mode.
  // See docs/case-studies/issue-90/reference/markdown-test-document.md.
  sections: [
    'Markdown Feature Test Document',
    '1. Headings',
    '2. Inline Formatting',
    '3. Paragraphs',
    '4. Blockquotes',
    '5. Unordered Lists',
    '6. Ordered Lists',
    '7. Mixed Lists',
    '8. Tables',
    '9. Links',
    '10. Images',
    '11. Horizontal Rules',
    '12. Special Characters',
    '13. Nested Formatting Edge Cases',
    '14. Empty and Minimal Table Content',
  ],
};

describe('Google Docs public test document (issue #90)', () => {
  describe('URL variations', () => {
    it.each(PUBLIC_TEST_DOCUMENT.urlVariations)(
      'accepts %s as a Google Docs URL',
      (url) => {
        expect(isGoogleDocsUrl(url)).toBe(true);
      }
    );

    it.each(PUBLIC_TEST_DOCUMENT.urlVariations)(
      'extracts the public document ID from %s',
      (url) => {
        expect(extractDocumentId(url)).toBe(PUBLIC_TEST_DOCUMENT.id);
      }
    );

    it('builds the expected export URL for the public document', () => {
      expect(buildExportUrl(PUBLIC_TEST_DOCUMENT.id, 'html')).toBe(
        `https://docs.google.com/document/d/${PUBLIC_TEST_DOCUMENT.id}/export?format=html`
      );
    });

    it('builds the expected editor URL for the public document', () => {
      expect(buildEditUrl(PUBLIC_TEST_DOCUMENT.id)).toBe(
        `https://docs.google.com/document/d/${PUBLIC_TEST_DOCUMENT.id}/edit`
      );
    });

    it('builds the expected Docs API URL for the public document', () => {
      expect(buildDocsApiUrl(PUBLIC_TEST_DOCUMENT.id)).toBe(
        `https://docs.googleapis.com/v1/documents/${PUBLIC_TEST_DOCUMENT.id}`
      );
    });
  });

  describe('Capture method selection (issue #72 regression guard)', () => {
    it('routes --capture browser to the editor-model backend', () => {
      expect(selectGoogleDocsCaptureMethod('browser')).toBe('browser-model');
    });

    it('routes --capture api to the public-export backend when no token', () => {
      expect(selectGoogleDocsCaptureMethod('api')).toBe('public-export');
    });

    it('routes --capture api with a token to the Docs REST API backend', () => {
      expect(selectGoogleDocsCaptureMethod('api', 'token-123')).toBe(
        'docs-api'
      );
    });
  });

  describe('Reference markdown fixture', () => {
    const referenceMarkdownPath = path.join(
      REFERENCE_DIR,
      'markdown-test-document.md'
    );
    const referenceMarkdown = fs.readFileSync(referenceMarkdownPath, 'utf-8');

    it('contains every feature category documented in issue #90', () => {
      for (const section of PUBLIC_TEST_DOCUMENT.sections) {
        expect(referenceMarkdown).toContain(section);
      }
    });

    it('embeds the four test images referenced by the issue', () => {
      expect(referenceMarkdown).toMatch(
        /!\[Blue rectangle]\(media\/image1\.png\)/
      );
      expect(referenceMarkdown).toMatch(
        /!\[Red rectangle]\(media\/image2\.png\)/
      );
      expect(referenceMarkdown).toMatch(
        /!\[Green square]\(media\/image3\.png\)/
      );
      expect(referenceMarkdown).toMatch(
        /!\[Yellow square]\(media\/image4\.png\)/
      );
    });
  });

  describeIfLive('Live capture against the public document', () => {
    // The primary deliverable of issue #90: the reference document is
    // downloaded from Google Docs and every feature section can be found in
    // the captured markdown. This is our regression net for any future
    // changes to the public-export or HTML-to-markdown pipeline.
    //
    // Google Docs occasionally returns transient 500s on the public-export
    // endpoint. The Habr integration suite has the same flake and solves it
    // with retry + exponential backoff, so we reuse the shared helper here.
    const fetchWithRetry = (url) =>
      retry(() => fetchGoogleDocAsMarkdown(url), {
        retries: 3,
        baseDelay: 2000,
      });

    const captureBrowserWithRetry = (url) =>
      retry(() => captureGoogleDocWithBrowser(url), {
        retries: 2,
        baseDelay: 2000,
      });

    it('fetches the public document via --capture api and returns markdown', async () => {
      const { markdown, documentId, exportUrl } = await fetchWithRetry(
        PUBLIC_TEST_DOCUMENT.canonicalUrl
      );

      expect(documentId).toBe(PUBLIC_TEST_DOCUMENT.id);
      expect(exportUrl).toBe(buildExportUrl(PUBLIC_TEST_DOCUMENT.id, 'html'));
      expect(markdown.length).toBeGreaterThan(1000);

      for (const section of PUBLIC_TEST_DOCUMENT.sections) {
        expect(markdown).toContain(section);
      }
      expect(markdown).toContain('## 1. Headings');
      expect(markdown).toContain('**This text is bold**');
      expect(markdown).toContain('*This text is italic*');
      expect(markdown).toContain('~~This text has strikethrough~~');
      expect(markdown).toContain('> This is a single-level blockquote');
      expect(markdown).toContain('| Feature | Supported | Notes |');
      expect(markdown).not.toContain('| Feature |  | Supported |');
      expect(markdown).toContain('|  | x |  |');
      expect(markdown).toContain('1.  Parent item 1');
      expect(markdown).toContain('    1.  Child item 1.1');
      expect(markdown).toContain('        1.  Grandchild item 1.2.1');
      expect(markdown).not.toContain('-   Child item 1.1');
    });

    it.each(PUBLIC_TEST_DOCUMENT.urlVariations)(
      'resolves %s to the same document when capturing',
      async (url) => {
        const { documentId } = await fetchWithRetry(url);
        expect(documentId).toBe(PUBLIC_TEST_DOCUMENT.id);
      }
    );

    it('captures the public document via --capture browser and renders DOCS_modelChunk markdown', async () => {
      const { markdown, documentId, exportUrl, capture } =
        await captureBrowserWithRetry(PUBLIC_TEST_DOCUMENT.canonicalUrl);

      expect(documentId).toBe(PUBLIC_TEST_DOCUMENT.id);
      expect(exportUrl).toBe(buildEditUrl(PUBLIC_TEST_DOCUMENT.id));
      expect(capture.blocks.length).toBeGreaterThan(20);
      expect(capture.images.length).toBeGreaterThanOrEqual(4);
      expect(markdown.length).toBeGreaterThan(2500);
      expect(markdown).toContain('# Markdown Feature Test Document');
      expect(markdown).toContain('## 1. Headings');
      expect(markdown).toContain('**This text is bold**');
      expect(markdown).toContain('*This text is italic*');
      expect(markdown).toContain('~~This text has strikethrough~~');
      expect(markdown).toContain('> This is a single-level blockquote');
      expect(markdown).toContain('[Regular link](https://example.com)');
      expect(markdown).toContain('| Feature | Supported | Notes |');
      expect(markdown).not.toContain('| Feature |  | Supported |');
      expect(markdown).toContain('|  | x |  |');
      expect(markdown).toContain('1. Parent item 1');
      expect(markdown).toContain('    1. Child item 1.1');
      expect(markdown).toContain('        1. Grandchild item 1.2.1');
      expect(markdown).not.toContain('- Child item 1.1');
      expect(markdown).not.toContain('1. Parent item 1\n\n');
      expect(markdown).toContain('![Blue rectangle](');
      expect(markdown).toContain('![Red rectangle](');
      expect(markdown).toContain('![Green square](');
      expect(markdown).toContain('![Yellow square](');
      expect(markdown).toContain('docs-images-rt/');
      expect(markdown).toContain('---');
    });
  });
});
