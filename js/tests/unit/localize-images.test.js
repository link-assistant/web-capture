import {
  extractImageReferences,
  getExtensionFromUrl,
  generateLocalFilename,
} from '../../src/localize-images.js';

describe('localize-images module', () => {
  describe('extractImageReferences', () => {
    it('extracts markdown image references', () => {
      const md =
        '![alt text](https://example.com/img.png)\n![photo](https://cdn.example.com/photo.jpg)';
      const images = extractImageReferences(md);
      expect(images).toHaveLength(2);
      expect(images[0].altText).toBe('alt text');
      expect(images[0].url).toBe('https://example.com/img.png');
      expect(images[1].altText).toBe('photo');
      expect(images[1].url).toBe('https://cdn.example.com/photo.jpg');
    });

    it('ignores local image references', () => {
      const md = '![local](images/figure-1.png)';
      const images = extractImageReferences(md);
      expect(images).toHaveLength(0);
    });

    it('ignores non-image links', () => {
      const md = '[link text](https://example.com)';
      const images = extractImageReferences(md);
      expect(images).toHaveLength(0);
    });

    it('returns empty array for no images', () => {
      const images = extractImageReferences('plain text');
      expect(images).toHaveLength(0);
    });
  });

  describe('getExtensionFromUrl', () => {
    it('detects .png extension', () => {
      expect(getExtensionFromUrl('https://example.com/image.png')).toBe('.png');
    });

    it('detects .jpg extension', () => {
      expect(getExtensionFromUrl('https://example.com/photo.jpg')).toBe('.jpg');
    });

    it('detects .gif extension', () => {
      expect(getExtensionFromUrl('https://example.com/anim.gif')).toBe('.gif');
    });

    it('handles query parameters', () => {
      expect(
        getExtensionFromUrl('https://example.com/image.png?w=800&h=600')
      ).toBe('.png');
    });

    it('defaults to .png for unknown extension', () => {
      expect(getExtensionFromUrl('https://example.com/image')).toBe('.png');
    });
  });

  describe('generateLocalFilename', () => {
    it('generates zero-padded filename', () => {
      expect(generateLocalFilename('https://example.com/img.png', 0)).toBe(
        'image-01.png'
      );
      expect(generateLocalFilename('https://example.com/img.jpg', 9)).toBe(
        'image-10.jpg'
      );
    });

    it('preserves file extension from URL', () => {
      expect(generateLocalFilename('https://example.com/photo.gif', 2)).toBe(
        'image-03.gif'
      );
    });
  });
});
