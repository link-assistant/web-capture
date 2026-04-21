//! Integration tests for the public Google Docs test document referenced in
//! issue #90 (`https://docs.google.com/document/d/1f5zI2xOFpKa90v0GjamO_t7lqSdzMlaM/edit`).
//!
//! The tests in the `offline` module are always executed and cover the URL
//! variation surface and capture-method selection for the public document ID
//! so regressions show up even in hermetic CI runs.
//!
//! The tests in the `live` module fetch the public document over the network
//! and are gated behind the `GDOCS_INTEGRATION=1` environment variable to keep
//! default CI runs deterministic.
//!
//! See `docs/case-studies/issue-90/` for the full case study, timeline, root
//! cause analysis and reference fixtures.
use std::env;
use std::fs;
use std::path::PathBuf;

use web_capture::gdocs::{
    build_docs_api_url, build_edit_url, build_export_url, extract_document_id,
    fetch_google_doc_from_model, is_google_docs_url, select_capture_method, GDocsCaptureMethod,
    GDocsRenderedResult,
};

const PUBLIC_DOCUMENT_ID: &str = "1f5zI2xOFpKa90v0GjamO_t7lqSdzMlaM";

const URL_VARIATIONS: &[&str] = &[
    "https://docs.google.com/document/d/1f5zI2xOFpKa90v0GjamO_t7lqSdzMlaM",
    "https://docs.google.com/document/d/1f5zI2xOFpKa90v0GjamO_t7lqSdzMlaM/edit",
    "https://docs.google.com/document/d/1f5zI2xOFpKa90v0GjamO_t7lqSdzMlaM/edit?usp=sharing",
    "https://docs.google.com/document/d/1f5zI2xOFpKa90v0GjamO_t7lqSdzMlaM/edit?usp=sharing&ouid=102030405060708090100&rtpof=true&sd=true",
    "https://docs.google.com/document/d/1f5zI2xOFpKa90v0GjamO_t7lqSdzMlaM/edit?tab=t.0",
];

// Feature-section headings documented in issue #90. Every capture should
// preserve each heading regardless of capture mode.
const SECTION_HEADINGS: &[&str] = &[
    "Markdown Feature Test Document",
    "1. Headings",
    "2. Inline Formatting",
    "3. Paragraphs",
    "4. Blockquotes",
    "5. Unordered Lists",
    "6. Ordered Lists",
    "7. Mixed Lists",
    "8. Tables",
    "9. Links",
    "10. Images",
    "11. Horizontal Rules",
    "12. Special Characters",
    "13. Nested Formatting Edge Cases",
    "14. Empty and Minimal Table Content",
];

fn reference_markdown_path() -> PathBuf {
    // `CARGO_MANIFEST_DIR` resolves to `rust/` when cargo runs the tests.
    PathBuf::from(env!("CARGO_MANIFEST_DIR"))
        .join("..")
        .join("docs")
        .join("case-studies")
        .join("issue-90")
        .join("reference")
        .join("markdown-test-document.md")
}

#[test]
fn public_document_is_recognized_across_every_url_variation() {
    for url in URL_VARIATIONS {
        assert!(
            is_google_docs_url(url),
            "expected {url} to be recognized as a Google Docs URL"
        );
    }
}

#[test]
fn public_document_id_is_extracted_from_every_url_variation() {
    for url in URL_VARIATIONS {
        let extracted = extract_document_id(url);
        assert_eq!(
            extracted.as_deref(),
            Some(PUBLIC_DOCUMENT_ID),
            "expected document ID {PUBLIC_DOCUMENT_ID} to be extracted from {url}, got {extracted:?}"
        );
    }
}

#[test]
fn urls_for_the_public_document_are_built_with_the_expected_shape() {
    assert_eq!(
        build_export_url(PUBLIC_DOCUMENT_ID, "html"),
        format!("https://docs.google.com/document/d/{PUBLIC_DOCUMENT_ID}/export?format=html")
    );
    assert_eq!(
        build_edit_url(PUBLIC_DOCUMENT_ID),
        format!("https://docs.google.com/document/d/{PUBLIC_DOCUMENT_ID}/edit")
    );
    assert_eq!(
        build_docs_api_url(PUBLIC_DOCUMENT_ID),
        format!("https://docs.googleapis.com/v1/documents/{PUBLIC_DOCUMENT_ID}")
    );
}

#[test]
fn capture_method_selection_is_locked_to_issue_72_semantics() {
    assert_eq!(
        select_capture_method("browser", None).unwrap(),
        GDocsCaptureMethod::BrowserModel
    );
    assert_eq!(
        select_capture_method("api", None).unwrap(),
        GDocsCaptureMethod::PublicExport
    );
    assert_eq!(
        select_capture_method("api", Some("token")).unwrap(),
        GDocsCaptureMethod::DocsApi
    );
    assert!(select_capture_method("unsupported", None).is_err());
}

#[test]
fn reference_markdown_contains_every_feature_section() {
    let path = reference_markdown_path();
    let markdown = fs::read_to_string(&path).unwrap_or_else(|err| {
        panic!(
            "failed to read reference markdown at {}: {err}",
            path.display()
        )
    });

    for section in SECTION_HEADINGS {
        assert!(
            markdown.contains(section),
            "reference markdown is missing section `{section}` (path: {})",
            path.display()
        );
    }
}

#[test]
fn reference_markdown_embeds_the_four_test_images() {
    let path = reference_markdown_path();
    let markdown = fs::read_to_string(&path).expect("reference markdown must be present");

    for alt in [
        "Blue rectangle",
        "Red rectangle",
        "Green square",
        "Yellow square",
    ] {
        assert!(
            markdown.contains(&format!("![{alt}](media/")),
            "reference markdown is missing the {alt} image"
        );
    }
}

