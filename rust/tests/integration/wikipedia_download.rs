//! Integration tests for downloading the Wikipedia page (issue #8).
//!
//! Verifies that web-capture can actually download the Wikipedia article about
//! Wikipedia itself (`https://en.wikipedia.org/wiki/Wikipedia`) as both Markdown
//! and an image (PNG screenshot) using the supported browser engine
//! (chromiumoxide — the single rendering engine exposed by the Rust crate).
//!
//! The tests in the `live` module fetch the page over the network and are gated
//! behind the `WIKIPEDIA_INTEGRATION` environment variable so default/offline CI
//! runs stay deterministic. They additionally short-circuit when no Chrome /
//! Chromium binary is available, mirroring the browser integration suite.

const WIKIPEDIA_URL: &str = "https://en.wikipedia.org/wiki/Wikipedia";

/// The supported rendering engine is `chromiumoxide` (aliased as `chrome`).
/// This offline assertion documents the engine the live tests exercise so the
/// "all supported engines" coverage is visible even in hermetic runs.
#[test]
fn supported_engine_is_chromiumoxide() {
    use web_capture::BrowserEngine;

    assert_eq!(BrowserEngine::default(), BrowserEngine::Chromiumoxide);
    assert_eq!(BrowserEngine::default().to_string(), "chromiumoxide");
}

#[test]
fn wikipedia_url_is_not_a_google_docs_url() {
    // Sanity check that the Wikipedia article routes through the generic
    // browser-capture path rather than the Google Docs special case.
    assert!(!web_capture::gdocs::is_google_docs_url(WIKIPEDIA_URL));
}

fn live_enabled() -> bool {
    matches!(
        std::env::var("WIKIPEDIA_INTEGRATION").as_deref(),
        Ok("1" | "true" | "TRUE")
    )
}

fn chrome_available() -> bool {
    std::env::var_os("WEB_CAPTURE_CHROME_PATH").is_some()
        || [
            "google-chrome",
            "google-chrome-stable",
            "chromium",
            "chromium-browser",
            "chrome",
        ]
        .iter()
        .any(|candidate| {
            std::process::Command::new(candidate)
                .arg("--version")
                .output()
                .is_ok()
        })
}

#[tokio::test]
async fn live_download_wikipedia_page_as_markdown() {
    if !live_enabled() {
        eprintln!("Skipping live Wikipedia markdown test; set WIKIPEDIA_INTEGRATION=1 to enable.");
        return;
    }
    if !chrome_available() {
        eprintln!("Skipping live Wikipedia markdown test because Chrome/Chromium is not installed");
        return;
    }

    let html = web_capture::render_html(WIKIPEDIA_URL)
        .await
        .expect("render Wikipedia page via browser engine");
    assert!(
        html.len() > 1000,
        "expected substantial HTML, got {} bytes",
        html.len()
    );

    let markdown = web_capture::convert_html_to_markdown(&html, Some(WIKIPEDIA_URL))
        .expect("convert Wikipedia HTML to markdown");

    assert!(
        markdown.contains("Wikipedia"),
        "expected markdown to mention Wikipedia"
    );
    assert!(
        markdown.len() > 500,
        "expected substantial markdown, got {} bytes",
        markdown.len()
    );
    // The conversion should strip the raw HTML document scaffolding.
    assert!(
        !markdown.to_lowercase().contains("<html"),
        "markdown should not contain raw <html> tags"
    );
}

#[tokio::test]
async fn live_download_wikipedia_page_as_image() {
    if !live_enabled() {
        eprintln!("Skipping live Wikipedia image test; set WIKIPEDIA_INTEGRATION=1 to enable.");
        return;
    }
    if !chrome_available() {
        eprintln!("Skipping live Wikipedia image test because Chrome/Chromium is not installed");
        return;
    }

    let screenshot = web_capture::capture_screenshot(WIKIPEDIA_URL)
        .await
        .expect("capture Wikipedia page screenshot via browser engine");

    assert!(
        screenshot.len() > 1000,
        "expected a non-trivial PNG, got {} bytes",
        screenshot.len()
    );
    // Verify the PNG magic number so we know it is a real image.
    assert_eq!(
        &screenshot[..8],
        b"\x89PNG\r\n\x1a\n",
        "expected a valid PNG signature"
    );
}
