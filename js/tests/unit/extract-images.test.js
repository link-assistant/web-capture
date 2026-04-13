import fs from 'fs';
import path from 'path';
import os from 'os';
import {
  extractAndSaveImages,
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

  describe('extractAndSaveImages', () => {
    it('extracts a single PNG image from markdown', () => {
      const md = `# Hello\n\n![test](data:image/png;base64,${TINY_PNG})\n\nEnd.`;
      const result = extractAndSaveImages(md, tmpDir);

      expect(result.extracted).toBe(1);
      expect(result.markdown).toContain('![test](images/image-001.png)');
      expect(result.markdown).not.toContain('data:image');

      const imgPath = path.join(tmpDir, 'images', 'image-001.png');
      expect(fs.existsSync(imgPath)).toBe(true);
      const buf = fs.readFileSync(imgPath);
      expect(buf.length).toBeGreaterThan(0);
      // Verify PNG magic bytes
      expect(buf[0]).toBe(0x89);
      expect(buf[1]).toBe(0x50); // P
    });

    it('extracts multiple images with sequential numbering', () => {
      const md = [
        `![a](data:image/png;base64,${TINY_PNG})`,
        `![b](data:image/png;base64,${TINY_PNG})`,
      ].join('\n');

      const result = extractAndSaveImages(md, tmpDir);
      expect(result.extracted).toBe(2);
      expect(result.markdown).toContain('images/image-001.png');
      expect(result.markdown).toContain('images/image-002.png');
    });

    it('handles JPEG mime type correctly', () => {
      const md = `![photo](data:image/jpeg;base64,${TINY_JPEG})`;
      const result = extractAndSaveImages(md, tmpDir);

      expect(result.extracted).toBe(1);
      expect(result.markdown).toContain('images/image-001.jpg');
    });

    it('uses custom imagesDir', () => {
      const md = `![img](data:image/png;base64,${TINY_PNG})`;
      const result = extractAndSaveImages(md, tmpDir, {
        imagesDir: 'my-images',
      });

      expect(result.extracted).toBe(1);
      expect(result.markdown).toContain('my-images/image-001.png');
      expect(
        fs.existsSync(path.join(tmpDir, 'my-images', 'image-001.png'))
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
        '![A descriptive alt text](images/image-001.png)'
      );
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
