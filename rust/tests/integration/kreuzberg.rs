use web_capture::{convert_with_kreuzberg, convert_with_kreuzberg_enhanced, EnhancedOptions};

#[test]
fn converts_basic_html() {
    let html = r"<html><body><h1>Hello World</h1><p>This is a test.</p></body></html>";
    let result = convert_with_kreuzberg(html, None).unwrap();
    assert!(result.content.contains("Hello World"));
    assert!(result.content.contains("This is a test."));
}

#[test]
fn extracts_metadata() {
    let html = r#"<html><head><title>My Page</title><meta property="og:description" content="A test page"></head><body><h1>Test</h1></body></html>"#;
    let result = convert_with_kreuzberg(html, None).unwrap();
    assert!(result.content.contains("Test"));
    assert!(result.metadata.is_some());
}

#[test]
fn converts_tables() {
    let html = r"<table><thead><tr><th>Name</th><th>Value</th></tr></thead><tbody><tr><td>A</td><td>1</td></tr></tbody></table>";
    let result = convert_with_kreuzberg(html, None).unwrap();
    assert!(result.content.contains("Name"));
    assert!(result.content.contains("Value"));
}

#[test]
fn extracts_inline_images() {
    let html = r#"<img src="data:image/png;base64,iVBORw0KGgo=" alt="tiny pixel" data-filename="tiny.png">"#;
    let result = convert_with_kreuzberg(html, None).unwrap();
    assert_eq!(result.images.len(), 1);
    assert_eq!(result.images[0]["format"], "png");
    assert_eq!(result.images[0]["filename"], "tiny.png");
    assert_eq!(result.images[0]["description"], "tiny pixel");
}

#[test]
fn absolutizes_relative_urls() {
    let html = r#"<a href="/about">About</a>"#;
    let result = convert_with_kreuzberg(html, Some("https://example.com")).unwrap();
    assert!(result.content.contains("https://example.com/about"));
}

#[test]
fn removes_scripts() {
    let html = r"<html><body><script>alert('test');</script><p>Content</p></body></html>";
    let result = convert_with_kreuzberg(html, None).unwrap();
    assert!(!result.content.contains("alert"));
    assert!(result.content.contains("Content"));
}

#[test]
fn applies_enhanced_scoping_options() {
    let html = r"
      <main>
        <h1>Article Title</h1>
        <nav>Navigation</nav>
        <article><p>Wanted body.</p></article>
      </main>
    ";
    let options = EnhancedOptions {
        content_selector: Some("main".to_string()),
        body_selector: Some("article".to_string()),
        ..EnhancedOptions::default()
    };
    let result = convert_with_kreuzberg_enhanced(html, None, &options).unwrap();
    assert!(result.content.contains("Article Title"));
    assert!(result.content.contains("Wanted body."));
    assert!(!result.content.contains("Navigation"));
}
