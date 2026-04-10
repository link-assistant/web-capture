use web_capture::markdown::{clean_markdown, convert_html_to_markdown};

#[test]
fn test_convert_html_to_markdown_basic() {
    let html = r"<html><body><h1>Hello World</h1><p>This is a test.</p></body></html>";
    let result = convert_html_to_markdown(html, None).unwrap();
    eprintln!("Result: {result:?}");
    // html2md may format headers differently (with or without space after #)
    assert!(
        result.contains("Hello World"),
        "Should contain 'Hello World'"
    );
    assert!(
        result.contains("This is a test."),
        "Should contain 'This is a test.'"
    );
}

#[test]
fn test_convert_html_to_markdown_with_link() {
    let html = r#"<a href="https://example.com">Example</a>"#;
    let result = convert_html_to_markdown(html, None).unwrap();
    assert!(result.contains("[Example](https://example.com)"));
}

#[test]
fn test_convert_html_to_markdown_with_relative_url() {
    let html = r#"<a href="/about">About</a>"#;
    let result = convert_html_to_markdown(html, Some("https://example.com")).unwrap();
    assert!(result.contains("https://example.com/about"));
}

#[test]
fn test_convert_html_to_markdown_removes_script() {
    let html = r"<html><body><script>alert('test');</script><p>Content</p></body></html>";
    let result = convert_html_to_markdown(html, None).unwrap();
    assert!(!result.contains("alert"));
    assert!(result.contains("Content"));
}

#[test]
fn test_convert_html_to_markdown_removes_style() {
    let html = r"<html><body><style>body { color: red; }</style><p>Content</p></body></html>";
    let result = convert_html_to_markdown(html, None).unwrap();
    assert!(!result.contains("color: red"));
    assert!(result.contains("Content"));
}

#[test]
fn test_clean_markdown_removes_excessive_newlines() {
    let markdown = "Line 1\n\n\n\n\nLine 2";
    let result = clean_markdown(markdown);
    assert_eq!(result, "Line 1\n\nLine 2\n");
}

#[test]
fn test_clean_markdown_adds_trailing_newline() {
    let markdown = "Content";
    let result = clean_markdown(markdown);
    assert!(result.ends_with('\n'));
}
