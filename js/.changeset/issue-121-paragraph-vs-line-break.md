---
'@link-assistant/web-capture': patch
---

Fix `<br><br>` collapsing into two CommonMark hard breaks (`  \n  \n`) instead of a paragraph break (`\n\n`). Google Docs export-html marks paragraph boundaries with `<br><br>`, which Turndown faithfully emitted as two trailing-two-space-newline pairs. Renderers (GitHub, MkDocs, Pandoc) then joined the surrounding lines into a single `<p>` with a `<br>`, cramming captions against images with no vertical spacing, and the "blank" separator line in the markdown source actually carried trailing whitespace that polluted diffs. Two or more adjacent hard breaks now coalesce to `\n\n` after Turndown runs, restoring true paragraph breaks. Applied in both `convertHtmlToMarkdown` (used by `--capture api`) and `convertHtmlToMarkdownEnhanced`.
