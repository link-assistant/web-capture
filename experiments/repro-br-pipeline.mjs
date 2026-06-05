import { convertHtmlToMarkdown } from '../js/src/lib.js';
import {
  preprocessGoogleDocsExportHtml,
  normalizeGoogleDocsExportMarkdown,
} from '../js/src/gdocs-preprocess.js';

const HTML = `<ol>
  <li><strong>Glossary entry.</strong>Some lead text.<br>
    <strong>TAG1</strong> – Definition one.<br>
    <strong>TAG2</strong> – Definition two.<br>
    <strong>TAG3</strong> – Definition three.
  </li>
</ol>`;

const pre = preprocessGoogleDocsExportHtml(HTML);
console.log('=== preprocess.html ===');
console.log(pre.html);
const raw = convertHtmlToMarkdown(pre.html);
console.log('=== raw markdown ===');
console.log(JSON.stringify(raw));
console.log(raw);
const norm = normalizeGoogleDocsExportMarkdown(raw);
console.log('=== normalized ===');
console.log(JSON.stringify(norm));
console.log(norm);
