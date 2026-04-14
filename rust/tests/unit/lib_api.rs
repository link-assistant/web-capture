use web_capture::{convert_relative_urls, convert_to_utf8, VERSION};

#[test]
fn test_version() {
    assert!(!VERSION.is_empty());
}

#[test]
fn test_convert_relative_urls_basic() {
    let html = r#"<a href="/page">Link</a>"#;
    let result = convert_relative_urls(html, "https://example.com");
    assert!(result.contains("https://example.com/page"));
}

#[test]
fn test_convert_to_utf8_already_utf8() {
    let html = r#"<html><head><meta charset="utf-8"></head><body>Test</body></html>"#;
    let result = convert_to_utf8(html);
    assert!(result.contains("utf-8"));
}
