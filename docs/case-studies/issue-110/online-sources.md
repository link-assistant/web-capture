# Online Sources

These sources were checked while analyzing issue #110.

- GitHub Flavored Markdown tables extension: documents that table cells contain inline content, block-level elements cannot be inserted in a table, and a table is broken by an empty line or another block-level structure.
  https://github.github.io/gfm/#tables-extension-
- Turndown project documentation: confirms this repository's HTML-to-Markdown conversion layer is rule-based and extensible, which allowed a narrow table-cell `<br>` rule instead of forking table conversion.
  https://github.com/mixmark-io/turndown
- Turndown GFM plugin source: confirms table cell content is passed through Turndown before GFM table row assembly, so the default `<br>` hard-break rule can introduce physical newlines inside a Markdown table cell.
  https://github.com/mixmark-io/turndown-plugin-gfm
