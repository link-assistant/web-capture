import {
  normalizeGoogleDocsExportMarkdown,
  preprocessGoogleDocsExportHtml,
} from '../../src/gdocs.js';
import { convertHtmlToMarkdown } from '../../src/lib.js';

describe('preprocessGoogleDocsExportHtml', () => {
  it('keeps multi-paragraph table cells on one GFM row (issue #110)', () => {
    const html = `
      <table>
        <tr><td><p>Feature</p></td><td><p>Notes</p></td></tr>
        <tr>
          <td>
            <p>First paragraph.</p>
            <p>Second paragraph.</p>
            <p>Third paragraph.</p>
          </td>
          <td><p>x</p></td>
        </tr>
      </table>
    `;

    const preprocessed = preprocessGoogleDocsExportHtml(html);
    const markdown = normalizeGoogleDocsExportMarkdown(
      convertHtmlToMarkdown(preprocessed.html)
    );

    expect(preprocessed.html).toContain(
      '<td>First paragraph.<br><br>Second paragraph.<br><br>Third paragraph.</td>'
    );
    expect(markdown).toContain(
      '| First paragraph.<br><br>Second paragraph.<br><br>Third paragraph. | x |'
    );
    expect(markdown).not.toContain('First paragraph.  \n');
  });
});
