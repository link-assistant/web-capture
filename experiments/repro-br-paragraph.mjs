import { convertHtmlToMarkdown, convertHtmlToMarkdownEnhanced } from '../js/src/lib.js';

const HTML = `<!doctype html>
<html><body>
<p>
  <span>Caption A:</span><br>
  <img alt="" src="data:image/png;base64,iVBORw0KGgo="><br><br>
  <span>Caption B:</span><br>
  <img alt="" src="data:image/png;base64,iVBORw0KGgo=">
</p>
</body></html>`;

console.log('=== convertHtmlToMarkdown ===');
console.log(JSON.stringify(convertHtmlToMarkdown(HTML)));
console.log('--- raw ---');
console.log(convertHtmlToMarkdown(HTML));

console.log('\n=== convertHtmlToMarkdownEnhanced ===');
const { markdown } = convertHtmlToMarkdownEnhanced(HTML);
console.log(JSON.stringify(markdown));
console.log('--- raw ---');
console.log(markdown);
