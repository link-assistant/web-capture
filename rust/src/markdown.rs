//! Markdown conversion module
//!
//! This module provides functions for converting HTML to Markdown format.

use crate::html::convert_relative_urls;
use crate::Result;
use scraper::{Html, Selector};
use tracing::{debug, info};

/// Convert HTML content to Markdown
///
/// This function cleans the HTML (removing scripts, styles, etc.)
/// and converts it to Markdown format.
///
/// # Arguments
///
/// * `html` - The HTML content to convert
/// * `base_url` - Optional base URL for converting relative URLs to absolute
///
/// # Returns
///
/// The Markdown content as a string
///
/// # Errors
///
/// Returns an error if conversion fails
pub fn convert_html_to_markdown(html: &str, base_url: Option<&str>) -> Result<String> {
    info!("Converting HTML to Markdown");

    // Convert relative URLs to absolute if base_url is provided
    let processed_html = base_url.map_or_else(
        || html.to_string(),
        |base| convert_relative_urls(html, base),
    );

    // Parse and clean the HTML
    let cleaned_html = clean_html(&processed_html);

    // Convert to Markdown using html2md
    let markdown = html2md::parse_html(&cleaned_html);

    // Clean up the markdown output
    let cleaned_markdown = clean_markdown(&markdown);

    info!(
        "Successfully converted to Markdown ({} bytes)",
        cleaned_markdown.len()
    );
    Ok(cleaned_markdown)
}

/// Clean HTML content before Markdown conversion
///
/// Removes scripts, styles, and other elements that shouldn't be in Markdown.
fn clean_html(html: &str) -> String {
    debug!("Cleaning HTML for Markdown conversion");

    let document = Html::parse_document(html);

    // Create a mutable string to build our cleaned HTML
    let mut cleaned = html.to_string();

    // Remove script tags
    if let Ok(selector) = Selector::parse("script") {
        for element in document.select(&selector) {
            let outer_html = element.html();
            cleaned = cleaned.replace(&outer_html, "");
        }
    }

    // Remove style tags
    if let Ok(selector) = Selector::parse("style") {
        for element in document.select(&selector) {
            let outer_html = element.html();
            cleaned = cleaned.replace(&outer_html, "");
        }
    }

    // Remove noscript tags
    if let Ok(selector) = Selector::parse("noscript") {
        for element in document.select(&selector) {
            let outer_html = element.html();
            cleaned = cleaned.replace(&outer_html, "");
        }
    }

    cleaned
}

/// Clean up Markdown output
///
/// Removes excessive whitespace and normalizes the output.
fn clean_markdown(markdown: &str) -> String {
    debug!("Cleaning Markdown output");

    // Remove excessive blank lines (more than 2 consecutive newlines)
    let mut result = markdown.to_string();

    // Replace multiple consecutive newlines with at most two
    while result.contains("\n\n\n") {
        result = result.replace("\n\n\n", "\n\n");
    }

    // Trim leading and trailing whitespace
    result = result.trim().to_string();

    // Ensure the document ends with a newline
    if !result.is_empty() && !result.ends_with('\n') {
        result.push('\n');
    }

    result
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_convert_html_to_markdown_basic() {
        let html = r"<html><body><h1>Hello World</h1><p>This is a test.</p></body></html>";
        let result = convert_html_to_markdown(html, None).unwrap();
        eprintln!("Result: {:?}", result);
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
}
