//! Markdown conversion module
//!
//! This module provides functions for converting HTML to Markdown format.

use crate::html::convert_relative_urls;
use crate::Result;
use regex::Regex;
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

    // Move <img> elements out of headings so html2md always sees them.
    // Some html2md versions only emit text children for <h1>..<h6>,
    // silently dropping inline images.
    let heading_safe_html = hoist_images_from_headings(&cleaned_html);

    // Convert to Markdown using html2md
    let markdown = html2md::parse_html(&heading_safe_html);

    // Decode HTML entities to unicode characters
    let decoded_markdown = crate::html::decode_html_entities(&markdown);

    // Preserve non-breaking spaces as &nbsp; entities for clear marking
    let normalized_markdown = decoded_markdown.replace('\u{00A0}', "&nbsp;");

    // Clean up the markdown output
    let cleaned_markdown = clean_markdown(&normalized_markdown);

    info!(
        "Successfully converted to Markdown ({} bytes)",
        cleaned_markdown.len()
    );
    Ok(cleaned_markdown)
}

#[must_use]
pub fn select_html(html: &str, selector_str: &str) -> Option<String> {
    let selector = Selector::parse(selector_str).ok()?;
    let document = Html::parse_document(html);
    document
        .select(&selector)
        .next()
        .map(|element| element.html())
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

/// Move `<img>` tags out of `<h1>`..`<h6>` elements.
///
/// Rewrites `<hN>...<img ...>...text</hN>` →
/// `<hN>...text</hN>\n<p><img ...></p>` so that any HTML→Markdown
/// converter sees the images at block level.
fn hoist_images_from_headings(html: &str) -> String {
    use std::fmt::Write;

    let img_re = Regex::new(r"<img\s[^>]*>").expect("valid regex");
    let mut result = html.to_string();

    for level in 1..=6 {
        let heading_re = Regex::new(&format!(r"(?si)(<h{level}\b[^>]*>)(.*?)(</h{level}>)"))
            .expect("valid regex");

        result = heading_re
            .replace_all(&result, |caps: &regex::Captures<'_>| {
                let open = &caps[1];
                let inner = &caps[2];
                let close = &caps[3];

                let imgs: Vec<&str> = img_re.find_iter(inner).map(|m| m.as_str()).collect();

                if imgs.is_empty() {
                    return caps[0].to_string();
                }

                let stripped = img_re.replace_all(inner, "").to_string();
                let mut out = format!("{open}{stripped}{close}");
                for img in imgs {
                    write!(out, "\n<p>{img}</p>").expect("write to String");
                }
                out
            })
            .into_owned();
    }

    result
}

/// Clean up Markdown output
///
/// Removes excessive whitespace and normalizes the output.
pub fn clean_markdown(markdown: &str) -> String {
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
