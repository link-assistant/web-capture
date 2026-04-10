//! Animation capture module (R2).
//!
//! Captures web animations as sequences of screenshots with
//! loop detection based on pixel similarity comparison.
//!
//! Supports three capture modes (concept):
//! - `screencast`: CDP-based push capture (30-60 FPS, Chromium only)
//! - `beginframe`: Deterministic frame-perfect capture (Chromium only)
//! - `screenshot`: Polling-based capture (3-8 FPS, cross-browser)
//!
//! Note: Full animation capture requires browser automation (browser-commander).
//! This module provides the core logic; browser integration is stubbed
//! until browser-commander is fully available.
//!
//! Based on reference implementation from:
//! <https://github.com/link-foundation/meta-theory/blob/main/scripts/capture-animation.mjs>

use serde::{Deserialize, Serialize};

/// Capture mode for animation.
#[derive(Debug, Clone, Copy, Default, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum CaptureMode {
    /// Polling-based capture (cross-browser compatible)
    #[default]
    Screenshot,
    /// CDP-based push capture (Chromium only)
    Screencast,
    /// Deterministic frame-perfect capture (Chromium only)
    Beginframe,
}

impl std::fmt::Display for CaptureMode {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            Self::Screenshot => write!(f, "screenshot"),
            Self::Screencast => write!(f, "screencast"),
            Self::Beginframe => write!(f, "beginframe"),
        }
    }
}

impl std::str::FromStr for CaptureMode {
    type Err = String;

    fn from_str(s: &str) -> Result<Self, Self::Err> {
        match s.to_lowercase().as_str() {
            "screenshot" => Ok(Self::Screenshot),
            "screencast" => Ok(Self::Screencast),
            "beginframe" => Ok(Self::Beginframe),
            _ => Err(format!("Unknown capture mode: {s}")),
        }
    }
}

/// Output format for animation.
#[derive(Debug, Clone, Copy, Default, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum AnimationFormat {
    #[default]
    Gif,
    PngSequence,
}

/// Options for animation capture.
#[allow(clippy::struct_excessive_bools)]
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AnimationOptions {
    pub max_size: u32,
    pub viewport_width: u32,
    pub viewport_height: u32,
    pub interval: u32,
    pub fps: Option<u32>,
    pub speed: f64,
    pub min_frames: u32,
    pub loop_timeout: u32,
    pub static_timeout: u32,
    pub similarity: f64,
    pub crop: bool,
    pub capture_mode: CaptureMode,
    pub format: AnimationFormat,
    pub extract_keyframes: bool,
    pub dismiss_popups: bool,
}

impl Default for AnimationOptions {
    fn default() -> Self {
        Self {
            max_size: 1024,
            viewport_width: 1920,
            viewport_height: 1080,
            interval: 0,
            fps: None,
            speed: 1.0,
            min_frames: 120,
            loop_timeout: 60,
            static_timeout: 60,
            similarity: 0.99,
            crop: true,
            capture_mode: CaptureMode::default(),
            format: AnimationFormat::default(),
            extract_keyframes: false,
            dismiss_popups: true,
        }
    }
}

/// A captured keyframe.
#[derive(Debug, Clone, Serialize)]
pub struct Keyframe {
    pub index: usize,
    #[serde(skip)]
    pub buffer: Vec<u8>,
}

/// Result of animation capture.
#[derive(Debug, Clone, Serialize)]
pub struct AnimationCaptureResult {
    #[serde(skip)]
    pub frames: Vec<Vec<u8>>,
    pub timestamps: Vec<u64>,
    pub loop_detected: bool,
    pub loop_frame: i64,
    pub total_frames: usize,
    pub duration: u64,
    pub keyframes: Option<Vec<Keyframe>>,
    pub width: u32,
    pub height: u32,
}

/// Compare two frame buffers for pixel similarity.
///
/// Returns a similarity score between 0.0 and 1.0.
#[must_use]
pub fn compare_frames(frame1: &[u8], frame2: &[u8]) -> f64 {
    if frame1.is_empty() || frame2.is_empty() {
        return 0.0;
    }
    if frame1.len() != frame2.len() {
        return 0.0;
    }

    let matching_bytes = frame1
        .iter()
        .zip(frame2.iter())
        .filter(|(a, b)| a == b)
        .count();

    #[allow(clippy::cast_precision_loss)]
    {
        matching_bytes as f64 / frame1.len() as f64
    }
}

/// Capture animation frames from a web page.
///
/// Note: Full browser automation requires browser-commander.
/// This implementation returns an error indicating the requirement.
#[allow(clippy::unused_async)]
pub async fn capture_animation_frames(
    url: &str,
    _options: &AnimationOptions,
) -> crate::Result<AnimationCaptureResult> {
    let _absolute_url = if url.starts_with("http") {
        url.to_string()
    } else {
        format!("https://{url}")
    };

    // Animation capture requires full browser automation
    Err(crate::WebCaptureError::BrowserError(
        "Animation capture requires Chrome/Chromium. Install it and enable browser-commander features.".to_string()
    ))
}
