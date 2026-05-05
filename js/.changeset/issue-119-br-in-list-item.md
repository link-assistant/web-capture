---
'@link-assistant/web-capture': patch
---

Fix `--capture api` collapsing `<br>`-separated lines inside list items into one run. The Google Docs export-html path lost line breaks when a `<br>` was the leading or trailing child of an inline element (e.g. a `<span>` between bold runs), because Turndown trims inner content of inline elements with edge whitespace. The HTML pre-processing now hoists those edge `<br>`s out of their inline parents before Turndown sees them, restoring CommonMark hard breaks. Additionally, the post-processor's double-space collapse no longer eats the two trailing spaces that mark a hard break.
