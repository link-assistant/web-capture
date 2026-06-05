use web_capture::metadata::{
    extract_metadata, format_footer_block, format_metadata_block, ArticleMetadata,
};

#[test]
fn test_extract_metadata_author() {
    let html = r#"<html><body>
        <a class="tm-user-info__username" href="/users/testuser">TestUser</a>
    </body></html>"#;
    let meta = extract_metadata(html);
    assert_eq!(meta.author.as_deref(), Some("TestUser"));
    assert_eq!(meta.author_url.as_deref(), Some("/users/testuser"));
}

#[test]
fn test_extract_metadata_date() {
    let html = r#"<html><body>
        <time datetime="2024-01-15T10:00:00Z">January 15, 2024</time>
    </body></html>"#;
    let meta = extract_metadata(html);
    assert_eq!(meta.publish_date.as_deref(), Some("2024-01-15T10:00:00Z"));
}

#[test]
fn test_extract_metadata_tags() {
    let html = r#"<html><head>
        <meta name="keywords" content="rust, web, capture">
    </head><body></body></html>"#;
    let meta = extract_metadata(html);
    assert_eq!(meta.tags, vec!["rust", "web", "capture"]);
}

#[test]
fn test_extract_metadata_ld_json() {
    let html = r#"<html><head>
        <script type="application/ld+json">{"dateModified":"2024-02-01","author":{"name":"John Doe"}}</script>
    </head><body></body></html>"#;
    let meta = extract_metadata(html);
    assert_eq!(meta.date_modified.as_deref(), Some("2024-02-01"));
    assert_eq!(meta.author_full_name.as_deref(), Some("John Doe"));
}

#[test]
fn test_format_metadata_block_author() {
    let meta = ArticleMetadata {
        author: Some("user123".to_string()),
        author_url: Some("/users/user123".to_string()),
        ..Default::default()
    };
    let lines = format_metadata_block(&meta);
    assert!(!lines.is_empty());
    assert!(lines[0].contains("[user123](/users/user123)"));
}

#[test]
fn test_format_footer_block_tags() {
    let meta = ArticleMetadata {
        tags: vec!["rust".to_string(), "web".to_string()],
        ..Default::default()
    };
    let lines = format_footer_block(&meta);
    assert!(lines
        .iter()
        .any(|l| l.contains("rust") && l.contains("web")));
}

#[test]
fn test_extract_metadata_empty_html() {
    let meta = extract_metadata("<html><body></body></html>");
    assert!(meta.author.is_none());
    assert!(meta.tags.is_empty());
}
