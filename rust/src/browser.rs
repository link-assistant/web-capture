//! Browser automation module
//!
//! This module provides headless browser operations for rendering pages
//! and capturing screenshots. Note: Full browser automation requires
//! browser-commander, which depends on having Chrome installed.
//!
//! For simpler HTTP fetching without JavaScript rendering, see the html module.

use crate::{Result, WebCaptureError};
use std::path::PathBuf;
use std::time::{Duration, SystemTime, UNIX_EPOCH};
use tokio::process::Command;
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

    let chrome = find_chrome_executable().ok_or_else(|| {
        WebCaptureError::BrowserError(
            "Chrome/Chromium executable was not found. Set WEB_CAPTURE_CHROME, CHROME_PATH, or GOOGLE_CHROME_BIN.".to_string(),
        )
    })?;
    let user_data_dir = temporary_user_data_dir();
    std::fs::create_dir_all(&user_data_dir)?;

    let output = tokio::time::timeout(
        Duration::from_secs(60),
        Command::new(&chrome)
            .arg("--headless=new")
            .arg("--disable-gpu")
            .arg("--disable-extensions")
            .arg("--disable-dev-shm-usage")
            .arg("--no-sandbox")
            .arg("--dump-dom")
            .arg(format!("--user-data-dir={}", user_data_dir.display()))
            .arg(url)
            .output(),
    )
    .await
    .map_err(|_| {
        WebCaptureError::BrowserError(format!(
            "Timed out waiting for headless Chrome to render {url}"
        ))
    })?
    .map_err(|e| WebCaptureError::BrowserError(format!("Failed to launch Chrome: {e}")))?;

    let _ = std::fs::remove_dir_all(&user_data_dir);

    if !output.status.success() {
        return Err(WebCaptureError::BrowserError(format!(
            "Headless Chrome failed with status {}: {}",
            output.status,
            String::from_utf8_lossy(&output.stderr)
        )));
    }

    let html = String::from_utf8(output.stdout)
        .map_err(|e| WebCaptureError::BrowserError(format!("Chrome output was not UTF-8: {e}")))?;

    info!("Successfully rendered HTML ({} bytes)", html.len());
    Ok(html)
}

fn find_chrome_executable() -> Option<PathBuf> {
    for env_var in [
        "WEB_CAPTURE_CHROME",
        "CHROME_PATH",
        "GOOGLE_CHROME_BIN",
        "CHROMIUM_PATH",
    ] {
        if let Ok(path) = std::env::var(env_var) {
            let candidate = PathBuf::from(path);
            if candidate.exists() {
                return Some(candidate);
            }
        }
    }

    for name in [
        "google-chrome",
        "google-chrome-stable",
        "chromium",
        "chromium-browser",
        "chrome",
    ] {
        if let Some(path) = find_on_path(name) {
            return Some(path);
        }
    }

    for path in [
        "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
        "/Applications/Chromium.app/Contents/MacOS/Chromium",
        r"C:\Program Files\Google\Chrome\Application\chrome.exe",
        r"C:\Program Files (x86)\Google\Chrome\Application\chrome.exe",
        r"C:\Program Files\Chromium\Application\chrome.exe",
    ] {
        let candidate = PathBuf::from(path);
        if candidate.exists() {
            return Some(candidate);
        }
    }

    None
}

fn find_on_path(name: &str) -> Option<PathBuf> {
    let paths = std::env::var_os("PATH")?;
    for dir in std::env::split_paths(&paths) {
        let candidate = dir.join(name);
        if candidate.exists() {
            return Some(candidate);
        }
        #[cfg(windows)]
        {
            let candidate = dir.join(format!("{name}.exe"));
            if candidate.exists() {
                return Some(candidate);
            }
        }
    }
    None
}

fn temporary_user_data_dir() -> PathBuf {
    let nonce = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map_or(0, |duration| duration.as_millis());
    std::env::temp_dir().join(format!("web-capture-chrome-{}-{nonce}", std::process::id()))
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
