import { convertHtmlToMarkdown } from './src/lib.js';
const HTML = `<!doctype html>
<html><body>
<ol>
  <li><h4><strong>13. Top-level numbered heading in source</strong></h4></li>
</ol>

<h5><strong>13.1 First subsection heading</strong></h5>
<p>Where it activates: ...</p>

<h5><strong>13.2 Second subsection heading</strong></h5>
<p>Where it activates: ...</p>

<h5><strong>13.3 Third subsection heading</strong></h5>
<p>Where it activates: ...</p>
</body></html>`;
console.log("---");
console.log(convertHtmlToMarkdown(HTML));
console.log("---");
