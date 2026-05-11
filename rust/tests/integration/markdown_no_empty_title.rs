use web_capture::markdown::convert_html_to_markdown;

#[test]
fn img_with_empty_title_must_not_emit_empty_title_in_markdown() {
    // Google Docs' HTML export emits `<img title="" alt="" src="...">`.
    // The html2md crate renders this as `![](src "")`, and our base64
    // extractor's regex over-captures the trailing ` ""` into the data URI
    // payload, breaking decoding. Strip the empty title attribute before
    // running the converter so the rendered markdown never carries it.
    let html = r#"<p><img alt="" title="" src="data:image/png;base64,iVBORw0KGgo="></p>"#;
    let md = convert_html_to_markdown(html, None).unwrap();
    assert!(md.contains("![]("), "expected markdown image syntax: {md}");
    assert!(
        !md.contains(r#" "")"#),
        "must NOT emit a trailing empty title attribute, got: {md}"
    );
}

#[test]
fn img_with_empty_alt_must_not_emit_empty_title() {
    let html = r#"<p><img alt="" src="data:image/png;base64,iVBORw0KGgo="></p>"#;
    let md = convert_html_to_markdown(html, None).unwrap();
    assert!(md.contains("![]("), "expected markdown image syntax: {md}");
    assert!(
        !md.contains(r#" "")"#),
        "must NOT emit a trailing empty title attribute, got: {md}"
    );
}

#[test]
fn img_with_nonempty_title_keeps_title() {
    // Non-empty titles are valid markdown and must not be stripped.
    let html = r#"<p><img alt="alt text" title="caption" src="https://example.com/img.png"></p>"#;
    let md = convert_html_to_markdown(html, None).unwrap();
    assert!(
        md.contains(r#""caption""#),
        "non-empty title must be preserved, got: {md}"
    );
}