// --- Live tests -------------------------------------------------------------

fn live_enabled() -> bool {
    matches!(
        env::var("GDOCS_INTEGRATION").as_deref(),
        Ok("1" | "true" | "TRUE")
    )
}

// Google Docs occasionally returns transient 500s on the public-export
// endpoint. The Habr integration suite in the JS codebase uses a retry
// helper to smooth this flake; Rust's test crate doesn't pull in a retry
// dependency so we roll a tiny inline retry loop with exponential backoff.
async fn fetch_with_retry(url: &str) -> web_capture::Result<web_capture::gdocs::GDocsResult> {
    let mut last_err: Option<web_capture::WebCaptureError> = None;
    let mut delay_ms = 2000u64;
    for attempt in 0..4 {
        match web_capture::gdocs::fetch_google_doc_as_markdown(url, None).await {
            Ok(result) => return Ok(result),
            Err(err) => {
                eprintln!(
                    "gdocs fetch attempt {} failed: {err} (retrying in {}ms)",
                    attempt + 1,
                    delay_ms
                );
                last_err = Some(err);
                tokio::time::sleep(std::time::Duration::from_millis(delay_ms)).await;
                delay_ms *= 2;
            }
        }
    }
    Err(last_err.expect("retry loop should record the last error"))
}

async fn fetch_browser_model_with_retry(url: &str) -> web_capture::Result<GDocsRenderedResult> {
    let mut last_err: Option<web_capture::WebCaptureError> = None;
    let mut delay_ms = 2000u64;
    for attempt in 0..3 {
        match fetch_google_doc_from_model(url, None).await {
            Ok(result) => return Ok(result),
            Err(err) => {
                eprintln!(
                    "gdocs browser-model capture attempt {} failed: {err} (retrying in {}ms)",
                    attempt + 1,
                    delay_ms
                );
                last_err = Some(err);
                tokio::time::sleep(std::time::Duration::from_millis(delay_ms)).await;
                delay_ms *= 2;
            }
        }
    }
    Err(last_err.expect("retry loop should record the last error"))
}

#[tokio::test]
async fn live_capture_of_public_document_preserves_every_section() {
    if !live_enabled() {
        eprintln!("Skipping live Google Docs capture test; set GDOCS_INTEGRATION=1 to enable.");
        return;
    }

    let url = format!("https://docs.google.com/document/d/{PUBLIC_DOCUMENT_ID}/edit");
    let result = fetch_with_retry(&url)
        .await
        .expect("public document should be reachable without a token");

    assert_eq!(result.document_id, PUBLIC_DOCUMENT_ID);
    assert!(
        result.content.len() > 1000,
        "captured markdown unexpectedly short: {} bytes",
        result.content.len()
    );
    // The public-export HTML-to-Markdown pipeline escapes dots after leading
    // numerals (e.g. `1\. Headings`). That defect is tracked as R2 in the
    // case study; until it is fixed we normalise the escapes so this
    // regression guard only covers content preservation. See
    // docs/case-studies/issue-90/README.md for the follow-up plan.
    let normalized = result
        .content
        .replace("\\.", ".")
        .replace("\\!", "!")
        .replace("\\(", "(")
        .replace("\\)", ")")
        .replace("\\[", "[")
        .replace("\\]", "]");
    for section in SECTION_HEADINGS {
        assert!(
            normalized.contains(section),
            "captured markdown is missing section `{section}`"
        );
    }
}

#[tokio::test]
async fn live_browser_model_capture_of_public_document_preserves_markdown_features() {
    if !live_enabled() {
        eprintln!(
            "Skipping live Google Docs browser-model capture test; set GDOCS_INTEGRATION=1 to enable."
        );
        return;
    }

    let url = format!("https://docs.google.com/document/d/{PUBLIC_DOCUMENT_ID}/edit");
    let result = fetch_browser_model_with_retry(&url)
        .await
        .expect("public document should be capturable from the editor model");

    assert_eq!(result.document_id, PUBLIC_DOCUMENT_ID);
    assert_eq!(result.export_url, build_edit_url(PUBLIC_DOCUMENT_ID));
    assert!(
        result.markdown.len() > 2500,
        "captured browser-model markdown unexpectedly short: {} bytes",
        result.markdown.len()
    );
    assert!(result.markdown.contains("# Markdown Feature Test Document"));
    assert!(result.markdown.contains("## 1. Headings"));
    assert!(result.markdown.contains("**This text is bold**"));
    assert!(result.markdown.contains("*This text is italic*"));
    assert!(result.markdown.contains("~~This text has strikethrough~~"));
    assert!(result
        .markdown
        .contains("> This is a single-level blockquote"));
    assert!(result
        .markdown
        .contains("[Regular link](https://example.com)"));
    assert!(result.markdown.contains("| Feature | Supported | Notes |"));
    assert!(!result.markdown.contains("| Feature |  | Supported |"));
    assert!(result.markdown.contains("|  | x |  |"));
    assert!(result.markdown.contains("1. Parent item 1"));
    assert!(result.markdown.contains("    1. Child item 1.1"));
    assert!(result.markdown.contains("        1. Grandchild item 1.2.1"));
    assert!(!result.markdown.contains("- Child item 1.1"));
    assert!(!result.markdown.contains("1. Parent item 1\n\n"));
    assert!(result.markdown.contains("![Blue rectangle]("));
    assert!(result.markdown.contains("docs-images-rt/"));
    assert!(result.remote_images.len() >= 4);
    assert!(result.markdown.contains("---"));
}
