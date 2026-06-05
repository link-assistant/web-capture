//! Integration tests for downloading the Stack Overflow page from issue #11.
//!
//! Live tests are gated behind `STACKOVERFLOW_INTEGRATION` so default and
//! offline runs stay deterministic. The tests exercise the real issue URL as
//! HTML, Markdown, plain text, archive, and PNG screenshot using the Rust
//! implementation's supported capture surface.

use std::io::{Cursor, Read};
use std::path::PathBuf;

const STACKOVERFLOW_URL: &str =
    "https://stackoverflow.com/questions/927358/how-do-i-undo-the-most-recent-local-commits-in-git";
const STACKOVERFLOW_TITLE: &str = "How do I undo the most recent local commits in Git";

/// The supported rendering engine is `chromiumoxide` (aliased as `chrome`).
/// This offline assertion documents the engine the live screenshot test covers.
#[test]
fn supported_engine_is_chromiumoxide() {
    use web_capture::BrowserEngine;

    assert_eq!(BrowserEngine::default(), BrowserEngine::Chromiumoxide);
    assert_eq!(BrowserEngine::default().to_string(), "chromiumoxide");
}

#[test]
fn stackoverflow_url_routes_through_generic_capture() {
    assert!(!web_capture::gdocs::is_google_docs_url(STACKOVERFLOW_URL));
    assert!(!web_capture::github::is_github_repository_url(
        STACKOVERFLOW_URL
    ));
    assert!(!web_capture::xpaste::is_text_paste_url(STACKOVERFLOW_URL));
}

#[test]
fn recognizes_stackoverflow_question_urls() {
    assert!(web_capture::stackoverflow::is_stackoverflow_question_url(
        STACKOVERFLOW_URL
    ));
    assert!(!web_capture::stackoverflow::is_stackoverflow_question_url(
        "https://stackoverflow.com/questions/tagged/git"
    ));
    assert!(!web_capture::stackoverflow::is_stackoverflow_question_url(
        "https://serverfault.com/questions/927358"
    ));
}

#[test]
fn builds_stackprinter_url_for_direct_captures() {
    assert_eq!(
        web_capture::stackoverflow::stackprinter_url(STACKOVERFLOW_URL).as_deref(),
        Some(
            "https://stackprinter.appspot.com/export?question=927358&service=stackoverflow&language=en&hideAnswers=false&showAll=true&width=640"
        )
    );
}

fn live_enabled() -> bool {
    matches!(
        std::env::var("STACKOVERFLOW_INTEGRATION").as_deref(),
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

fn web_capture_binary() -> PathBuf {
    if let Some(path) = std::env::var_os("CARGO_BIN_EXE_web-capture") {
        return PathBuf::from(path);
    }

    let mut path = std::env::current_exe().unwrap();
    path.pop();
    if path.file_name().is_some_and(|name| name == "deps") {
        path.pop();
    }
    path.push(if cfg!(windows) {
        "web-capture.exe"
    } else {
        "web-capture"
    });
    path
}

async fn run_cli_capture(args: &[&str]) -> Vec<u8> {
    let output = tokio::process::Command::new(web_capture_binary())
        .arg(STACKOVERFLOW_URL)
        .args(args)
        .env_remove("RUST_LOG")
        .output()
        .await
        .expect("run web-capture CLI");

    let stderr = String::from_utf8_lossy(&output.stderr);
    assert!(
        output.status.success(),
        "CLI failed with status {:?}: {stderr}",
        output.status.code()
    );
    output.stdout
}

fn assert_stackoverflow_text(content: &str) {
    assert!(
        content.contains(STACKOVERFLOW_TITLE),
        "expected StackOverflow title in content: {content}"
    );
    assert!(
        content.to_ascii_lowercase().contains("stack overflow"),
        "expected Stack Overflow branding in content"
    );
    assert!(
        content.to_ascii_lowercase().contains("git"),
        "expected git-related page content"
    );
}

#[tokio::test]
async fn live_download_stackoverflow_page_as_document_formats() {
    if !live_enabled() {
        eprintln!(
            "Skipping live StackOverflow document-format test; set STACKOVERFLOW_INTEGRATION=1 to enable."
        );
        return;
    }

    let stdout = run_cli_capture(&["--format", "html", "--capture", "api", "--output", "-"]).await;
    let html = String::from_utf8(stdout).expect("HTML output should be UTF-8");

    assert_stackoverflow_text(&html);
    assert!(
        html.to_ascii_lowercase().contains("<html"),
        "expected raw HTML document output"
    );
    assert!(
        html.len() > 1000,
        "expected substantial HTML, got {} bytes",
        html.len()
    );

    let stdout =
        run_cli_capture(&["--format", "markdown", "--capture", "api", "--output", "-"]).await;
    let markdown = String::from_utf8(stdout).expect("Markdown output should be UTF-8");

    assert_stackoverflow_text(&markdown);
    assert!(
        !markdown.to_ascii_lowercase().contains("<html"),
        "markdown should not contain raw <html> tags"
    );
    assert!(
        markdown.len() > 500,
        "expected substantial markdown, got {} bytes",
        markdown.len()
    );

    let stdout = run_cli_capture(&["--format", "txt", "--output", "-"]).await;
    let text = String::from_utf8(stdout).expect("text output should be UTF-8");

    assert_stackoverflow_text(&text);
    assert!(
        text.len() > 1000,
        "expected substantial text, got {} bytes",
        text.len()
    );

    let archive = run_cli_capture(&["--archive", "zip", "--capture", "api", "--output", "-"]).await;
    assert!(
        archive.len() > 1000,
        "expected a non-trivial ZIP, got {} bytes",
        archive.len()
    );
    assert_eq!(&archive[..2], b"PK", "expected a ZIP signature");

    let mut zip = zip::ZipArchive::new(Cursor::new(archive)).expect("open StackOverflow ZIP");
    let names = (0..zip.len())
        .map(|index| {
            zip.by_index(index)
                .expect("read ZIP entry")
                .name()
                .to_string()
        })
        .collect::<Vec<_>>();
    assert!(names.iter().any(|name| name == "document.md"), "{names:?}");
    assert!(
        names.iter().any(|name| name == "document.html"),
        "{names:?}"
    );

    let mut markdown = String::new();
    zip.by_name("document.md")
        .expect("document.md entry")
        .read_to_string(&mut markdown)
        .expect("read document.md");
    assert_stackoverflow_text(&markdown);
}

#[tokio::test]
async fn live_download_stackoverflow_page_as_image() {
    if !live_enabled() {
        eprintln!(
            "Skipping live StackOverflow image test; set STACKOVERFLOW_INTEGRATION=1 to enable."
        );
        return;
    }
    if !chrome_available() {
        eprintln!(
            "Skipping live StackOverflow image test because Chrome/Chromium is not installed"
        );
        return;
    }

    let screenshot = web_capture::capture_screenshot(STACKOVERFLOW_URL)
        .await
        .expect("capture StackOverflow page screenshot");

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
