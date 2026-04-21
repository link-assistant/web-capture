//! Browser automation module
//!
//! This module provides headless browser operations for rendering pages
//! and capturing screenshots. Note: Full browser automation requires
//! browser-commander, which depends on having Chrome installed.
//!
//! For simpler HTTP fetching without JavaScript rendering, see the html module.

use crate::{Result, WebCaptureError};
use std::path::{Path, PathBuf};
use std::sync::atomic::{AtomicU64, Ordering};
use std::time::{Duration, SystemTime, UNIX_EPOCH};
use tokio::process::Command;
use tracing::{debug, info};

static USER_DATA_DIR_COUNTER: AtomicU64 = AtomicU64::new(0);

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
    render_html_with_timeout(url, Duration::from_secs(60)).await
}

/// Render HTML content from a URL using a headless browser and caller-provided timeout.
///
/// # Errors
///
/// Returns an error if Chrome is unavailable, fails, or does not finish before `timeout`.
pub async fn render_html_with_timeout(url: &str, timeout: Duration) -> Result<String> {
    info!("Rendering HTML for URL: {}", url);

    let chrome = find_chrome_executable().ok_or_else(|| {
        WebCaptureError::BrowserError(
            "Chrome/Chromium executable was not found. Set WEB_CAPTURE_CHROME, CHROME_PATH, or GOOGLE_CHROME_BIN.".to_string(),
        )
    })?;
    let user_data_dir = temporary_user_data_dir();
    std::fs::create_dir_all(&user_data_dir)?;
    let args = chrome_render_args(&user_data_dir, url);
    debug!(
        chrome = %chrome.display(),
        user_data_dir = %user_data_dir.display(),
        args = ?args,
        "launching headless Chrome for DOM capture"
    );

    let mut command = Command::new(&chrome);
    command.args(&args).kill_on_drop(true);
    let output_result = tokio::time::timeout(timeout, command.output()).await;
    let _ = std::fs::remove_dir_all(&user_data_dir);

    let output = output_result
        .map_err(|_| {
            WebCaptureError::BrowserError(format!(
                "Timed out waiting for headless Chrome to render {url}"
            ))
        })?
        .map_err(|e| WebCaptureError::BrowserError(format!("Failed to launch Chrome: {e}")))?;
    debug!(
        status = %output.status,
        stdout_bytes = output.stdout.len(),
        stderr_bytes = output.stderr.len(),
        stderr = %String::from_utf8_lossy(&output.stderr),
        "headless Chrome DOM capture finished"
    );

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

fn chrome_render_args(user_data_dir: &Path, url: &str) -> Vec<String> {
    let mut args = common_chrome_args(user_data_dir);
    args.extend([
        "--dump-dom".to_string(),
        "--timeout=30000".to_string(),
        "--virtual-time-budget=8000".to_string(),
        "--run-all-compositor-stages-before-draw".to_string(),
        "--window-size=1280,800".to_string(),
        url.to_string(),
    ]);
    args
}

fn common_chrome_args(user_data_dir: &Path) -> Vec<String> {
    vec![
        "--headless=new".to_string(),
        "--disable-gpu".to_string(),
        "--disable-extensions".to_string(),
        "--disable-dev-shm-usage".to_string(),
        "--disable-background-networking".to_string(),
        "--disable-component-update".to_string(),
        "--disable-default-apps".to_string(),
        "--disable-sync".to_string(),
        "--metrics-recording-only".to_string(),
        "--no-default-browser-check".to_string(),
        "--no-first-run".to_string(),
        "--no-sandbox".to_string(),
        format!("--user-data-dir={}", user_data_dir.display()),
    ]
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
        .map_or(0, |duration| duration.as_nanos());
    let seq = USER_DATA_DIR_COUNTER.fetch_add(1, Ordering::Relaxed);
    std::env::temp_dir().join(format!(
        "web-capture-chrome-{}-{nonce}-{seq}",
        std::process::id()
    ))
}

/// Capture a PNG screenshot of a URL
///
/// This function launches headless Chrome/Chromium, navigates to the URL,
/// and captures a full-page PNG screenshot.
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
/// Returns an error if Chrome/Chromium is unavailable or screenshot capture fails.
pub async fn capture_screenshot(url: &str) -> Result<Vec<u8>> {
    info!("Capturing screenshot for URL: {}", url);

    let chrome = find_chrome_executable().ok_or_else(|| {
        WebCaptureError::ScreenshotError(
            "Chrome/Chromium executable was not found. Set WEB_CAPTURE_CHROME, CHROME_PATH, or GOOGLE_CHROME_BIN.".to_string(),
        )
    })?;

    let user_data_dir = temporary_user_data_dir();
    std::fs::create_dir_all(&user_data_dir).map_err(|e| {
        WebCaptureError::ScreenshotError(format!("Failed to create temp user data dir: {e}"))
    })?;

    let screenshot_path = temporary_screenshot_path();
    let args = chrome_screenshot_args(&user_data_dir, &screenshot_path, url);
    debug!(
        chrome = %chrome.display(),
        user_data_dir = %user_data_dir.display(),
        screenshot_path = %screenshot_path.display(),
        args = ?args,
        "launching headless Chrome for screenshot capture"
    );

    let output_result = tokio::time::timeout(
        Duration::from_secs(60),
        Command::new(&chrome).args(&args).output(),
    )
    .await;
    let _ = std::fs::remove_dir_all(&user_data_dir);

    let output = output_result
        .map_err(|_| {
            WebCaptureError::ScreenshotError(format!(
                "Timed out waiting for headless Chrome to capture {url}"
            ))
        })?
        .map_err(|e| WebCaptureError::ScreenshotError(format!("Failed to launch Chrome: {e}")))?;
    debug!(
        status = %output.status,
        stdout_bytes = output.stdout.len(),
        stderr_bytes = output.stderr.len(),
        stderr = %String::from_utf8_lossy(&output.stderr),
        "headless Chrome screenshot capture finished"
    );

    if !output.status.success() {
        let _ = std::fs::remove_file(&screenshot_path);
        return Err(WebCaptureError::ScreenshotError(format!(
            "Headless Chrome failed with status {}: {}",
            output.status,
            String::from_utf8_lossy(&output.stderr)
        )));
    }

    let bytes = read_screenshot_bytes(&screenshot_path)?;
    let _ = std::fs::remove_file(&screenshot_path);

    if bytes.len() < 8 || &bytes[..8] != b"\x89PNG\r\n\x1a\n" {
        return Err(WebCaptureError::ScreenshotError(
            "Chrome screenshot output was not a valid PNG".to_string(),
        ));
    }

    info!("Successfully captured screenshot ({} bytes)", bytes.len());
    Ok(bytes)
}

fn temporary_screenshot_path() -> PathBuf {
    let nonce = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map_or(0, |duration| duration.as_nanos());
    std::env::temp_dir().join(format!(
        "web-capture-screenshot-{}-{nonce}.png",
        std::process::id()
    ))
}

fn chrome_screenshot_args(user_data_dir: &Path, screenshot_path: &Path, url: &str) -> Vec<String> {
    let mut args = common_chrome_args(user_data_dir);
    args.extend([
        "--hide-scrollbars".to_string(),
        "--window-size=1280,800".to_string(),
        "--timeout=30000".to_string(),
        format!("--screenshot={}", screenshot_path.display()),
        url.to_string(),
    ]);
    args
}

fn read_screenshot_bytes(path: &Path) -> Result<Vec<u8>> {
    std::fs::read(path).map_err(|e| {
        WebCaptureError::ScreenshotError(format!("Failed to read screenshot file: {e}"))
    })
}
