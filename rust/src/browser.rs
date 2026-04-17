//! Browser automation module.
//!
//! This module provides headless browser operations for rendering pages and
//! capturing screenshots. For simpler HTTP fetching without JavaScript
//! rendering, see the HTML module.

use crate::{Result, WebCaptureError};
use chromiumoxide::browser::{Browser as ChromiumBrowser, BrowserConfig};
use chromiumoxide::page::ScreenshotParams;
use futures::StreamExt;
use serde_json::Value;
use std::future::Future;
use std::path::PathBuf;
use std::time::{Duration, SystemTime, UNIX_EPOCH};
use tracing::{debug, info, warn};

const DEFAULT_BROWSER_WAIT_MS: u64 = 1_000;
const DEFAULT_BROWSER_TIMEOUT_MS: u64 = 30_000;
const DEFAULT_GDOCS_BROWSER_WAIT_MS: u64 = 8_000;

/// Browser engine type
#[derive(Debug, Clone, Copy, PartialEq, Eq, Default)]
pub enum BrowserEngine {
    /// Chromiumoxide engine (default)
    #[default]
    Chromiumoxide,
}

/// Options used when rendering a page through Chromium.
#[derive(Debug, Clone)]
pub(crate) struct BrowserCaptureOptions {
    /// Extra time to wait after the browser reports initial navigation loaded.
    pub wait_after_load: Duration,
    /// Whether screenshots should include the full scrollable page.
    pub full_page: bool,
    /// Chromium launch timeout.
    pub launch_timeout: Duration,
    /// Chromium request timeout.
    pub request_timeout: Duration,
}

impl Default for BrowserCaptureOptions {
    fn default() -> Self {
        Self {
            wait_after_load: duration_from_env_ms(
                "WEB_CAPTURE_BROWSER_WAIT_MS",
                DEFAULT_BROWSER_WAIT_MS,
            ),
            full_page: true,
            launch_timeout: duration_from_env_ms(
                "WEB_CAPTURE_BROWSER_LAUNCH_TIMEOUT_MS",
                DEFAULT_BROWSER_TIMEOUT_MS,
            ),
            request_timeout: duration_from_env_ms(
                "WEB_CAPTURE_BROWSER_REQUEST_TIMEOUT_MS",
                DEFAULT_BROWSER_TIMEOUT_MS,
            ),
        }
    }
}

impl BrowserCaptureOptions {
    /// Options tuned for Google Docs editor-model capture.
    pub(crate) fn google_docs() -> Self {
        Self {
            wait_after_load: duration_from_env_ms(
                "WEB_CAPTURE_GDOCS_BROWSER_WAIT_MS",
                DEFAULT_GDOCS_BROWSER_WAIT_MS,
            ),
            ..Self::default()
        }
    }
}

/// HTML and optional JavaScript evaluation result from a browser-rendered page.
#[derive(Debug, Clone)]
pub(crate) struct BrowserRenderResult {
    /// Browser-rendered HTML.
    pub html: String,
    /// Optional value returned by an evaluation script after navigation.
    pub evaluation: Option<Value>,
}

struct RunningBrowser {
    browser: ChromiumBrowser,
    handler: tokio::task::JoinHandle<()>,
    user_data_dir: PathBuf,
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
    info!("Rendering HTML with headless Chromium for URL: {}", url);
    let result =
        render_html_with_scripts(url, None, None, BrowserCaptureOptions::default()).await?;
    info!(
        "Successfully rendered HTML with headless Chromium ({} bytes)",
        result.html.len()
    );
    Ok(result.html)
}

