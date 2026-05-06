use regex::Regex;
use web_capture::gdocs::{
    normalize_google_docs_export_markdown, preprocess_google_docs_export_html,
};
use web_capture::markdown::convert_html_to_markdown;

const HTML: &str = include_str!("../fixtures/bold-coalesce-and-leakage.html");

fn render() -> String {
    let preprocessed = preprocess_google_docs_export_html(HTML);
    let converted =
        convert_html_to_markdown(&preprocessed.html, None).expect("html->md conversion succeeds");
    normalize_google_docs_export_markdown(&converted)
}

#[test]
fn coalesces_adjacent_bold_spans() {
    let md = render();
    assert!(
        md.contains("**13.1 First subsection**"),
        "expected single bold run; got:\n{md}"
    );
    assert!(
        !Regex::new(r"\*\*13\.1\*\*\s+\*\*First subsection\*\*")
            .unwrap()
            .is_match(&md),
        "must NOT split into two bold runs; got:\n{md}"
    );
}

#[test]
fn never_emits_quad_asterisk() {
    let md = render();
    assert!(
        !md.contains("****"),
        "must not emit '****' (empty bold pair); got:\n{md}"
    );
}

#[test]
fn closes_bold_at_block_boundaries() {
    let md = render();
    // No single bold run may contain an image. CommonMark bold cannot span
    // a blank line (`\n\n`), so the inner content is restricted accordingly.
    // `regex` lacks lookahead, so check structurally: a candidate `**...**`
    // run violates the rule iff the inner span contains an image and no
    // intervening blank line.
    let strong_re = Regex::new(r"\*\*((?:[^*]|\*(?:[^*]|$))*?)\*\*").unwrap();
    let image_re = Regex::new(r"!\[[^\]]*\]\([^)]+\)").unwrap();
    for caps in strong_re.captures_iter(&md) {
        let inner = caps.get(1).map_or("", |m| m.as_str());
        assert!(
            !image_re.is_match(inner) || inner.contains("\n\n"),
            "no bold run may contain an image; got:\n{md}"
        );
    }
    assert!(
        md.contains("**Caption A:**"),
        "Caption A must remain bold; got:\n{md}"
    );
    assert!(
        md.contains("**Caption B:**"),
        "Caption B must remain bold; got:\n{md}"
    );
}

#[test]
fn balanced_double_asterisks() {
    let md = render();
    let stripped = Regex::new(r"`[^`]*`|!\[[^\]]*\]\([^)]*\)")
        .unwrap()
        .replace_all(&md, "");
    let count = stripped.matches("**").count();
    assert_eq!(
        count % 2,
        0,
        "expected even count of `**`; got {count} in:\n{md}"
    );
}
