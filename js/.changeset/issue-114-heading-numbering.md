---
'@link-assistant/web-capture': patch
---

Preserve hierarchical heading numbering (e.g. 13, 13.1) in API-path Markdown conversion. Numbered headings wrapped in `<ol><li><hN>` no longer get renumbered to 1, and sub-numbered headings render with their original number on a clean line.
