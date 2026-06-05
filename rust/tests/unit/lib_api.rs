use web_capture::{
    convert_html_to_markdown_enhanced, convert_relative_urls, convert_to_utf8, EnhancedOptions,
    VERSION,
};

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

#[test]
fn test_enhanced_markdown_scopes_habr_article_body_and_keeps_metadata() {
    let html = r#"
      <html>
        <head><meta name="keywords" content="links, theory"></head>
        <body>
          <nav><a href="/en/feed">Habr</a><a href="/en/search">Search</a></nav>
          <a href="/en/sandbox/start/">Write a publication</a>
          <article>
            <header>
              <h1>The Links Theory 0.0.2</h1>
              <a class="tm-user-info__username" href="/users/links">links</a>
              <time datetime="2026-04-01T00:00:00Z">April 1</time>
            </header>
            <div class="article-formatted-body">
              <p>Last April 1st, as you might have guessed, the project shipped.</p>
            </div>
          </article>
        </body>
      </html>
    "#;
    let options = EnhancedOptions {
        content_selector: Some("article".to_string()),
        body_selector: Some(".article-formatted-body".to_string()),
        ..EnhancedOptions::default()
    };

    let result = convert_html_to_markdown_enhanced(
        html,
        Some("https://habr.com/en/articles/895896/"),
        &options,
    )
    .unwrap();

    assert!(
        result
            .markdown
            .trim_start()
            .starts_with("# The Links Theory 0.0.2")
            || result
                .markdown
                .trim_start()
                .starts_with("The Links Theory 0.0.2")
    );
    assert!(result.markdown.contains("Last April 1st"));
    assert!(result.markdown.contains("**Author:** [links]"));
    assert!(!result.markdown.contains("Habr"));
    assert!(!result.markdown.contains("Search"));
    assert!(!result.markdown.contains("Write a publication"));
    let metadata = result.metadata.unwrap();
    assert_eq!(metadata.author.as_deref(), Some("links"));
    assert_eq!(
        metadata.tags,
        vec!["links".to_string(), "theory".to_string()]
    );
}
