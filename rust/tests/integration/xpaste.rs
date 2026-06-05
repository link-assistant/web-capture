const XPASTE_HTML: &str = include_str!("../../../tests/xpaste/data/t4q0Lsp0-page.html");
const XPASTE_TEXT: &str = include_str!("../../../tests/xpaste/data/t4q0Lsp0-actual-content.txt");

#[test]
fn xpaste_fixture_markdown_matches_visual_order() {
    let result = web_capture::convert_html_to_markdown_enhanced(
        XPASTE_HTML,
        Some("https://xpaste.pro/p/t4q0Lsp0"),
        &web_capture::EnhancedOptions {
            extract_metadata: false,
            post_process: false,
            ..web_capture::EnhancedOptions::default()
        },
    )
    .unwrap();

    let markdown = result.markdown;
    let heading_index = markdown.find("Упакуем пароль").unwrap();
    let ru_index = markdown.find("Ru").unwrap();
    let en_index = markdown.find("En").unwrap();
    let language_index = ru_index.min(en_index);
    let format_index = markdown.find("Формат:").unwrap();
    let first_query_index = markdown.find("# 1").unwrap();

    assert!(heading_index < format_index, "{markdown}");
    assert!(language_index < format_index, "{markdown}");
    assert!(format_index < first_query_index, "{markdown}");
    assert!(markdown.contains("Time: 210707 15:39:36"));
    assert!(markdown.contains("Southbridge"));
}

#[test]
fn xpaste_text_fixture_contains_reference_queries() {
    assert!(XPASTE_TEXT.contains("SELECT f.*, t.*, p.*, u.*"));
    assert!(XPASTE_TEXT.contains("DELETE FROM phpbb_post_revisions"));
    assert_eq!(XPASTE_TEXT.lines().count(), 64);
}
