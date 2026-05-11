import { createHash } from 'crypto';
import fs from 'fs';
import path from 'path';
import os from 'os';
import {
  extractAndSaveImages,
  extractBase64ToBuffers,
  stripBase64Images,
  hasBase64Images,
} from '../../src/extract-images.js';

describe('extract-images module', () => {
  let tmpDir;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'extract-images-test-'));
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  // 1x1 red PNG pixel as base64
  const TINY_PNG =
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8/5+hHgAHggJ/PchI7wAAAABJRU5ErkJggg==';
  // 1x1 white JPEG as base64
  const TINY_JPEG =
    '/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAP///wAAAf/bAEMA/9sAQwD/2wBDAf///wAAAf/bAEMA/9sAQwD/2Q==';

  function contentHash(base64Data) {
    const buf = Buffer.from(base64Data, 'base64');
    return createHash('sha256').update(buf).digest('hex').slice(0, 8);
  }

  const PNG_HASH = contentHash(TINY_PNG);
  const JPEG_HASH = contentHash(TINY_JPEG);

  describe('extractAndSaveImages', () => {
    it('extracts a single PNG image from markdown', () => {
      const md = `# Hello\n\n![test](data:image/png;base64,${TINY_PNG})\n\nEnd.`;
      const result = extractAndSaveImages(md, tmpDir);

      expect(result.extracted).toBe(1);
      expect(result.markdown).toContain(
        `![test](images/image-${PNG_HASH}.png)`
      );
      expect(result.markdown).not.toContain('data:image');

      const imgPath = path.join(tmpDir, 'images', `image-${PNG_HASH}.png`);
      expect(fs.existsSync(imgPath)).toBe(true);
      const buf = fs.readFileSync(imgPath);
      expect(buf.length).toBeGreaterThan(0);
      // Verify PNG magic bytes
      expect(buf[0]).toBe(0x89);
      expect(buf[1]).toBe(0x50); // P
    });

    it('extracts multiple images with content-hash filenames', () => {
      const md = [
        `![a](data:image/png;base64,${TINY_PNG})`,
        `![b](data:image/jpeg;base64,${TINY_JPEG})`,
      ].join('\n');

      const result = extractAndSaveImages(md, tmpDir);
      expect(result.extracted).toBe(2);
      expect(result.markdown).toContain(`images/image-${PNG_HASH}.png`);
      expect(result.markdown).toContain(`images/image-${JPEG_HASH}.jpg`);
    });

    it('produces stable filenames for duplicate images', () => {
      const md = [
        `![a](data:image/png;base64,${TINY_PNG})`,
        `![b](data:image/png;base64,${TINY_PNG})`,
      ].join('\n');

      const result = extractAndSaveImages(md, tmpDir);
      expect(result.extracted).toBe(2);
      // Both should produce the same hash-based filename
      const matches = result.markdown.match(
        new RegExp(`image-${PNG_HASH}\\.png`, 'g')
      );
      expect(matches).toHaveLength(2);
    });

    it('handles JPEG mime type correctly', () => {
      const md = `![photo](data:image/jpeg;base64,${TINY_JPEG})`;
      const result = extractAndSaveImages(md, tmpDir);

      expect(result.extracted).toBe(1);
      expect(result.markdown).toContain(`images/image-${JPEG_HASH}.jpg`);
    });

    it('uses custom imagesDir', () => {
      const md = `![img](data:image/png;base64,${TINY_PNG})`;
      const result = extractAndSaveImages(md, tmpDir, {
        imagesDir: 'my-images',
      });

      expect(result.extracted).toBe(1);
      expect(result.markdown).toContain(`my-images/image-${PNG_HASH}.png`);
      expect(
        fs.existsSync(path.join(tmpDir, 'my-images', `image-${PNG_HASH}.png`))
      ).toBe(true);
    });

    it('returns markdown unchanged when no base64 images', () => {
      const md = '# No images\n\nJust text.';
      const result = extractAndSaveImages(md, tmpDir);

      expect(result.extracted).toBe(0);
      expect(result.markdown).toBe(md);
      expect(fs.existsSync(path.join(tmpDir, 'images'))).toBe(false);
    });

    it('preserves non-base64 image references', () => {
      const md =
        '![remote](https://example.com/img.png)\n![local](images/existing.png)';
      const result = extractAndSaveImages(md, tmpDir);

      expect(result.extracted).toBe(0);
      expect(result.markdown).toBe(md);
    });

    it('preserves alt text during extraction', () => {
      const md = `![A descriptive alt text](data:image/png;base64,${TINY_PNG})`;
      const result = extractAndSaveImages(md, tmpDir);

      expect(result.markdown).toContain(
        `![A descriptive alt text](images/image-${PNG_HASH}.png)`
      );
    });

    it('extracts a base64 image even when followed by an empty markdown title', () => {
      // Google Docs HTML exports embed `<img title="" alt="" src="...">`, and
      // the html2md pipeline can render that as `![](src "")`. The base64
      // extractor must still pull the image out cleanly so the rendered
      // markdown does not carry multi-megabyte data URIs.
      const md = `Hello.\n\n![](data:image/png;base64,${TINY_PNG} "")\n\nEnd.\n`;
      const result = extractAndSaveImages(md, tmpDir);
      expect(result.extracted).toBe(1);
      expect(result.markdown).toMatch(/images\/image-[a-f0-9]+\.png/);
      expect(result.markdown).not.toContain('data:image');
    });

    it('extracts a base64 image with a non-empty markdown title', () => {
      const md = `Hello.\n\n![alt](data:image/png;base64,${TINY_PNG} "caption")\n\nEnd.\n`;
      const result = extractAndSaveImages(md, tmpDir);
      expect(result.extracted).toBe(1);
      expect(result.markdown).toMatch(/images\/image-[a-f0-9]+\.png/);
      expect(result.markdown).not.toContain('data:image');
    });

    it('handles SVG data URIs', () => {
      const svgContent =
        '<svg xmlns="http://www.w3.org/2000/svg" width="1" height="1"><rect fill="red" width="1" height="1"/></svg>';
      const svgBase64 = Buffer.from(svgContent).toString('base64');
      const svgHash = contentHash(svgBase64);
      const md = `![icon](data:image/svg+xml;base64,${svgBase64})`;
      const result = extractAndSaveImages(md, tmpDir);

      expect(result.extracted).toBe(1);
      expect(result.markdown).toContain(`images/image-${svgHash}.svg`);

      const imgPath = path.join(tmpDir, 'images', `image-${svgHash}.svg`);
      expect(fs.existsSync(imgPath)).toBe(true);
      const content = fs.readFileSync(imgPath, 'utf-8');
      expect(content).toContain('<svg');
    });
  });

  describe('extractBase64ToBuffers', () => {
    it('extracts base64 images to in-memory buffers', () => {
      const md = `# Hello\n\n![test](data:image/png;base64,${TINY_PNG})\n\nEnd.`;
      const result = extractBase64ToBuffers(md);

      expect(result.images).toHaveLength(1);
      expect(result.images[0].filename).toMatch(/^image-[0-9a-f]{8}\.png$/);
      expect(result.images[0].buffer.length).toBeGreaterThan(0);
      expect(result.markdown).toContain(`images/${result.images[0].filename}`);
      expect(result.markdown).not.toContain('data:image');
    });

    it('uses custom imagesDir prefix', () => {
      const md = `![img](data:image/png;base64,${TINY_PNG})`;
      const result = extractBase64ToBuffers(md, 'assets');

      expect(result.markdown).toContain('assets/image-');
    });

    it('does not write files to disk', () => {
      const md = `![img](data:image/png;base64,${TINY_PNG})`;
      extractBase64ToBuffers(md);
      expect(fs.existsSync(path.join(tmpDir, 'images'))).toBe(false);
    });
  });

  describe('stripBase64Images', () => {
    it('strips base64 images and leaves alt text placeholder', () => {
      const md = `![my image](data:image/png;base64,${TINY_PNG})`;
      const result = stripBase64Images(md);

      expect(result.stripped).toBe(1);
      expect(result.markdown).toBe('*[image: my image]*');
      expect(result.markdown).not.toContain('data:image');
    });

    it('leaves a visible placeholder when stripping a base64 image with empty alt', () => {
      // Google Docs HTML exports emit `<img alt="" src="data:image/png;base64,...">`,
      // which renders as `![](data:...)`. If stripping drops the markdown image
      // entirely, every image in the doc vanishes from the output with no
      // indication that anything was lost. Leave a visible placeholder so the
      // reader can see that an image was here.
      const md = `Hi.\n\n![](data:image/png;base64,${TINY_PNG})\n\nBye.\n`;
      const result = stripBase64Images(md);

      expect(result.stripped).toBe(1);
      expect(result.markdown).not.toMatch(/data:image/);
      expect(result.markdown).toMatch(/!\[|\[image/);
    });

    it('preserves remote image URLs', () => {
      const md = '![remote](https://example.com/img.png)';
      const result = stripBase64Images(md);

      expect(result.stripped).toBe(0);
      expect(result.markdown).toBe(md);
    });

    it('strips multiple base64 images', () => {
      const md = [
        `![a](data:image/png;base64,${TINY_PNG})`,
        `![b](data:image/jpeg;base64,${TINY_JPEG})`,
        '![c](https://example.com/img.png)',
      ].join('\n');
      const result = stripBase64Images(md);

      expect(result.stripped).toBe(2);
      expect(result.markdown).toContain('*[image: a]*');
      expect(result.markdown).toContain('*[image: b]*');
      expect(result.markdown).toContain('https://example.com/img.png');
    });
  });

  describe('hasBase64Images', () => {
    it('returns true when markdown has base64 images', () => {
      expect(hasBase64Images(`![x](data:image/png;base64,${TINY_PNG})`)).toBe(
        true
      );
    });

    it('returns false when no base64 images', () => {
      expect(hasBase64Images('![x](https://example.com/img.png)')).toBe(false);
    });

    it('returns false for empty string', () => {
      expect(hasBase64Images('')).toBe(false);
    });
  });
});
