# Case Study: Issue #62 — `<img>` inside headings dropped from markdown

## Timeline

1. **Issue #58** — Original archive pipeline fixes identified multiple bugs (A, B, C).
2. **v0.3.0** — Fixed bugs A and C; bug B (heading-nested images dropped in markdown) remained.
3. **Issue #62** — Filed as the residual of bug B from #58.
4. **PR #63** — Fix implemented.

## Root Cause Analysis

### The reported bug

The `html2md` crate's heading handler (`<h1>`..<h6>`) was reported to recurse only into text/inline-text children, silently dropping `<img>` elements. This created a count mismatch:

- `extract_base64_images()` uses a regex over raw HTML — finds N images regardless of parent element
- `html2md::parse_html()` converts to markdown — drops images inside headings, producing N-1 refs

### Investigation findings

Testing with `html2md` v0.2.15 (the version resolved by `Cargo.toml`'s `html2md = "0.2"`) showed that **the bug no longer reproduces** in the current dependency version. All heading levels (h1-h6) correctly preserve `<img>` elements, including Google Docs-style HTML with nested `<span>` wrappers.

The bug was likely present in an earlier minor version of `html2md` 0.2.x and was fixed upstream. Since the `Cargo.toml` specifies `html2md = "0.2"` (allowing any 0.2.x), the fix came in automatically via a dependency update.

### Why a defensive fix is still warranted

1. **Semver-minor changes** — `html2md = "0.2"` allows any `0.2.x`. A future release could regress.
2. **No upstream guarantee** — The `html2md` crate doesn't document heading-image behavior as a guarantee.
3. **Defense in depth** — Pre-processing HTML to hoist images out of headings is a cheap, safe operation that eliminates the entire class of bugs.

## Solution

### Approach: Option A (pre-processing)

Added `hoist_images_from_headings()` in `rust/src/markdown.rs`:

- Regex-based: for each heading level (h1-h6), finds `<img>` tags inside the heading
- Moves them to `<p>` blocks after the heading
- Runs before `html2md::parse_html()`

This approach was chosen over Option B (replacing html2md) because:
- Minimal code change (44 lines)
- No new dependencies
- Preserves the existing conversion pipeline
- html2md works correctly for all other cases

### Test coverage

| Test | Location | What it verifies |
|------|----------|-----------------|
| `img_inside_heading_is_kept_in_markdown` | `rust/tests/integration/gdocs_image_parity.rs` | Issue's exact reproduction case |
| `img_inside_all_heading_levels_is_kept` | Same file | All h1-h6 levels |
| `gdocs_style_heading_with_spans_keeps_img` | Same file | Google Docs HTML with span wrappers |
| `image_count_parity_across_pipeline` | Same file | Full pipeline: extraction count == HTML count == markdown count |
| JS heading-image tests (3) | `js/tests/unit/heading-image.test.js` | Guard rail for JS/Turndown parity |

## Requirements Checklist (from issue)

- [x] Rust: `img_inside_heading_is_kept_in_markdown` test added and passes
- [x] Rust: fix via pre-processing (Option A)
- [x] JS: parallel parity test added as guard rail
- [x] Broader parity test: `image_count_parity_across_pipeline` asserts `md_ref_count == html_img_count == image_file_count`

## References

- Issue: https://github.com/link-assistant/web-capture/issues/62
- PR: https://github.com/link-assistant/web-capture/pull/63
- Related: #58 (original archive pipeline fixes), #53 (original archive pipeline)
- `html2md` crate: https://crates.io/crates/html2md (v0.2.15)
