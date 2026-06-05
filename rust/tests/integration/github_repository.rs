//! Integration tests for capturing GitHub repository pages (issue #5).
//!
//! Live tests are gated behind `GITHUB_REPOSITORY_INTEGRATION` so default and
//! offline runs stay deterministic. They verify that a real GitHub repository
//! can be captured as compact text/markdown, original HTML, and a PNG screenshot
//! through the Rust implementation.

const DEFAULT_REPOSITORY_URL: &str = "https://github.com/link-assistant/web-capture";

fn repository_url() -> String {
    std::env::var("GITHUB_REPOSITORY_URL").unwrap_or_else(|_| DEFAULT_REPOSITORY_URL.to_string())
}

fn live_enabled() -> bool {
    matches!(
        std::env::var("GITHUB_REPOSITORY_INTEGRATION").as_deref(),
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

#[test]
fn detects_default_github_repository_url() {
    assert!(web_capture::github::is_github_repository_url(
        DEFAULT_REPOSITORY_URL
    ));
    assert!(!web_capture::github::is_github_repository_url(
        "https://github.com/link-assistant/web-capture/issues"
    ));
}

#[tokio::test]
async fn live_download_repository_as_text_and_markdown() {
    if !live_enabled() {
        eprintln!(
            "Skipping live GitHub repository text/markdown test; set GITHUB_REPOSITORY_INTEGRATION=1 to enable."
        );
        return;
    }

    let url = repository_url();
    let parsed = web_capture::github::parse_github_repository_url(&url)
        .expect("GITHUB_REPOSITORY_URL should be a plain repository URL");
    let snapshot = web_capture::github::fetch_github_repository_snapshot(&url)
        .await
        .expect("fetch GitHub repository snapshot");
    let text = web_capture::github::format_github_repository_text(&snapshot);
    let markdown = web_capture::github::format_github_repository_markdown(&snapshot);

    assert!(text.contains(&format!("Repository: {}", parsed.full_name)));
    assert!(text.contains("Files:"));
    assert!(text.to_ascii_lowercase().contains("readme"));
    assert!(
        text.len() > 500,
        "expected substantial text, got {} bytes",
        text.len()
    );

    assert!(markdown.contains(&format!("# {}", parsed.full_name)));
    assert!(markdown.contains("## Files"));
    assert!(markdown.to_ascii_lowercase().contains("readme"));
    assert!(
        markdown.len() > 500,
        "expected substantial markdown, got {} bytes",
        markdown.len()
    );
    assert!(
        !markdown.to_ascii_lowercase().contains("<html"),
        "markdown should not contain raw <html> tags"
    );
}

#[tokio::test]
async fn live_download_repository_as_original_html() {
    if !live_enabled() {
        eprintln!(
            "Skipping live GitHub repository HTML test; set GITHUB_REPOSITORY_INTEGRATION=1 to enable."
        );
        return;
    }

    let url = repository_url();
    let parsed = web_capture::github::parse_github_repository_url(&url)
        .expect("GITHUB_REPOSITORY_URL should be a plain repository URL");
    let html = web_capture::fetch_html(&url)
        .await
        .expect("fetch GitHub repository HTML");

    assert!(html.to_ascii_lowercase().contains("<html"));
    assert!(html.contains(&parsed.owner), "{html}");
    assert!(html.contains(&parsed.repo), "{html}");
    assert!(
        html.len() > 1000,
        "expected substantial HTML, got {} bytes",
        html.len()
    );
}

#[tokio::test]
async fn live_capture_repository_as_png() {
    if !live_enabled() {
        eprintln!(
            "Skipping live GitHub repository screenshot test; set GITHUB_REPOSITORY_INTEGRATION=1 to enable."
        );
        return;
    }
    if !chrome_available() {
        eprintln!("Skipping live GitHub repository screenshot test because Chrome/Chromium is not installed");
        return;
    }

    let screenshot = web_capture::capture_screenshot(&repository_url())
        .await
        .expect("capture GitHub repository screenshot");

    assert!(
        screenshot.len() > 1000,
        "expected a non-trivial PNG, got {} bytes",
        screenshot.len()
    );
    assert_eq!(
        &screenshot[..8],
        b"\x89PNG\r\n\x1a\n",
        "expected a valid PNG signature"
    );
}
