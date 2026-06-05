//! Dual-themed screenshot capture module (R3).
//!
//! Captures screenshots in both light and dark themes in a single operation.
//! Uses separate browser contexts for reliable `colorScheme` application.
//!
//! Note: Full browser automation requires browser-commander.
//! This module provides the types and options; browser integration is stubbed
//! until browser-commander is fully available.
//!
//! Based on reference implementation from:
//! <https://github.com/link-foundation/meta-theory/blob/main/scripts/download.mjs>

use serde::{Deserialize, Serialize};

/// Color theme for screenshot capture.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum Theme {
    Light,
    Dark,
}

impl std::fmt::Display for Theme {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            Self::Light => write!(f, "light"),
            Self::Dark => write!(f, "dark"),
        }
    }
}

impl std::str::FromStr for Theme {
    type Err = String;

    fn from_str(s: &str) -> Result<Self, Self::Err> {
        match s.to_lowercase().as_str() {
            "light" => Ok(Self::Light),
            "dark" => Ok(Self::Dark),
            _ => Err(format!("Unknown theme: {s}. Use 'light' or 'dark'")),
        }
    }
}

/// Options for themed screenshot capture.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ThemedImageOptions {
    pub width: u32,
    pub height: u32,
    pub full_page: bool,
    pub dismiss_popups: bool,
}

impl Default for ThemedImageOptions {
    fn default() -> Self {
        Self {
            width: 1920,
            height: 1080,
            full_page: true,
            dismiss_popups: true,
        }
    }
}

/// Result of dual-theme screenshot capture.
#[derive(Debug, Clone, Serialize)]
pub struct DualThemeResult {
    /// Light theme screenshot PNG data.
    #[serde(skip)]
    pub light: Vec<u8>,
    /// Dark theme screenshot PNG data.
    #[serde(skip)]
    pub dark: Vec<u8>,
    pub url: String,
    pub width: u32,
    pub height: u32,
    pub light_size: usize,
    pub dark_size: usize,
}

/// Capture screenshots in both light and dark themes.
///
/// Note: Full browser automation requires browser-commander.
/// This implementation returns an error indicating the requirement.
#[allow(clippy::unused_async)]
pub async fn capture_dual_theme_screenshots(
    url: &str,
    _options: &ThemedImageOptions,
) -> crate::Result<DualThemeResult> {
    let _absolute_url = if url.starts_with("http") {
        url.to_string()
    } else {
        format!("https://{url}")
    };

    Err(crate::WebCaptureError::ScreenshotError(
        "Dual-theme screenshot capture requires Chrome/Chromium. Install it and enable browser-commander features.".to_string()
    ))
}
