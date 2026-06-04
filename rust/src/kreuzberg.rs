//! Kreuzberg html-to-markdown integration module.
//!
//! Provides high-performance HTML to Markdown conversion using the
//! `html-to-markdown-rs` crate (Rust-powered, 150-280 MB/s).
//!
//! This converter is available as an alternative to the default `html2md`-based
//! converter, providing structured results with metadata, table, and image extraction.
//!
//! # References
//!
//! - <https://github.com/kreuzberg-dev/html-to-markdown>
//! - <https://crates.io/crates/html-to-markdown-rs>

use crate::html::convert_relative_urls;
use crate::Result;
use base64::{engine::general_purpose::STANDARD, Engine as _};
use serde::{Deserialize, Serialize};
use tracing::{debug, info};

/// Structured result from kreuzberg HTML-to-Markdown conversion.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct KreuzbergResult {
    /// The converted markdown content.
    pub content: String,
    /// Extracted metadata (title, links, headings, images, structured data).
    pub metadata: Option<serde_json::Value>,
    /// Extracted table data.
    pub tables: Vec<serde_json::Value>,
    /// Extracted inline image data.
    pub images: Vec<serde_json::Value>,
    /// Non-fatal conversion warnings.
    pub warnings: Vec<String>,
}

/// Convert HTML to Markdown using the kreuzberg html-to-markdown library.
///
/// Returns a structured result with content, metadata, tables, images, and warnings.
///
/// # Arguments
///
/// * `html` - The HTML content to convert
/// * `base_url` - Optional base URL for converting relative URLs to absolute
///
/// # Returns
///
/// A `KreuzbergResult` with structured conversion output
///
/// # Errors
///
/// Returns an error if conversion fails
pub fn convert_with_kreuzberg(html: &str, base_url: Option<&str>) -> Result<KreuzbergResult> {
    info!("Converting HTML to Markdown using kreuzberg");

    // Convert relative URLs to absolute if base_url is provided
    let processed_html = base_url.map_or_else(
        || html.to_string(),
        |base| convert_relative_urls(html, base),
    );

    let options = html_to_markdown_rs::ConversionOptions {
        extract_metadata: true,
        extract_images: true,
        ..html_to_markdown_rs::ConversionOptions::default()
    };

    let result = html_to_markdown_rs::convert(&processed_html, Some(options))
        .map_err(|e| crate::WebCaptureError::MarkdownError(format!("kreuzberg: {e}")))?;

    let content = result.content.unwrap_or_default();

    // Convert metadata to JSON value
    let metadata = serde_json::to_value(&result.metadata)
        .ok()
        .filter(|v| !v.is_null());

    // Convert tables to JSON values
    let tables: Vec<serde_json::Value> = result
        .tables
        .iter()
        .filter_map(|t| serde_json::to_value(t).ok())
        .collect();

    // Convert inline image payloads into a JSON-compatible structure.
    let images: Vec<serde_json::Value> = result.images.iter().map(inline_image_to_json).collect();

    // Convert warnings to strings
    let warnings: Vec<String> = result.warnings.iter().map(|w| w.message.clone()).collect();

    debug!(
        "Kreuzberg conversion complete: {} bytes content, {} tables, {} images, {} warnings",
        content.len(),
        tables.len(),
        images.len(),
        warnings.len()
    );

    Ok(KreuzbergResult {
        content,
        metadata,
        tables,
        images,
        warnings,
    })
}

fn inline_image_to_json(image: &html_to_markdown_rs::InlineImage) -> serde_json::Value {
    let dimensions = image.dimensions.map(|(width, height)| {
        serde_json::json!({
            "width": width,
            "height": height,
        })
    });

    serde_json::json!({
        "data": STANDARD.encode(&image.data),
        "format": image.format.to_string(),
        "filename": image.filename.as_deref(),
        "description": image.description.as_deref(),
        "dimensions": dimensions,
        "source": image.source.to_string(),
        "attributes": &image.attributes,
    })
}
