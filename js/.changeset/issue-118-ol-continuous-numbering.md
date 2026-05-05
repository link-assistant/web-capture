---
'@link-assistant/web-capture': patch
---

Number consecutive top-level `<ol>`s continuously across the document (1, 2, 3, ... N) so JS and Rust HTML→Markdown converters agree. `<ol start="N">` resets the counter and is honoured by both implementations. Nested ordered lists keep their own per-list numbering.
