use web_capture::html::{
    convert_relative_urls, convert_to_utf8, decode_html_entities, has_javascript, is_html,
    normalize_url,
};

#[test]
fn test_convert_relative_urls_href() {
    let html = r#"<a href="/about">About</a>"#;
    let result = convert_relative_urls(html, "https://example.com");
    assert!(result.contains("https://example.com/about"));
}

#[test]
fn test_convert_relative_urls_src() {
    let html = r#"<img src="/image.png">"#;
    let result = convert_relative_urls(html, "https://example.com");
    assert!(result.contains("https://example.com/image.png"));
}

#[test]
fn test_convert_relative_urls_absolute() {
    let html = r#"<a href="https://other.com/page">Link</a>"#;
    let result = convert_relative_urls(html, "https://example.com");
    assert!(result.contains("https://other.com/page"));
}

#[test]
fn test_convert_relative_urls_data_url() {
    let html = r#"<img src="data:image/png;base64,abc123">"#;
    let result = convert_relative_urls(html, "https://example.com");
    assert!(result.contains("data:image/png;base64,abc123"));
}

#[test]
fn test_convert_to_utf8_already_utf8() {
    let html = r#"<html><head><meta charset="utf-8"></head></html>"#;
    let result = convert_to_utf8(html);
    assert!(result.contains("utf-8"));
}

#[test]
fn test_convert_to_utf8_other_charset() {
    let html = r#"<html><head><meta charset="iso-8859-1"></head></html>"#;
    let result = convert_to_utf8(html);
    assert!(result.contains("utf-8"));
}

#[test]
fn test_has_javascript_with_script() {
    let html = r"<html><script>console.log('test');</script></html>";
    assert!(has_javascript(html));
}

#[test]
fn test_has_javascript_without_script() {
    let html = r"<html><body>Hello</body></html>";
    assert!(!has_javascript(html));
}

#[test]
fn test_is_html_valid() {
    let html = r"<html><body>Hello</body></html>";
    assert!(is_html(html));
}

#[test]
fn test_is_html_invalid() {
    let html = "Just plain text";
    assert!(!is_html(html));
}

#[test]
fn test_normalize_url_already_absolute() {
    assert_eq!(
        normalize_url("https://example.com").unwrap(),
        "https://example.com"
    );
}

#[test]
fn test_normalize_url_relative() {
    assert_eq!(normalize_url("example.com").unwrap(), "https://example.com");
}

#[test]
fn test_normalize_url_empty() {
    assert!(normalize_url("").is_err());
}

#[test]
fn test_decode_html_entities_basic() {
    assert_eq!(decode_html_entities("&amp;"), "&");
    assert_eq!(decode_html_entities("&lt;div&gt;"), "<div>");
    assert_eq!(decode_html_entities("&#39;hello&#39;"), "'hello'");
    assert_eq!(decode_html_entities("&quot;test&quot;"), "\"test\"");
}

#[test]
fn test_decode_html_entities_unicode() {
    assert_eq!(decode_html_entities("&#x2014;"), "\u{2014}"); // em-dash
    assert_eq!(decode_html_entities("&mdash;"), "\u{2014}");
    assert_eq!(decode_html_entities("&nbsp;"), "\u{00A0}");
}

#[test]
fn test_decode_html_entities_no_entities() {
    assert_eq!(decode_html_entities("plain text"), "plain text");
    assert_eq!(decode_html_entities(""), "");
}
