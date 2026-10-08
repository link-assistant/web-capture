import { expect } from '@jest/globals';

// PNG magic number (89 50 4E 47 0D 0A 1A 0A).
const PNG_SIGNATURE = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);

export function expectPngScreenshot(screenshot, minimumLength = 1000) {
  expect(screenshot).toBeInstanceOf(Uint8Array);
  expect(screenshot.length).toBeGreaterThan(minimumLength);
  expect(Buffer.from(screenshot).subarray(0, 8)).toEqual(PNG_SIGNATURE);
}
