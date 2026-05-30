use web_capture::verify::{
    normalize_code, normalize_text, verify_markdown_content, Heading, VerifyOptions, WebContent,
};

#[test]
fn test_normalize_text_whitespace() {
    assert_eq!(normalize_text("  hello   world  "), "hello world");
}

#[test]
fn test_normalize_text_unicode() {
    let result = normalize_text("test\u{00D7}value");
    assert!(result.contains('x'));
}

#[test]
fn test_normalize_text_latex() {
    let result = normalize_text("$E = mc^2$");
    assert_eq!(result, "e = mc\u{00B2}");
}

#[test]
fn test_normalize_code() {
    let result = normalize_code("  function()  {  }  ");
    assert_eq!(result, "function() { }");
}

#[test]
fn test_verify_title_present() {
    let content = WebContent {
        title: Some("Hello World".to_string()),
        ..Default::default()
    };
    let result = verify_markdown_content(
        &content,
        "# Hello World\nSome content",
        &VerifyOptions::default(),
    );
    assert!(result.success);
    assert!(!result.missing.title);
}

#[test]
fn test_verify_title_missing() {
    let content = WebContent {
        title: Some("Missing Title".to_string()),
        ..Default::default()
    };
    let result = verify_markdown_content(
        &content,
        "# Different Title\nSome content",
        &VerifyOptions::default(),
    );
    assert!(result.missing.title);
}

#[test]
fn test_verify_headings() {
    let content = WebContent {
        headings: vec![
            Heading {
                level: 2,
                text: "Introduction".to_string(),
            },
            Heading {
                level: 2,
                text: "Conclusion".to_string(),
            },
        ],
        ..Default::default()
    };
    let result = verify_markdown_content(
        &content,
        "## Introduction\nText\n## Conclusion\nMore text",
        &VerifyOptions::default(),
    );
    assert_eq!(result.passed_checks, 2);
    assert!(result.missing.headings.is_empty());
}

#[test]
fn test_verify_empty_content() {
    let content = WebContent::default();
    let result = verify_markdown_content(&content, "Some markdown", &VerifyOptions::default());
    assert!(result.success);
    assert_eq!(result.total_checks, 0);
}
