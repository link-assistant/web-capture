import { applyImageMode } from '../../src/extract-images.js';
import fs from 'fs';
import path from 'path';
import os from 'os';

const TINY_PNG =
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8/5+hHgAHggJ/PchI7wAAAABJRU5ErkJggg==';
const REMOTE = `Hi.\n\n![](https://example.invalid/foo.png)\n\nBye.\n`;
const BASE64 = `Hi.\n\n![](data:image/png;base64,${TINY_PNG})\n\nBye.\n`;

describe('image-mode contract', () => {
  let tmp;
  beforeEach(() => {
    tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'imode-'));
  });
  afterEach(() => fs.rmSync(tmp, { recursive: true, force: true }));

  it('default mode keeps remote URLs', async () => {
    const r = await applyImageMode(REMOTE, { mode: 'default' });
    expect(r.markdown).toContain('https://example.invalid/foo.png');
    expect(r.markdown).not.toMatch(/images\//);
    expect(r.markdown).not.toMatch(/data:image/);
  });

  it('--extract-images writes files', async () => {
    const r = await applyImageMode(BASE64, {
      mode: 'extract',
      dir: tmp,
      subdir: 'images',
    });
    expect(r.markdown).toMatch(/images\/image-/);
    expect(fs.readdirSync(path.join(tmp, 'images'))).toHaveLength(1);
  });

  it('--embed-images keeps base64', async () => {
    const r = await applyImageMode(BASE64, { mode: 'embed' });
    expect(r.markdown).toContain('data:image');
  });

  it('flags have observable effect on every input', async () => {
    for (const src of [REMOTE, BASE64]) {
      const a = await applyImageMode(src, { mode: 'default' });
      const b = await applyImageMode(src, { mode: 'embed' });
      const c = await applyImageMode(src, {
        mode: 'extract',
        dir: tmp,
        subdir: 'images',
      });
      expect(
        new Set([a.markdown, b.markdown, c.markdown]).size
      ).toBeGreaterThan(1);
    }
  });
});
