// Try several plausible representations of "Shift+Enter inside a list item" from Google Docs export-html.
import { convertHtmlToMarkdown } from '../js/src/lib.js';
import {
  preprocessGoogleDocsExportHtml,
  normalizeGoogleDocsExportMarkdown,
} from '../js/src/gdocs-preprocess.js';

const cases = {
  'plain <br> with newline': `<ol><li><strong>Glossary entry.</strong>Some lead text.<br>
<strong>TAG1</strong> – Definition one.<br>
<strong>TAG2</strong> – Definition two.<br>
<strong>TAG3</strong> – Definition three.</li></ol>`,

  'plain <br> no newline (raw)': `<ol><li><strong>Glossary entry.</strong>Some lead text.<br><strong>TAG1</strong> – Definition one.<br><strong>TAG2</strong> – Definition two.<br><strong>TAG3</strong> – Definition three.</li></ol>`,

  '<br> with bold-styled spans (Gdocs hoisted)': `<ol><li><span style="font-weight:700">Glossary entry.</span>Some lead text.<br><span style="font-weight:700">TAG1</span> – Definition one.<br><span style="font-weight:700">TAG2</span> – Definition two.<br><span style="font-weight:700">TAG3</span> – Definition three.</li></ol>`,

  'br inside <p> wrapped (Gdocs <p> child of <li>)': `<ol><li><p><strong>Glossary entry.</strong>Some lead text.<br><strong>TAG1</strong> – Definition one.<br><strong>TAG2</strong> – Definition two.<br><strong>TAG3</strong> – Definition three.</p></li></ol>`,

  'span containing the br (Gdocs)': `<ol><li><span style="font-weight:700">Glossary entry.</span><span>Some lead text.<br></span><span style="font-weight:700">TAG1</span><span> – Definition one.<br></span><span style="font-weight:700">TAG2</span><span> – Definition two.<br></span><span style="font-weight:700">TAG3</span><span> – Definition three.</span></li></ol>`,
};

for (const [label, html] of Object.entries(cases)) {
  console.log(`========== ${label} ==========`);
  const pre = preprocessGoogleDocsExportHtml(html);
  const raw = convertHtmlToMarkdown(pre.html);
  const norm = normalizeGoogleDocsExportMarkdown(raw);
  console.log('--- raw markdown ---');
  console.log(JSON.stringify(raw));
  console.log('--- normalized markdown ---');
  console.log(JSON.stringify(norm));
}
