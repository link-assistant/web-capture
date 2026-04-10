//! Browser automation module
//!
//! This module provides headless browser operations for rendering pages
//! and capturing screenshots. Note: Full browser automation requires
//! browser-commander, which depends on having Chrome installed.
//!
//! For simpler HTTP fetching without JavaScript rendering, see the html module.

use crate::{Result, WebCaptureError};
use tracing::info;

/// Browser engine type
#[derive(Debug, Clone, Copy, PartialEq, Eq, Default)]
pub enum BrowserEngine {
    /// Chromiumoxide engine (default)
    #[default]
    Chromiumoxide,
}

impl std::fmt::Display for BrowserEngine {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            Self::Chromiumoxide => write!(f, "chromiumoxide"),
        }
    }
}

impl std::str::FromStr for BrowserEngine {
    type Err = WebCaptureError;

    fn from_str(s: &str) -> std::result::Result<Self, Self::Err> {
        match s.to_lowercase().as_str() {
            "chromiumoxide" | "chromium" | "chrome" => Ok(Self::Chromiumoxide),
            _ => Err(WebCaptureError::BrowserError(format!(
                "Unknown browser engine: {s}"
            ))),
        }
    }
}

/// Render HTML content from a URL using a headless browser
///
/// This function uses browser-commander to launch a headless browser,
/// navigate to the URL, and return the rendered HTML content.
///
/// Note: This requires Chrome/Chromium to be installed on the system.
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
    info!("Rendering HTML for URL: {}", url);

    // For now, fall back to simple HTTP fetching
    // Full browser rendering with JavaScript execution requires
    // more complex setup with browser-commander
    let html = crate::html::fetch_html(url).await?;

    info!("Successfully fetched HTML ({} bytes)", html.len());
    Ok(html)
}

/// Capture a PNG screenshot of a URL
///
/// This function uses browser-commander to launch a headless browser,
/// navigate to the URL, and capture a screenshot.
///
/// Note: This requires Chrome/Chromium to be installed on the system.
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
#[allow(clippy::unused_async)] // Will be async when browser-commander is fully integrated
pub async fn capture_screenshot(url: &str) -> Result<Vec<u8>> {
    info!("Capturing screenshot for URL: {}", url);

    // Screenshot capture requires full browser automation
    // For now, return an error indicating this feature needs browser setup
    Err(WebCaptureError::ScreenshotError(
        "Screenshot capture requires Chrome/Chromium. Install it and enable browser-commander features.".to_string()
    ))
}
