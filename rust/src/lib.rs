//! # web-capture
//!
//! A library and CLI/microservice to render web pages as HTML, Markdown, or PNG screenshots.
//!
//! ## Features
//!
//! - Fetch HTML content from URLs
//! - Convert HTML to Markdown
//! - Capture PNG screenshots of web pages
//! - Convert relative URLs to absolute URLs
//! - Support for headless browser rendering via browser-commander
//!
//! ## Example
//!
//! ```rust,no_run
//! use web_capture::{fetch_html, convert_html_to_markdown, capture_screenshot};
//!
//! #[tokio::main]
//! async fn main() -> anyhow::Result<()> {
//!     // Fetch HTML from a URL
//!     let html = fetch_html("https://example.com").await?;
//!     println!("HTML length: {}", html.len());
//!
//!     // Convert HTML to Markdown
//!     let markdown = convert_html_to_markdown(&html, Some("https://example.com"))?;
//!     println!("Markdown: {}", markdown);
//!
//!     // Capture a screenshot
//!     let screenshot = capture_screenshot("https://example.com").await?;
//!     println!("Screenshot size: {} bytes", screenshot.len());
//!
//!     Ok(())
//! }
//! ```

pub mod browser;
pub mod html;
pub mod markdown;

use thiserror::Error;

/// Version of the web-capture library
pub const VERSION: &str = env!("CARGO_PKG_VERSION");

/// Error types for web-capture operations
#[derive(Error, Debug)]
pub enum WebCaptureError {
    #[error("Failed to fetch URL: {0}")]
    FetchError(String),

    #[error("Failed to parse HTML: {0}")]
    ParseError(String),

    #[error("Failed to convert to Markdown: {0}")]
    MarkdownError(String),

    #[error("Failed to capture screenshot: {0}")]
    ScreenshotError(String),

    #[error("Browser error: {0}")]
    BrowserError(String),

    #[error("Invalid URL: {0}")]
    InvalidUrl(String),

    #[error("IO error: {0}")]
    IoError(#[from] std::io::Error),

    #[error("Request error: {0}")]
    RequestError(#[from] reqwest::Error),
}

/// Result type for web-capture operations
pub type Result<T> = std::result::Result<T, WebCaptureError>;

/// Fetch HTML content from a URL
///
/// This function makes a simple HTTP GET request to fetch the HTML content.
/// For JavaScript-heavy pages, use `render_html` instead.
///
/// # Arguments
///
/// * `url` - The URL to fetch
///
/// # Returns
///
/// The HTML content as a string
///
/// # Errors
///
/// Returns an error if the fetch fails or the response cannot be decoded
pub async fn fetch_html(url: &str) -> Result<String> {
    html::fetch_html(url).await
}

/// Render HTML content from a URL using a headless browser
///
/// This function uses browser-commander to launch a headless browser,
/// navigate to the URL, and return the rendered HTML content.
///
/// # Arguments
///
/// * `url` - The URL to render
///
/// # Returns
///
/// The rendered HTML content as a string
///
/// # Errors
///
/// Returns an error if browser operations fail
pub async fn render_html(url: &str) -> Result<String> {
    browser::render_html(url).await
}

/// Convert HTML content to Markdown
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
    markdown::convert_html_to_markdown(html, base_url)
}

/// Capture a PNG screenshot of a URL
///
/// This function uses browser-commander to launch a headless browser,
/// navigate to the URL, and capture a screenshot.
///
/// # Arguments
///
/// * `url` - The URL to capture
///
/// # Returns
///
/// The PNG image data as bytes
///
/// # Errors
///
/// Returns an error if browser operations fail
pub async fn capture_screenshot(url: &str) -> Result<Vec<u8>> {
    browser::capture_screenshot(url).await
}

/// Convert relative URLs to absolute URLs in HTML content
///
/// # Arguments
///
/// * `html` - The HTML content to process
/// * `base_url` - The base URL to use for resolving relative URLs
///
/// # Returns
///
/// The HTML content with absolute URLs
#[must_use]
pub fn convert_relative_urls(html: &str, base_url: &str) -> String {
    html::convert_relative_urls(html, base_url)
}

/// Convert HTML content to UTF-8 encoding
///
/// Detects the current encoding from meta tags and converts to UTF-8 if needed.
///
/// # Arguments
///
/// * `html` - The HTML content to convert
///
/// # Returns
///
/// The UTF-8 encoded HTML content
#[must_use]
pub fn convert_to_utf8(html: &str) -> String {
    html::convert_to_utf8(html)
}

// Re-export commonly used types
pub use browser::BrowserEngine;

#[cfg(test)]
mod tests {
    use super::*;

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
}
