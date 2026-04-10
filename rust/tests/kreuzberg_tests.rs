use web_capture::kreuzberg::convert_with_kreuzberg;

#[test]
fn test_convert_basic_html() {
    let html = r"<html><body><h1>Hello World</h1><p>This is a test.</p></body></html>";
    let result = convert_with_kreuzberg(html, None).unwrap();
    assert!(result.content.contains("Hello World"));
    assert!(result.content.contains("This is a test."));
}

#[test]
fn test_convert_with_metadata() {
    let html = r#"<html><head><title>My Page</title><meta property="og:description" content="A test page"></head><body><h1>Test</h1></body></html>"#;
    let result = convert_with_kreuzberg(html, None).unwrap();
    assert!(result.content.contains("Test"));
    assert!(result.metadata.is_some());
}

#[test]
fn test_convert_with_table() {
    let html = r"<table><thead><tr><th>Name</th><th>Value</th></tr></thead><tbody><tr><td>A</td><td>1</td></tr></tbody></table>";
    let result = convert_with_kreuzberg(html, None).unwrap();
    assert!(result.content.contains("Name"));
    assert!(result.content.contains("Value"));
}

#[test]
fn test_convert_with_link() {
    let html = r#"<a href="https://example.com">Example</a>"#;
    let result = convert_with_kreuzberg(html, None).unwrap();
    assert!(result.content.contains("[Example](https://example.com)"));
}

#[test]
fn test_convert_with_relative_url() {
    let html = r#"<a href="/about">About</a>"#;
    let result = convert_with_kreuzberg(html, Some("https://example.com")).unwrap();
    assert!(result.content.contains("https://example.com/about"));
}

#[test]
fn test_convert_removes_script() {
    let html = r"<html><body><script>alert('test');</script><p>Content</p></body></html>";
    let result = convert_with_kreuzberg(html, None).unwrap();
    assert!(!result.content.contains("alert"));
    assert!(result.content.contains("Content"));
}
