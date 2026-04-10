//! Google Docs capture module.
//!
//! Supports API-based capture of Google Docs documents via the export URL pattern:
//! `https://docs.google.com/document/d/{DOCUMENT_ID}/export?format={FORMAT}`
//!
//! # Supported Export Formats
//!
//! - `html` — HTML document (images as base64 data URIs)
//! - `txt` — Plain text
//! - `md` — Markdown (native Google Docs export)
//! - `pdf` — PDF document
//! - `docx` — Microsoft Word document
//! - `epub` — EPUB ebook format
//!
//! # Example
//!
//! ```rust,no_run
//! use web_capture::gdocs;
//!
//! #[tokio::main]
//! async fn main() -> anyhow::Result<()> {
//!     let url = "https://docs.google.com/document/d/abc123/edit";
//!     if gdocs::is_google_docs_url(url) {
//!         let result = gdocs::fetch_google_doc(url, "html", None).await?;
//!         println!("Content length: {}", result.content.len());
//!     }
//!     Ok(())
//! }
//! ```

use regex::Regex;
use std::sync::OnceLock;

use crate::WebCaptureError;

const GDOCS_EXPORT_BASE: &str = "https://docs.google.com/document/d";

fn gdocs_url_pattern() -> &'static Regex {
    static PATTERN: OnceLock<Regex> = OnceLock::new();
    PATTERN.get_or_init(|| Regex::new(r"docs\.google\.com/document/d/([a-zA-Z0-9_-]+)").unwrap())
}

/// Result of fetching a Google Docs document.
#[derive(Debug, Clone)]
pub struct GDocsResult {
    /// The document content in the requested format.
    pub content: String,
    /// The export format used.
    pub format: String,
    /// The extracted document ID.
    pub document_id: String,
    /// The export URL that was fetched.
    pub export_url: String,
}

/// Check if a URL is a Google Docs document URL.
#[must_use]
pub fn is_google_docs_url(url: &str) -> bool {
    gdocs_url_pattern().is_match(url)
}

/// Extract the document ID from a Google Docs URL.
///
/// Returns `None` if the URL is not a valid Google Docs URL.
#[must_use]
pub fn extract_document_id(url: &str) -> Option<String> {
    gdocs_url_pattern()
        .captures(url)
        .and_then(|caps| caps.get(1))
        .map(|m| m.as_str().to_string())
}

/// Build a Google Docs export URL.
///
/// # Arguments
///
/// * `document_id` - The Google Docs document ID
/// * `format` - Export format (html, txt, md, pdf, docx, epub)
#[must_use]
pub fn build_export_url(document_id: &str, format: &str) -> String {
    let export_format = match format {
        "html" | "txt" | "md" | "pdf" | "docx" | "epub" | "zip" => format,
        _ => "html",
    };
    format!("{GDOCS_EXPORT_BASE}/{document_id}/export?format={export_format}")
}

/// Fetch a Google Docs document via the export URL.
///
/// For public documents, pass `None` for `api_token`.
/// For private documents, pass a Bearer token string.
///
/// # Arguments
///
/// * `url` - Google Docs URL (edit URL or any URL containing the document ID)
/// * `format` - Export format (html, txt, md, pdf, docx, epub)
/// * `api_token` - Optional API token for private documents
///
/// # Errors
///
/// Returns an error if the URL is not a valid Google Docs URL, or if the fetch fails.
pub async fn fetch_google_doc(
    url: &str,
    format: &str,
    api_token: Option<&str>,
) -> crate::Result<GDocsResult> {
    let document_id = extract_document_id(url).ok_or_else(|| {
        WebCaptureError::InvalidUrl(format!("Not a valid Google Docs URL: {url}"))
    })?;

    let export_url = build_export_url(&document_id, format);

    let mut request = reqwest::Client::new()
        .get(&export_url)
        .header(
            "User-Agent",
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        )
        .header("Accept-Charset", "utf-8")
        .header("Accept-Language", "en-US,en;q=0.9");

    if let Some(token) = api_token {
        request = request.header("Authorization", format!("Bearer {token}"));
    }

    let response = request
        .send()
        .await
        .map_err(|e| WebCaptureError::FetchError(format!("Failed to fetch Google Doc: {e}")))?;

    if !response.status().is_success() {
        return Err(WebCaptureError::FetchError(format!(
            "Failed to fetch Google Doc ({} {}): {}",
            response.status().as_u16(),
            response.status().canonical_reason().unwrap_or("Unknown"),
            export_url
        )));
    }

    let raw_content = response.text().await.map_err(|e| {
        WebCaptureError::FetchError(format!("Failed to read Google Doc response: {e}"))
    })?;

    // Decode HTML entities to unicode for text-based formats
    let content = match format {
        "html" | "txt" | "md" => crate::html::decode_html_entities(&raw_content),
        _ => raw_content,
    };

    Ok(GDocsResult {
        content,
        format: format.to_string(),
        document_id,
        export_url,
    })
}

/// Fetch a Google Docs document and convert to Markdown.
///
/// Fetches the document as HTML, then converts to Markdown using the
/// existing HTML-to-Markdown pipeline.
///
/// # Arguments
///
/// * `url` - Google Docs URL
/// * `api_token` - Optional API token for private documents
///
/// # Errors
///
/// Returns an error if the fetch or conversion fails.
pub async fn fetch_google_doc_as_markdown(
    url: &str,
    api_token: Option<&str>,
) -> crate::Result<GDocsResult> {
    let result = fetch_google_doc(url, "html", api_token).await?;

    let markdown =
        crate::markdown::convert_html_to_markdown(&result.content, Some(&result.export_url))?;

    Ok(GDocsResult {
        content: markdown,
        format: "markdown".to_string(),
        document_id: result.document_id,
        export_url: result.export_url,
    })
}

/// Extract a Bearer token from an Authorization header value.
///
/// Returns `None` if the header is not a valid Bearer token.
#[must_use]
pub fn extract_bearer_token(auth_header: &str) -> Option<&str> {
    let trimmed = auth_header.trim();
    trimmed
        .strip_prefix("Bearer ")
        .or_else(|| trimmed.strip_prefix("bearer "))
        .map(str::trim)
        .filter(|t| !t.is_empty())
}
