import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { convertHtmlToMarkdownEnhanced } from '../../src/lib.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = path.join(__dirname, '../../../tests/xpaste/data');

describe('xpaste.pro fixture integration', () => {
  it('converts the captured page fixture with the same visual ordering as the screenshot', () => {
    const html = fs.readFileSync(
      path.join(DATA_DIR, 't4q0Lsp0-page.html'),
      'utf-8'
    );
    const { markdown } = convertHtmlToMarkdownEnhanced(
      html,
      'https://xpaste.pro/p/t4q0Lsp0',
      {
        extractMetadata: false,
        postProcess: false,
      }
    );

    const headingIndex = markdown.indexOf('Упакуем пароль');
    const languageIndexes = ['[Ru]', '[En]']
      .map((label) => markdown.indexOf(label))
      .filter((index) => index >= 0);
    const languageIndex = Math.min(...languageIndexes);
    const formatIndex = markdown.indexOf('Формат:');
    const firstQueryIndex = markdown.indexOf('# 1');

    expect(headingIndex).toBeGreaterThanOrEqual(0);
    expect(languageIndexes).not.toHaveLength(0);
    expect(languageIndex).toBeGreaterThanOrEqual(0);
    expect(formatIndex).toBeGreaterThanOrEqual(0);
    expect(firstQueryIndex).toBeGreaterThanOrEqual(0);
    expect(headingIndex).toBeLessThan(formatIndex);
    expect(languageIndex).toBeLessThan(formatIndex);
    expect(formatIndex).toBeLessThan(firstQueryIndex);
  });
});
