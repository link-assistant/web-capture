---
'@link-assistant/web-capture': patch
---

Fix structurally broken bold markup in `--capture api` output. Adjacent `<span style="font-weight:700">` siblings that the Google Docs export emits for headings, list items, and notes used to be wrapped in independent `<strong>...</strong>` pairs, producing split runs (`**13.1** **First subsection**`), stray `****` between adjacent bold blocks, and bold ranges that leaked across `<br>`/`<img>` boundaries (`**Caption A:![](images/x.png)Caption B:**`). The Google Docs preprocessor now closes `<strong>` runs at `<br>`/`<img>` boundaries, splits the wrapping `<p>` into separate paragraphs at those boundaries, drops empty `<strong></strong>` pairs, and coalesces adjacent bold siblings into a single run. Renderers can now interpret the output as valid CommonMark again.
