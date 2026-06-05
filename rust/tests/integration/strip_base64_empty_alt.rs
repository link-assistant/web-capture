//! Regression test for #117 — `--keep-original-links` on Google Docs API
//! exports stripped every image entirely because the HTML export emits
//! `<img alt="" src="data:image/png;base64,...">`, the markdown converter
//! rendered that as `![](data:...)`, and the strip helper only emitted a
//! placeholder when `alt` was non-empty. The result was a silently
//! image-less document with no indication that anything was lost.

use web_capture::extract_images::strip_base64_images;

// 1x1 red PNG pixel as base64.
const TINY_PNG: &str = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8/5+hHgAHggJ/PchI7wAAAABJRU5ErkJggg==";

#[test]
fn strip_keeps_a_visible_placeholder_for_empty_alt() {
    let md = format!("P1.\n\n![](data:image/png;base64,{TINY_PNG})\n\nP2.\n");
    let r = strip_base64_images(&md);
    assert_eq!(r.stripped, 1);
    assert!(!r.markdown.contains("data:image"));
    assert!(
        r.markdown.contains("![") || r.markdown.contains("[image"),
        "stripping must leave a visible placeholder; got:\n{}",
        r.markdown
    );
}

#[test]
fn strip_keeps_empty_alt_placeholder_distinct_from_non_empty_alt() {
    // Non-empty alt still produces the `*[image: ...]*` form so authors can
    // read the alt text. Empty alt produces a structural placeholder so a
    // human can still tell that an image was here.
    let md = format!(
        "![](data:image/png;base64,{TINY_PNG})\n\n![photo](data:image/png;base64,{TINY_PNG})\n"
    );
    let r = strip_base64_images(&md);
    assert_eq!(r.stripped, 2);
    assert!(!r.markdown.contains("data:image"));
    assert!(r.markdown.contains("*[image: photo]*"));
    // Empty-alt branch leaves an `![](...)` style placeholder, so the line
    // count (and image count, when grepping for `![`) is preserved.
    let placeholder_count = r.markdown.matches("![").count();
    assert!(
        placeholder_count >= 1,
        "expected at least one `![` placeholder for the empty-alt image; got:\n{}",
        r.markdown
    );
}
