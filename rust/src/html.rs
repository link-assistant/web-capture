//! HTML processing module
//!
//! This module provides functions for fetching, parsing, and processing HTML content.

use crate::{Result, WebCaptureError};
use regex::Regex;
use tracing::{debug, info};
use url::Url;

/// Default user agent string
const USER_AGENT: &str = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";

/// Fetch HTML content from a URL
///
/// This function makes a simple HTTP GET request to fetch the HTML content.
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
    info!("Fetching HTML from URL: {}", url);

    let client = reqwest::Client::builder()
        .user_agent(USER_AGENT)
        .build()
        .map_err(|e| WebCaptureError::FetchError(e.to_string()))?;

    let response = client
        .get(url)
        .header("Accept-Language", "en-US,en;q=0.9")
        .header("Accept-Charset", "utf-8")
        .send()
        .await
        .map_err(|e| WebCaptureError::FetchError(e.to_string()))?;

    let html = response
        .text()
        .await
        .map_err(|e| WebCaptureError::FetchError(e.to_string()))?;

    info!("Successfully fetched HTML ({} bytes)", html.len());
    Ok(html)
}

/// Convert relative URLs to absolute URLs in HTML content
///
/// Processes various HTML attributes that contain URLs and converts
/// relative URLs to absolute URLs using the provided base URL.
///
/// # Arguments
///
/// * `html` - The HTML content to process
/// * `base_url` - The base URL to use for resolving relative URLs
///
/// # Returns
///
/// The HTML content with absolute URLs
pub fn convert_relative_urls(html: &str, base_url: &str) -> String {
    debug!(
        "Converting relative URLs to absolute using base: {}",
        base_url
    );

    let Ok(base) = Url::parse(base_url) else {
        return html.to_string();
    };

    let mut result = html.to_string();

    // List of tag/attribute combinations to process
    let attributes = [
        ("a", "href"),
        ("img", "src"),
        ("script", "src"),
        ("link", "href"),
        ("form", "action"),
        ("video", "src"),
        ("audio", "src"),
        ("source", "src"),
        ("track", "src"),
        ("embed", "src"),
        ("object", "data"),
        ("iframe", "src"),
    ];

    for (tag, attr) in &attributes {
        let pattern = format!(r#"<{tag}[^>]*{attr}=["']([^"']+)["'][^>]*>"#);
        if let Ok(regex) = Regex::new(&pattern) {
            result = regex
                .replace_all(&result, |caps: &regex::Captures| {
                    let full_match = caps.get(0).map_or("", |m| m.as_str());
                    let url_match = caps.get(1).map_or("", |m| m.as_str());

                    let absolute_url = to_absolute_url(url_match, &base);
                    full_match.replace(url_match, &absolute_url)
                })
                .to_string();
        }
    }

    // Handle inline styles with url()
    if let Ok(url_regex) = Regex::new(r#"url\(['"]?([^'"()]+)['"]?\)"#) {
        result = url_regex
            .replace_all(&result, |caps: &regex::Captures| {
                let url_match = caps.get(1).map_or("", |m| m.as_str());
                let absolute_url = to_absolute_url(url_match, &base);
                format!(r#"url("{absolute_url}")"#)
            })
            .to_string();
    }

    debug!("URL conversion complete");
    result
}

/// Convert a potentially relative URL to an absolute URL
fn to_absolute_url(url: &str, base: &Url) -> String {
    // Skip data:, blob:, and javascript: URLs
    if url.is_empty()
        || url.starts_with("data:")
        || url.starts_with("blob:")
        || url.starts_with("javascript:")
    {
        return url.to_string();
    }

    // Try to resolve the URL against the base
    base.join(url)
        .map_or_else(|_| url.to_string(), |absolute| absolute.to_string())
}

/// Convert HTML content to UTF-8 encoding
///
/// Detects the current encoding from meta tags and ensures UTF-8 encoding.
///
/// # Arguments
///
/// * `html` - The HTML content to convert
///
/// # Returns
///
/// The UTF-8 encoded HTML content
pub fn convert_to_utf8(html: &str) -> String {
    debug!("Converting HTML to UTF-8");

    // Check for charset meta tag
    let charset_regex = Regex::new(r#"<meta[^>]+charset=["']?([^"'>\s]+)"#).ok();

    let current_charset = charset_regex
        .as_ref()
        .and_then(|re| re.captures(html))
        .and_then(|caps| caps.get(1))
        .map_or_else(|| "utf-8".to_string(), |m| m.as_str().to_lowercase());

    // If already UTF-8, ensure the meta tag is present
    if current_charset == "utf-8" || current_charset == "utf8" {
        // Add meta charset if not present
        if !html.to_lowercase().contains("charset") {
            if let Ok(head_regex) = Regex::new(r"<head[^>]*>") {
                return head_regex
                    .replace(html, r#"$0<meta charset="utf-8">"#)
                    .to_string();
            }
        }
        return html.to_string();
    }

    // For other charsets, try to convert and update the meta tag
    let charset_update_regex = Regex::new(r#"<meta[^>]+charset=["']?[^"'>\s]+["']?"#).ok();

    charset_update_regex.map_or_else(
        || html.to_string(),
        |regex| regex.replace(html, r#"<meta charset="utf-8""#).to_string(),
    )
}

/// Check if HTML content contains JavaScript
///
/// # Arguments
///
/// * `html` - The HTML content to check
///
/// # Returns
///
/// True if the HTML contains JavaScript
#[must_use]
pub fn has_javascript(html: &str) -> bool {
    let pattern = r"<script[^>]*>[\s\S]*?</script>|<script[^>]*/\s*>|javascript:";
    Regex::new(pattern)
        .map(|re| re.is_match(html))
        .unwrap_or(false)
}

/// Check if content is valid HTML
///
/// # Arguments
///
/// * `html` - The content to check
///
/// # Returns
///
/// True if the content appears to be valid HTML
#[must_use]
pub fn is_html(html: &str) -> bool {
    let pattern = r"<html[^>]*>[\s\S]*?</html>";
    Regex::new(pattern)
        .map(|re| re.is_match(html))
        .unwrap_or(false)
}

/// Decode HTML entities to unicode characters.
///
/// Converts HTML entities like `&amp;`, `&lt;`, `&#39;`, `&#x27;` etc.
/// to their actual unicode character equivalents.
///
/// # Arguments
///
/// * `html` - The HTML content containing entities to decode
///
/// # Returns
///
/// The content with all HTML entities decoded to unicode
#[must_use]
pub fn decode_html_entities(html: &str) -> String {
    html_escape::decode_html_entities(html).into_owned()
}

/// Normalize URL to ensure it's absolute.
///
/// Prepends `https://` if no scheme is present and validates the URL.
///
/// # Errors
///
/// Returns an error string if the URL is empty or invalid.
pub fn normalize_url(url: &str) -> std::result::Result<String, String> {
    if url.is_empty() {
        return Err("Missing url parameter".to_string());
    }

    let absolute_url = if url.starts_with("http://") || url.starts_with("https://") {
        url.to_string()
    } else {
        format!("https://{url}")
    };

    // Validate the URL
    Url::parse(&absolute_url).map_err(|e| format!("Invalid URL: {e}"))?;

    Ok(absolute_url)
}
