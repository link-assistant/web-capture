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

pub mod animation;
pub mod batch;
pub mod browser;
pub mod extract_images;
pub mod figures;
pub mod gdocs;
pub mod html;
pub mod latex;
pub mod localize_images;
pub mod markdown;
pub mod metadata;
pub mod postprocess;
pub mod themed_image;
pub mod verify;

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

/// Options for enhanced HTML-to-Markdown conversion.
#[allow(clippy::struct_excessive_bools)]
#[derive(Debug, Clone)]
pub struct EnhancedOptions {
    /// Extract LaTeX formulas from img.formula, `KaTeX`, `MathJax` elements.
    pub extract_latex: bool,
    /// Extract article metadata (author, date, hubs, tags).
    pub extract_metadata: bool,
    /// Apply post-processing (unicode normalization, LaTeX spacing, etc.).
    pub post_process: bool,
    /// Detect and correct code block languages.
    pub detect_code_language: bool,
    /// CSS selector used to scope Markdown conversion.
    pub content_selector: Option<String>,
    /// CSS selector for article body Markdown; prepends the selected article title when available.
    pub body_selector: Option<String>,
}

impl Default for EnhancedOptions {
    fn default() -> Self {
        Self {
            extract_latex: true,
            extract_metadata: true,
            post_process: true,
            detect_code_language: true,
            content_selector: None,
            body_selector: None,
        }
    }
}

/// Result of enhanced HTML-to-Markdown conversion.
#[derive(Debug, Clone)]
pub struct EnhancedMarkdownResult {
    pub markdown: String,
    pub metadata: Option<metadata::ArticleMetadata>,
}

/// Convert HTML to Markdown with enhanced options.
///
/// Supports LaTeX formula extraction, metadata extraction, and
/// post-processing pipeline matching the JavaScript implementation.
///
/// # Arguments
///
/// * `html` - The HTML content to convert
/// * `base_url` - Optional base URL for resolving relative URLs
/// * `options` - Enhanced conversion options
///
/// # Returns
///
/// Enhanced result with markdown text and optional metadata
///
/// # Errors
///
/// Returns an error if base conversion fails
pub fn convert_html_to_markdown_enhanced(
    html: &str,
    base_url: Option<&str>,
    options: &EnhancedOptions,
) -> Result<EnhancedMarkdownResult> {
    let conversion_html = if let Some(body_selector) = options.body_selector.as_deref() {
        let body_html = markdown::select_html(html, body_selector);
        let title_selector = options
            .content_selector
            .as_deref()
            .map_or_else(|| "h1".to_string(), |selector| format!("{selector} h1, h1"));
        let title_html = markdown::select_html(html, &title_selector);
        match (title_html, body_html) {
            (Some(title), Some(body)) => format!("{title}\n{body}"),
            (None, Some(body)) => body,
            _ => html.to_string(),
        }
    } else if let Some(content_selector) = options.content_selector.as_deref() {
        markdown::select_html(html, content_selector).unwrap_or_else(|| html.to_string())
    } else {
        html.to_string()
    };

    // Start with basic markdown conversion
    let mut md = markdown::convert_html_to_markdown(&conversion_html, base_url)?;

    // Extract metadata if requested
    let extracted_metadata = if options.extract_metadata {
        let meta = metadata::extract_metadata(html);
        // Prepend metadata block
        let header_lines = metadata::format_metadata_block(&meta);
        if !header_lines.is_empty() {
            let header = header_lines.join("\n");
            // Insert after the first heading
            if let Some(pos) = md.find("\n\n") {
                md = format!("{}\n\n{}\n{}", &md[..pos], header, &md[pos + 2..]);
            } else {
                md = format!("{header}\n\n{md}");
            }
        }
        // Append footer block
        let footer_lines = metadata::format_footer_block(&meta);
        if !footer_lines.is_empty() {
            md.push_str("\n\n");
            md.push_str(&footer_lines.join("\n"));
        }
        Some(meta)
    } else {
        None
    };

    // Apply post-processing if requested
    if options.post_process {
        md = postprocess::post_process_markdown(&md, &postprocess::PostProcessOptions::default());
    }

    Ok(EnhancedMarkdownResult {
        markdown: md,
        metadata: extracted_metadata,
    })
}

// Re-export commonly used types
pub use browser::BrowserEngine;
