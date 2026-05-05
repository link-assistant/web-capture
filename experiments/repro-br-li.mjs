import { convertHtmlToMarkdown, convertHtmlToMarkdownEnhanced } from '../js/src/lib.js';

const HTML = `<ol>
  <li><strong>Glossary entry.</strong>Some lead text.<br>
    <strong>TAG1</strong> – Definition one.<br>
    <strong>TAG2</strong> – Definition two.<br>
    <strong>TAG3</strong> – Definition three.
  </li>
</ol>`;

console.log('=== convertHtmlToMarkdown ===');
console.log(JSON.stringify(convertHtmlToMarkdown(HTML)));
console.log('--- raw ---');
console.log(convertHtmlToMarkdown(HTML));

console.log('\n=== convertHtmlToMarkdownEnhanced ===');
const { markdown } = convertHtmlToMarkdownEnhanced(HTML);
console.log(JSON.stringify(markdown));
console.log('--- raw ---');
console.log(markdown);
