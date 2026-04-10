import { compareFrames } from '../../src/animation.js';

describe('animation module', () => {
  describe('compareFrames', () => {
    it('returns 1.0 for identical frames', () => {
      const frame = Buffer.from([1, 2, 3, 4, 5]);
      expect(compareFrames(frame, frame)).toBe(1.0);
    });

    it('returns 0 for completely different frames', () => {
      const frame1 = Buffer.from([0, 0, 0, 0]);
      const frame2 = Buffer.from([255, 255, 255, 255]);
      expect(compareFrames(frame1, frame2)).toBe(0);
    });

    it('returns 0 for different sized frames', () => {
      const frame1 = Buffer.from([1, 2, 3]);
      const frame2 = Buffer.from([1, 2]);
      expect(compareFrames(frame1, frame2)).toBe(0);
    });

    it('returns 0 for null frames', () => {
      expect(compareFrames(null, Buffer.from([1]))).toBe(0);
      expect(compareFrames(Buffer.from([1]), null)).toBe(0);
    });

    it('calculates partial similarity', () => {
      const frame1 = Buffer.from([1, 2, 3, 4]);
      const frame2 = Buffer.from([1, 2, 0, 0]);
      expect(compareFrames(frame1, frame2)).toBe(0.5);
    });
  });
});