/// Render HTML with optional scripts installed before and after navigation.
pub(crate) async fn render_html_with_scripts(
    url: &str,
    init_script: Option<&str>,
    evaluation_script: Option<&str>,
    options: BrowserCaptureOptions,
) -> Result<BrowserRenderResult> {
    let mut running = launch_chromium(&options).await?;
    let result = render_with_running_browser(
        &running.browser,
        url,
        init_script,
        evaluation_script,
        &options,
    )
    .await;
    shutdown_chromium(&mut running).await;
    result
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
pub async fn capture_screenshot(url: &str) -> Result<Vec<u8>> {
    info!(
        "Capturing screenshot with headless Chromium for URL: {}",
        url
    );
    let options = BrowserCaptureOptions::default();
    let mut running = launch_chromium(&options).await?;
    let result = capture_screenshot_with_running_browser(&running.browser, url, &options).await;
    shutdown_chromium(&mut running).await;
    result
}

async fn render_with_running_browser(
    browser: &ChromiumBrowser,
    url: &str,
    init_script: Option<&str>,
    evaluation_script: Option<&str>,
    options: &BrowserCaptureOptions,
) -> Result<BrowserRenderResult> {
    let page = with_browser_timeout(
        options.request_timeout,
        "Failed to create browser page",
        browser.new_page("about:blank"),
    )
    .await?;

    if let Some(script) = init_script {
        with_browser_timeout(
            options.request_timeout,
            "Failed to install browser init script",
            page.evaluate_on_new_document(script),
        )
        .await?;
    }

    with_browser_timeout(
        options.request_timeout,
        "Failed to navigate browser page",
        page.goto(url),
    )
    .await?;
    wait_after_load(options).await;

    let evaluation = if let Some(script) = evaluation_script {
        let result = with_browser_timeout(
            options.request_timeout,
            "Failed to evaluate script in browser page",
            page.evaluate(script),
        )
        .await?;
        Some(result.into_value::<Value>().map_err(|error| {
            WebCaptureError::BrowserError(format!(
                "Failed to decode browser evaluation result: {error}"
            ))
        })?)
    } else {
        None
    };

    let html = with_browser_timeout(
        options.request_timeout,
        "Failed to read browser-rendered HTML",
        page.content(),
    )
    .await?;
    if let Err(error) = with_browser_timeout(
        options.request_timeout,
        "Failed to close browser page",
        page.close(),
    )
    .await
    {
        debug!("Failed to close browser page after HTML render: {}", error);
    }

    Ok(BrowserRenderResult { html, evaluation })
}

async fn capture_screenshot_with_running_browser(
    browser: &ChromiumBrowser,
    url: &str,
    options: &BrowserCaptureOptions,
) -> Result<Vec<u8>> {
    let page = with_browser_timeout(
        options.request_timeout,
        "Failed to create browser page",
        browser.new_page(url),
    )
    .await?;
    wait_after_load(options).await;

    let screenshot = with_browser_timeout(
        options.request_timeout,
        "Failed to capture browser screenshot",
        page.screenshot(
            ScreenshotParams::builder()
                .full_page(options.full_page)
                .build(),
        ),
    )
    .await
    .map_err(|error| WebCaptureError::ScreenshotError(error.to_string()))?;
    if let Err(error) = with_browser_timeout(
        options.request_timeout,
        "Failed to close browser page",
        page.close(),
    )
    .await
    {
        debug!("Failed to close browser page after screenshot: {}", error);
    }

    Ok(screenshot)
}

async fn launch_chromium(options: &BrowserCaptureOptions) -> Result<RunningBrowser> {
    let user_data_dir = temporary_user_data_dir();
    std::fs::create_dir_all(&user_data_dir).map_err(WebCaptureError::IoError)?;

    // browser-commander 0.9 exposes the shared Chromium automation arguments,
    // while page access is still handled through the underlying Chromiumoxide API.
    let mut chrome_args = browser_commander::LaunchOptions::chromiumoxide()
        .headless(true)
        .all_chrome_args();
    chrome_args.extend([
        "--disable-dev-shm-usage".to_string(),
        "--disable-gpu".to_string(),
    ]);

    let mut config = BrowserConfig::builder()
        .no_sandbox()
        .user_data_dir(&user_data_dir)
        .launch_timeout(options.launch_timeout)
        .request_timeout(options.request_timeout)
        .args(chrome_args);

    if let Some(executable) = chrome_executable_from_env() {
        config = config.chrome_executable(executable);
    }

    let (browser, mut handler) = ChromiumBrowser::launch(config.build().map_err(|error| {
        WebCaptureError::BrowserError(format!("Failed to configure Chromium browser: {error}"))
    })?)
    .await
    .map_err(|error| browser_error("Failed to launch Chromium browser", error))?;

    let handler = tokio::task::spawn(async move {
        while let Some(event) = handler.next().await {
            if let Err(error) = event {
                debug!("Chromium handler received recoverable error: {}", error);
            }
        }
    });

    info!("Launched headless Chromium through browser-commander configuration");
    Ok(RunningBrowser {
        browser,
        handler,
        user_data_dir,
    })
}

async fn shutdown_chromium(running: &mut RunningBrowser) {
    match tokio::time::timeout(Duration::from_secs(5), running.browser.close()).await {
        Ok(Ok(_)) => {}
        Ok(Err(error)) => debug!("Failed to close Chromium browser: {}", error),
        Err(_) => warn!("Timed out closing Chromium browser"),
    }
    match tokio::time::timeout(Duration::from_secs(5), running.browser.wait()).await {
        Ok(Ok(_)) => {}
        Ok(Err(error)) => debug!("Failed to wait for Chromium browser process: {}", error),
        Err(_) => warn!("Timed out waiting for Chromium browser process"),
    }
    running.handler.abort();
    if let Err(error) = (&mut running.handler).await {
        if !error.is_cancelled() {
            debug!("Chromium handler task failed: {}", error);
        }
    }
    if let Err(error) = std::fs::remove_dir_all(&running.user_data_dir) {
        debug!(
            "Failed to remove Chromium user data dir {}: {}",
            running.user_data_dir.display(),
            error
        );
    }
}

async fn wait_after_load(options: &BrowserCaptureOptions) {
    if options.wait_after_load.is_zero() {
        return;
    }
    debug!(
        wait_ms = options.wait_after_load.as_millis(),
        "waiting after browser navigation for dynamic page work"
    );
    tokio::time::sleep(options.wait_after_load).await;
}

fn temporary_user_data_dir() -> PathBuf {
    let nonce = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map_or(0, |duration| duration.as_nanos());
    std::env::temp_dir().join(format!(
        "web-capture-chromium-{}-{nonce}",
        std::process::id()
    ))
}

fn chrome_executable_from_env() -> Option<PathBuf> {
    std::env::var_os("WEB_CAPTURE_CHROME_PATH").map(PathBuf::from)
}

fn duration_from_env_ms(name: &str, default_ms: u64) -> Duration {
    std::env::var(name)
        .ok()
        .and_then(|value| value.parse::<u64>().ok())
        .map_or_else(|| Duration::from_millis(default_ms), Duration::from_millis)
}

async fn with_browser_timeout<T, E, F>(duration: Duration, context: &str, future: F) -> Result<T>
where
    E: std::fmt::Display,
    F: Future<Output = std::result::Result<T, E>>,
{
    match tokio::time::timeout(duration, future).await {
        Ok(Ok(value)) => Ok(value),
        Ok(Err(error)) => Err(browser_error(context, error)),
        Err(_) => Err(WebCaptureError::BrowserError(format!(
            "{context} timed out after {} ms",
            duration.as_millis()
        ))),
    }
}

fn browser_error(context: &str, error: impl std::fmt::Display) -> WebCaptureError {
    WebCaptureError::BrowserError(format!("{context}: {error}"))
}
