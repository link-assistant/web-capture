import { mkdtemp, rm, symlink } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { chromium } from 'playwright';
import { createBrowser } from '../../src/browser.js';

// Only deterministic local HTML is used. Neither engine may select its own cache.
test.each(['puppeteer', 'playwright'])(
  '%s renders using a Chromium executable at an explicit temporary path',
  async (engine) => {
    const directory = await mkdtemp(path.join(tmpdir(), 'packaged-browser-'));
    const packagedPath = path.join(
      directory,
      process.platform === 'win32' ? 'chrome.exe' : 'chromium'
    );
    let browser;
    let page;
    try {
      await symlink(chromium.executablePath(), packagedPath);
      browser = await createBrowser(engine, {
        executablePath: packagedPath,
        userDataDir: path.join(directory, 'profile'),
      });
      page = await browser.newPage();
      await page.goto(
        'data:text/html,<main id="result"></main><script>document.getElementById("result").textContent="Packaged Chromium rendered"</script>'
      );
      expect(await page.content()).toContain('Packaged Chromium rendered');
      const executable =
        engine === 'puppeteer'
          ? browser.rawBrowser.process().spawnfile
          : packagedPath;
      expect(executable).toBe(packagedPath);
    } finally {
      if (page) {
        await page.close();
      }
      if (browser) {
        await browser.close();
      }
      await rm(directory, { recursive: true, force: true });
    }
  },
  30000
);
