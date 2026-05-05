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

use async_tungstenite::tokio::{connect_async, ConnectStream};
use async_tungstenite::tungstenite::Message;
use async_tungstenite::WebSocketStream;
use base64::Engine;
use futures::{SinkExt, StreamExt};
use regex::Regex;
use scraper::{node::Node, ElementRef, Html, Selector};
use serde_json::Value;
use std::collections::HashMap;
use std::fmt::Write as _;
use std::hash::BuildHasher;
use std::io::Write;
use std::process::Stdio;
use std::sync::OnceLock;
use std::time::{Duration, Instant};
use tokio::io::{AsyncBufReadExt, BufReader};
use tokio::process::{Child, Command};
use tracing::{debug, info, warn};

use crate::WebCaptureError;

const GDOCS_EXPORT_BASE: &str = "https://docs.google.com/document/d";
const GDOCS_API_BASE: &str = "https://docs.googleapis.com/v1/documents";
const GDOCS_USER_AGENT: &str =
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";
const GDOCS_EDITOR_MODEL_MAX_WAIT_DEFAULT: Duration = Duration::from_secs(30);
const GDOCS_EDITOR_MODEL_STABILITY_DEFAULT: Duration = Duration::from_millis(1500);
const GDOCS_EDITOR_MODEL_POLL_INTERVAL: Duration = Duration::from_millis(250);
const GDOCS_BROWSER_LAUNCH_TIMEOUT: Duration = Duration::from_secs(20);

type CdpWebSocket = WebSocketStream<ConnectStream>;

const GDOCS_MODEL_CAPTURE_INIT_SCRIPT: &str = r"
window.__captured_chunks = [];
const captureChunk = (value) => {
  if (!value) {
    return;
  }
  if (Array.isArray(value)) {
    for (const item of value) {
      captureChunk(item);
    }
    return;
  }
  try {
    window.__captured_chunks.push(JSON.parse(JSON.stringify(value)));
  } catch {
    window.__captured_chunks.push(value);
  }
};
const wrapChunkArray = (value) => {
  if (!Array.isArray(value) || value.__webCaptureDocsModelWrapped) {
    return value;
  }
  const originalPush = value.push;
  Object.defineProperty(value, '__webCaptureDocsModelWrapped', {
    value: true,
    enumerable: false,
  });
  Object.defineProperty(value, 'push', {
    value(...items) {
      for (const item of items) {
        captureChunk(item);
      }
      return originalPush.apply(this, items);
    },
    writable: true,
    configurable: true,
  });
  for (const item of value) {
    captureChunk(item);
  }
  return value;
};
Object.defineProperty(window, 'DOCS_modelChunk', {
  set(value) {
    captureChunk(value);
    window.__DOCS_modelChunk_latest = wrapChunkArray(value);
  },
  get() {
    return window.__DOCS_modelChunk_latest;
  },
  configurable: false,
});
";

const GDOCS_MODEL_EXTRACT_SCRIPT: &str = r#"() => {
  const chunks = [...(window.__captured_chunks || [])];
  if (
    window.DOCS_modelChunk &&
    chunks.length === 0 &&
    !chunks.includes(window.DOCS_modelChunk)
  ) {
    chunks.push(window.DOCS_modelChunk);
  }
  const cidUrlMap = {};
  const scripts = document.querySelectorAll('script');
  for (const script of scripts) {
    const text = script.textContent || '';
    if (!text.includes('docs-images-rt')) {
      continue;
    }
    const regex =
      /"([A-Za-z0-9_-]{20,})"\s*:\s*"(https:\/\/docs\.google\.com\/docs-images-rt\/[^"]+)"/g;
    let match;
    while ((match = regex.exec(text)) !== null) {
      cidUrlMap[match[1]] = match[2]
        .replace(/\\u003d/g, '=')
        .replace(/\\u0026/g, '&')
        .replace(/\\\//g, '/');
    }
  }
  return { chunks, cidUrlMap };
}"#;

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

/// Google Docs capture backend selected from the CLI `--capture` flag.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum GDocsCaptureMethod {
    /// Load `/edit` and extract `DOCS_modelChunk`.
    BrowserModel,
    /// Use the public `/export?format=...` endpoint.
    PublicExport,
    /// Use the authenticated `docs.googleapis.com` REST API.
    DocsApi,
}

/// Rendered Google Docs content from either Docs API or editor model data.
#[derive(Debug, Clone)]
pub struct GDocsRenderedResult {
    /// Markdown output.
    pub markdown: String,
    /// HTML output.
    pub html: String,
    /// Plain text output.
    pub text: String,
    /// The extracted document ID.
    pub document_id: String,
    /// Source URL used for capture.
    pub export_url: String,
    /// Remote images exposed by the editor model, used for archive localization.
    pub remote_images: Vec<RemoteImage>,
}

/// Remote image reference extracted from browser-model capture.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct RemoteImage {
    /// Original image URL.
    pub url: String,
    /// Image alt text.
    pub alt: String,
}

#[derive(Debug, Clone)]
struct BrowserModelData {
    chunks: Vec<Value>,
    cid_urls: HashMap<String, String>,
    chunk_payload_bytes: usize,
    poll_count: usize,
    stable_for: Duration,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
struct BrowserModelFingerprint {
    chunks: usize,
    payload_bytes: usize,
}

#[derive(Debug, Default)]
struct BrowserModelQuiescence {
    last_fingerprint: Option<BrowserModelFingerprint>,
    stable_since: Option<Instant>,
}

impl BrowserModelData {
    const fn fingerprint(&self) -> BrowserModelFingerprint {
        BrowserModelFingerprint {
            chunks: self.chunks.len(),
            payload_bytes: self.chunk_payload_bytes,
        }
    }
}

impl BrowserModelQuiescence {
    fn observe(
        &mut self,
        fingerprint: BrowserModelFingerprint,
        now: Instant,
        stability_window: Duration,
    ) -> Option<Duration> {
        if fingerprint.chunks == 0 {
            self.last_fingerprint = Some(fingerprint);
            self.stable_since = None;
            return None;
        }

        if self.last_fingerprint == Some(fingerprint) {
            let stable_since = *self.stable_since.get_or_insert(now);
            let stable_for = now.saturating_duration_since(stable_since);
            if stable_for >= stability_window {
                return Some(stable_for);
            }
        } else {
            self.last_fingerprint = Some(fingerprint);
            self.stable_since = None;
        }

        None
    }

    fn stable_for(&self, now: Instant) -> Duration {
        self.stable_since.map_or(Duration::ZERO, |stable_since| {
            now.saturating_duration_since(stable_since)
        })
    }
}

/// Parsed Google Docs model/document capture.
#[derive(Debug, Clone, Default)]
pub struct CapturedDocument {
    /// Ordered document blocks.
    pub blocks: Vec<CapturedBlock>,
    /// Tables extracted from `blocks` for compatibility with tests and callers.
    pub tables: Vec<TableBlock>,
    /// Images extracted from model positions.
    pub images: Vec<ContentNode>,
    /// Plain text projection.
    pub text: String,
}

/// Captured block.
#[derive(Debug, Clone)]
pub enum CapturedBlock {
    /// Paragraph-like block.
    Paragraph {
        /// Paragraph content.
        content: Vec<ContentNode>,
        /// Optional Google Docs named style.
        style: Option<String>,
        /// Optional list metadata.
        list: Option<ListMeta>,
        /// Whether paragraph is a blockquote.
        quote: bool,
        /// Whether paragraph is a horizontal rule.
        horizontal_rule: bool,
    },
    /// Table block.
    Table(TableBlock),
}

/// Captured table.
#[derive(Debug, Clone, Default)]
pub struct TableBlock {
    /// Table rows.
    pub rows: Vec<TableRow>,
}

/// Captured table row.
#[derive(Debug, Clone, Default)]
pub struct TableRow {
    /// Row cells.
    pub cells: Vec<TableCell>,
}

/// Captured table cell.
#[derive(Debug, Clone, Default)]
pub struct TableCell {
    /// Cell content.
    pub content: Vec<ContentNode>,
}

/// Captured inline content node.
#[derive(Debug, Clone, PartialEq, Eq)]
pub enum ContentNode {
    /// Text run.
    Text {
        /// Text content.
        text: String,
        /// Bold text style.
        bold: bool,
        /// Italic text style.
        italic: bool,
        /// Strikethrough text style.
        strike: bool,
        /// Optional hyperlink target.
        link: Option<String>,
    },
    /// Image placeholder.
    Image {
        /// Content ID from Google Docs model data.
        cid: Option<String>,
        /// Resolved image URL.
        url: Option<String>,
        /// Alt text.
        alt: String,
        /// Editor-model image width, when available.
        width: Option<String>,
        /// Editor-model image height, when available.
        height: Option<String>,
        /// Whether this image came from a suggested edit.
        is_suggestion: bool,
    },
}

#[derive(Debug, Clone, Default, PartialEq, Eq)]
struct TextStyle {
    bold: bool,
    italic: bool,
    strike: bool,
    link: Option<String>,
}

#[derive(Debug, Clone, Default)]
struct ParagraphMeta {
    style: Option<String>,
    list: Option<ListMeta>,
    quote: bool,
    horizontal_rule: bool,
}

#[derive(Debug, Clone)]
pub struct ListMeta {
    /// Google Docs list identifier.
    pub id: String,
    /// Nesting level, zero-based.
    pub level: usize,
    /// Whether Markdown should render this list item with an ordered marker.
    pub ordered: bool,
}

#[derive(Debug, Clone)]
struct ParagraphStyle {
    style: Option<String>,
    indent_start: f64,
    indent_first_line: f64,
}

#[derive(Debug, Clone)]
struct ExportSemanticHint {
    text: String,
    list_ordered: Option<bool>,
    quote: bool,
}

#[derive(Debug, Clone, Default)]
struct ModelStyleMaps {
    inline_styles: Vec<TextStyle>,
    paragraph_by_end: HashMap<usize, ParagraphStyle>,
    list_by_end: HashMap<usize, ListMeta>,
    horizontal_rules: std::collections::HashSet<usize>,
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

/// Build a Google Docs editor URL.
#[must_use]
pub fn build_edit_url(document_id: &str) -> String {
    format!("{GDOCS_EXPORT_BASE}/{document_id}/edit")
}

/// Build a Google Docs REST API URL.
#[must_use]
pub fn build_docs_api_url(document_id: &str) -> String {
    format!("{GDOCS_API_BASE}/{document_id}")
}

/// Select a Google Docs capture backend from the CLI `--capture` value.
///
/// # Errors
///
/// Returns an error when `capture` is neither `browser` nor `api`.
pub fn select_capture_method(
    capture: &str,
    api_token: Option<&str>,
) -> crate::Result<GDocsCaptureMethod> {
    match capture.to_lowercase().as_str() {
        "browser" => Ok(GDocsCaptureMethod::BrowserModel),
        "api" if api_token.is_some() => Ok(GDocsCaptureMethod::DocsApi),
        "api" => Ok(GDocsCaptureMethod::PublicExport),
        other => Err(WebCaptureError::InvalidUrl(format!(
            "Unsupported Google Docs capture method \"{other}\". Use \"browser\" or \"api\"."
        ))),
    }
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
    debug!(
        document_id = %document_id,
        format = %format,
        export_url = %export_url,
        has_api_token = api_token.is_some(),
        "fetching Google Doc via public export"
    );

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
    debug!(
        document_id = %document_id,
        status = response.status().as_u16(),
        success = response.status().is_success(),
        content_type = response
            .headers()
            .get(reqwest::header::CONTENT_TYPE)
            .and_then(|value| value.to_str().ok())
            .unwrap_or(""),
        "received Google Docs public export response"
    );

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
    debug!(
        document_id = %document_id,
        bytes = raw_content.len(),
        "read Google Docs public export body"
    );

    // Keep HTML markup escaped so literal examples such as `&lt;ol&gt;` do not
    // become real tags before the HTML parser sees the document.
    let content = match format {
        "txt" | "md" => crate::html::decode_html_entities(&raw_content),
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

    let preprocess = preprocess_google_docs_export_html(&result.content);
    debug!(
        document_id = %result.document_id,
        hoisted = preprocess.hoisted,
        unwrapped_links = preprocess.unwrapped_links,
        "google-docs-export pre-processor rewrote markup"
    );
    let markdown = normalize_google_docs_export_markdown(
        &crate::markdown::convert_html_to_markdown(&preprocess.html, Some(&result.export_url))?,
    );
    debug!(
        document_id = %result.document_id,
        bytes = markdown.len(),
        "rendered Google Docs public export markdown"
    );

    Ok(GDocsResult {
        content: markdown,
        format: "markdown".to_string(),
        document_id: result.document_id,
        export_url: result.export_url,
    })
}

/// Result of running the Google Docs export HTML pre-processor.
///
/// Exposes the rewritten HTML alongside counters that are useful for debug
/// logging (`gdocs.export.style-hoist`). See issue #92 R6.
#[derive(Debug, Clone)]
pub struct GDocsExportPreprocessResult {
    /// Rewritten HTML.
    pub html: String,
    /// Number of inline-style spans turned into `<strong>`/`<em>`/`<del>`.
    pub hoisted: usize,
    /// Number of `google.com/url?q=` redirect wrappers unwrapped.
    pub unwrapped_links: usize,
}

/// Pre-process Google Docs export HTML so the generic `html2md` pipeline
/// preserves inline formatting, heading numbering, and link targets.
///
/// Google Drive serves bold/italic/strikethrough as inline style spans and
/// wraps every link through a `google.com/url?q=` redirect, both of which
/// the generic converter would otherwise discard. This function rewrites
/// those constructs into semantic HTML before conversion.
#[must_use]
pub fn preprocess_google_docs_export_html(html: &str) -> GDocsExportPreprocessResult {
    let mut hoisted: usize = 0;
    let mut unwrapped_links: usize = 0;
    let class_styles = extract_css_class_styles(html);

    let mut out = hoist_inline_style_spans(html, &mut hoisted);
    out = hoist_class_style_spans(&out, &class_styles, &mut hoisted);
    out = convert_class_indented_blockquotes(&out, &class_styles);
    out = nest_google_docs_lists(&out, &class_styles);
    out = strip_google_docs_heading_noise(&out);
    out = strip_heading_inline_formatting(&out);
    out = unwrap_google_redirect_links(&out, &mut unwrapped_links);
    out = out.replace("&nbsp;", " ");
    out = out.replace('\u{00A0}', " ");

    GDocsExportPreprocessResult {
        html: out,
        hoisted,
        unwrapped_links,
    }
}

/// Normalize Markdown emitted from Google Docs public-export HTML converters.
#[must_use]
pub fn normalize_google_docs_export_markdown(markdown: &str) -> String {
    let markdown = unescape_public_export_punctuation(markdown);
    let markdown = convert_setext_headings(&markdown);
    let markdown = normalize_atx_headings(&markdown);
    let markdown = normalize_bullet_markers(&markdown);
    let markdown = normalize_list_spacing(&markdown);
    let markdown = normalize_blockquote_spacing(&markdown);
    let markdown = normalize_markdown_tables(&markdown);
    crate::markdown::clean_markdown(&markdown)
}

fn hoist_inline_style_spans(html: &str, hoisted: &mut usize) -> String {
    let span_re = Regex::new(r#"(?is)<span\s+([^>]*style="([^"]*)"[^>]*)>(.*?)</span>"#)
        .expect("valid regex");
    span_re
        .replace_all(html, |caps: &regex::Captures<'_>| {
            let style = caps.get(2).map_or("", |m| m.as_str());
            let inner = caps.get(3).map_or("", |m| m.as_str());
            semantic_wrapped_html(inner, style).map_or_else(
                || caps[0].to_string(),
                |wrapped| {
                    *hoisted += 1;
                    wrapped
                },
            )
        })
        .into_owned()
}

fn hoist_class_style_spans(
    html: &str,
    class_styles: &HashMap<String, String>,
    hoisted: &mut usize,
) -> String {
    let class_span_re = Regex::new(r#"(?is)<span\s+([^>]*\bclass="([^"]*)"[^>]*)>(.*?)</span>"#)
        .expect("valid regex");
    class_span_re
        .replace_all(html, |caps: &regex::Captures<'_>| {
            let class_attr = caps.get(2).map_or("", |m| m.as_str());
            let inner = caps.get(3).map_or("", |m| m.as_str());
            let style = combined_class_style(class_styles, class_attr);
            semantic_wrapped_html(inner, &style).map_or_else(
                || caps[0].to_string(),
                |wrapped| {
                    *hoisted += 1;
                    wrapped
                },
            )
        })
        .into_owned()
}

fn convert_class_indented_blockquotes(
    html: &str,
    class_styles: &HashMap<String, String>,
) -> String {
    let class_paragraph_re =
        Regex::new(r#"(?is)<p\s+([^>]*\bclass="([^"]*)"[^>]*)>(.*?)</p>"#).expect("valid regex");
    class_paragraph_re
        .replace_all(html, |caps: &regex::Captures<'_>| {
            let class_attr = caps.get(2).map_or("", |m| m.as_str());
            let inner = caps.get(3).map_or("", |m| m.as_str());
            let style = combined_class_style(class_styles, class_attr);
            if is_blockquote_style(&style) {
                format!("<blockquote><p>{inner}</p></blockquote>")
            } else {
                caps[0].to_string()
            }
        })
        .into_owned()
}

#[derive(Debug, Clone)]
struct ExportListBlock {
    start: usize,
    end: usize,
    tag: String,
    inner: String,
    start_attr: Option<String>,
}

#[derive(Debug, Clone)]
struct ExportListItem {
    tag: String,
    level: usize,
    inner: String,
}

fn nest_google_docs_lists(html: &str, class_styles: &HashMap<String, String>) -> String {
    let list_re = Regex::new(r"(?is)<(ul|ol)\b([^>]*)>(.*?)</(ul|ol)>").expect("valid regex");
    let start_attr_re = Regex::new(r#"(?i)\bstart\s*=\s*"([^"]*)""#).expect("valid regex");
    let blocks: Vec<ExportListBlock> = list_re
        .captures_iter(html)
        .filter_map(|caps| {
            let open_tag = caps.get(1)?.as_str().to_ascii_lowercase();
            let close_tag = caps.get(4)?.as_str().to_ascii_lowercase();
            if open_tag != close_tag {
                return None;
            }
            let whole = caps.get(0)?;
            let attrs = caps.get(2).map_or("", |m| m.as_str());
            let start_attr = if open_tag == "ol" {
                start_attr_re
                    .captures(attrs)
                    .and_then(|c| c.get(1).map(|m| m.as_str().to_string()))
            } else {
                None
            };
            Some(ExportListBlock {
                start: whole.start(),
                end: whole.end(),
                tag: open_tag,
                inner: caps.get(3).map_or("", |m| m.as_str()).to_string(),
                start_attr,
            })
        })
        .collect();

    if blocks.len() < 2 {
        return html.to_string();
    }

    let mut groups: Vec<Vec<ExportListBlock>> = Vec::new();
    let mut current: Vec<ExportListBlock> = Vec::new();
    for block in blocks {
        if let Some(previous) = current.last() {
            if !html[previous.end..block.start].trim().is_empty() {
                if current.len() > 1 {
                    groups.push(std::mem::take(&mut current));
                } else {
                    current.clear();
                }
            }
        }
        current.push(block);
    }
    if current.len() > 1 {
        groups.push(current);
    }

    if groups.is_empty() {
        return html.to_string();
    }

    let mut out = html.to_string();
    for group in groups.iter().rev() {
        let rendered = render_nested_list_group(group, class_styles);
        let start = group.first().expect("non-empty group").start;
        let end = group.last().expect("non-empty group").end;
        out.replace_range(start..end, &rendered);
    }
    out
}

#[allow(clippy::too_many_lines)]
fn render_nested_list_group(
    group: &[ExportListBlock],
    class_styles: &HashMap<String, String>,
) -> String {
    let item_re = Regex::new(r"(?is)<li\b([^>]*)>(.*?)</li>").expect("valid regex");
    let items: Vec<ExportListItem> = group
        .iter()
        .flat_map(|block| {
            item_re.captures_iter(&block.inner).map(|caps| {
                let attrs = caps.get(1).map_or("", |m| m.as_str());
                let inner = caps.get(2).map_or("", |m| m.as_str()).to_string();
                ExportListItem {
                    tag: block.tag.clone(),
                    level: google_docs_list_item_level(attrs, class_styles),
                    inner,
                }
            })
        })
        .collect();

    if items.is_empty() {
        let mut unchanged = String::new();
        for block in group {
            write!(unchanged, "<{}>{}</{}>", block.tag, block.inner, block.tag)
                .expect("write to String");
        }
        return unchanged;
    }

    let top_level_start = group.first().and_then(|block| block.start_attr.clone());

    let mut html = String::new();
    let mut current_level: Option<usize> = None;
    let mut open_tags: Vec<Option<String>> = Vec::new();
    let mut item_open: Vec<bool> = Vec::new();
    let mut top_level_opened = false;

    for item in items {
        let level = item.level;
        while current_level.is_some_and(|current| current > level) {
            let current = current_level.expect("checked as Some");
            close_rendered_list(&mut html, &mut open_tags, &mut item_open, current);
            current_level = current.checked_sub(1);
        }

        while current_level.is_none_or(|current| current < level) {
            let next_level = current_level.map_or(0, |current| current + 1);
            let start_attr = if next_level == 0 && !top_level_opened {
                top_level_opened = true;
                top_level_start.as_deref()
            } else {
                None
            };
            open_rendered_list(
                &mut html,
                &mut open_tags,
                &mut item_open,
                next_level,
                &item.tag,
                start_attr,
            );
            current_level = Some(next_level);
        }

        ensure_list_stack(&mut open_tags, &mut item_open, level);
        if open_tags[level]
            .as_deref()
            .is_some_and(|tag| tag != item.tag)
        {
            close_rendered_list(&mut html, &mut open_tags, &mut item_open, level);
            let start_attr = if level == 0 && !top_level_opened {
                top_level_opened = true;
                top_level_start.as_deref()
            } else {
                None
            };
            open_rendered_list(
                &mut html,
                &mut open_tags,
                &mut item_open,
                level,
                &item.tag,
                start_attr,
            );
        } else if open_tags[level].is_none() {
            let start_attr = if level == 0 && !top_level_opened {
                top_level_opened = true;
                top_level_start.as_deref()
            } else {
                None
            };
            open_rendered_list(
                &mut html,
                &mut open_tags,
                &mut item_open,
                level,
                &item.tag,
                start_attr,
            );
        }

        close_rendered_item(&mut html, &mut item_open, level);
        html.push_str("<li>");
        html.push_str(&item.inner);
        item_open[level] = true;

        for deeper in (level + 1)..item_open.len() {
            item_open[deeper] = false;
            open_tags[deeper] = None;
        }
    }

    while let Some(current) = current_level {
        close_rendered_list(&mut html, &mut open_tags, &mut item_open, current);
        current_level = current.checked_sub(1);
    }

    html
}

fn ensure_list_stack(open_tags: &mut Vec<Option<String>>, item_open: &mut Vec<bool>, level: usize) {
    while open_tags.len() <= level {
        open_tags.push(None);
        item_open.push(false);
    }
}

fn open_rendered_list(
    html: &mut String,
    open_tags: &mut Vec<Option<String>>,
    item_open: &mut Vec<bool>,
    level: usize,
    tag: &str,
    start_attr: Option<&str>,
) {
    ensure_list_stack(open_tags, item_open, level);
    html.push('<');
    html.push_str(tag);
    if let Some(start) = start_attr {
        if tag == "ol" && !start.is_empty() {
            write!(html, r#" start="{start}""#).expect("write to String");
        }
    }
    html.push('>');
    open_tags[level] = Some(tag.to_string());
    item_open[level] = false;
}

fn close_rendered_item(html: &mut String, item_open: &mut [bool], level: usize) {
    if item_open.get(level).copied().unwrap_or(false) {
        html.push_str("</li>");
        item_open[level] = false;
    }
}

fn close_rendered_list(
    html: &mut String,
    open_tags: &mut [Option<String>],
    item_open: &mut [bool],
    level: usize,
) {
    close_rendered_item(html, item_open, level);
    if let Some(tag) = open_tags.get_mut(level).and_then(Option::take) {
        html.push_str("</");
        html.push_str(&tag);
        html.push('>');
    }
}

fn google_docs_list_item_level(attrs: &str, class_styles: &HashMap<String, String>) -> usize {
    let style = combined_attr_style(class_styles, attrs);
    let margin_left = css_point_value(&style, "margin-left");
    if margin_left <= 0.0 {
        return 0;
    }
    [54.0, 90.0, 126.0, 162.0, 198.0, 234.0, 270.0, 306.0]
        .iter()
        .take_while(|boundary| margin_left >= **boundary)
        .count()
}

fn combined_attr_style(class_styles: &HashMap<String, String>, attrs: &str) -> String {
    let mut styles = String::new();
    if let Some(style) = attr_value(attrs, "style") {
        styles.push_str(&style);
    }
    if let Some(class_attr) = attr_value(attrs, "class") {
        styles.push_str(&combined_class_style(class_styles, &class_attr));
    }
    styles
}

fn attr_value(attrs: &str, name: &str) -> Option<String> {
    let attr_re = Regex::new(&format!(
        r#"(?is)\b{}\s*=\s*(?:"([^"]*)"|'([^']*)')"#,
        regex::escape(name)
    ))
    .expect("valid regex");
    attr_re.captures(attrs).and_then(|caps| {
        caps.get(1)
            .or_else(|| caps.get(2))
            .map(|value| value.as_str().to_string())
    })
}

fn strip_google_docs_heading_noise(html: &str) -> String {
    let empty_anchor_re = Regex::new(r#"(?is)<a\s+id="[^"]*"\s*>\s*</a>"#).expect("valid regex");
    let numbering_re =
        Regex::new(r"(?is)<span\b[^>]*>\s*\d+(?:\.\d+)*\.?\s*</span>").expect("valid regex");
    let mut out = empty_anchor_re.replace_all(html, "").into_owned();
    for level in 1..=6 {
        let heading_re = Regex::new(&format!(r"(?is)(<h{level}\b[^>]*>)(.*?)(</h{level}>)"))
            .expect("valid regex");
        out = heading_re
            .replace_all(&out, |caps: &regex::Captures<'_>| {
                let open = &caps[1];
                let inner = &caps[2];
                let close = &caps[3];
                let mut cleaned = empty_anchor_re.replace_all(inner, "").into_owned();
                cleaned = numbering_re.replace_all(&cleaned, "").into_owned();
                format!("{open}{cleaned}{close}")
            })
            .into_owned();
    }
    out
}

fn strip_heading_inline_formatting(html: &str) -> String {
    let inline_marker_re = Regex::new(r"(?is)</?(?:strong|em|del)>").expect("valid regex");
    let mut out = html.to_string();
    for level in 1..=6 {
        let heading_re = Regex::new(&format!(r"(?is)(<h{level}\b[^>]*>)(.*?)(</h{level}>)"))
            .expect("valid regex");
        out = heading_re
            .replace_all(&out, |caps: &regex::Captures<'_>| {
                let open = &caps[1];
                let inner = &caps[2];
                let close = &caps[3];
                let cleaned = inline_marker_re.replace_all(inner, "");
                format!("{open}{cleaned}{close}")
            })
            .into_owned();
    }
    out
}

fn unwrap_google_redirect_links(html: &str, unwrapped_links: &mut usize) -> String {
    let redirect_re =
        Regex::new(r#"(?i)href="https?://(?:www\.)?google\.com/url\?q=([^&"]+)[^"]*""#)
            .expect("valid regex");
    redirect_re
        .replace_all(html, |caps: &regex::Captures<'_>| {
            let encoded = caps.get(1).map_or("", |m| m.as_str());
            let decoded = percent_decode_utf8_lossy(encoded);
            *unwrapped_links += 1;
            format!(r#"href="{decoded}""#)
        })
        .into_owned()
}

fn extract_css_class_styles(html: &str) -> HashMap<String, String> {
    let mut class_styles: HashMap<String, String> = HashMap::new();
    let style_re = Regex::new(r"(?is)<style\b[^>]*>(.*?)</style>").expect("valid regex");
    let class_re = Regex::new(r"\.([A-Za-z0-9_-]+)\s*\{([^{}]*)\}").expect("valid regex");
    for style_caps in style_re.captures_iter(html) {
        let css = style_caps.get(1).map_or("", |m| m.as_str());
        for class_caps in class_re.captures_iter(css) {
            let class_name = class_caps.get(1).map_or("", |m| m.as_str());
            let style = class_caps.get(2).map_or("", |m| m.as_str());
            class_styles
                .entry(class_name.to_string())
                .and_modify(|existing| {
                    existing.push(';');
                    existing.push_str(style);
                })
                .or_insert_with(|| style.to_string());
        }
    }
    class_styles
}

fn combined_class_style(class_styles: &HashMap<String, String>, class_attr: &str) -> String {
    class_attr
        .split_whitespace()
        .filter_map(|class_name| class_styles.get(class_name))
        .fold(String::new(), |mut out, style| {
            out.push(';');
            out.push_str(style);
            out
        })
}

fn semantic_wrapped_html(inner: &str, style: &str) -> Option<String> {
    let bold = css_has_bold(style);
    let italic = css_has_italic(style);
    let strike = css_has_strike(style);
    if !bold && !italic && !strike {
        return None;
    }
    let mut wrapped = inner.to_string();
    if strike {
        wrapped = format!("<del>{wrapped}</del>");
    }
    if italic {
        wrapped = format!("<em>{wrapped}</em>");
    }
    if bold {
        wrapped = format!("<strong>{wrapped}</strong>");
    }
    Some(wrapped)
}

fn css_has_bold(style: &str) -> bool {
    Regex::new(r"(?i)font-weight\s*:\s*(?:bold|[6-9]\d{2})")
        .expect("valid regex")
        .is_match(style)
}

fn css_has_italic(style: &str) -> bool {
    Regex::new(r"(?i)font-style\s*:\s*italic")
        .expect("valid regex")
        .is_match(style)
}

fn css_has_strike(style: &str) -> bool {
    Regex::new(r"(?i)text-decoration[^;]*\bline-through\b")
        .expect("valid regex")
        .is_match(style)
}

fn is_blockquote_style(style: &str) -> bool {
    let margin_left = css_point_value(style, "margin-left");
    let margin_right = css_point_value(style, "margin-right");
    margin_left > 0.0 && margin_right > 0.0 && (margin_left - margin_right).abs() < 0.1
}

fn css_point_value(style: &str, property: &str) -> f64 {
    let re = Regex::new(&format!(
        r"(?i){}\s*:\s*(-?\d+(?:\.\d+)?)pt",
        regex::escape(property)
    ))
    .expect("valid regex");
    re.captures(style)
        .and_then(|caps| caps.get(1))
        .and_then(|value| value.as_str().parse::<f64>().ok())
        .unwrap_or(0.0)
}

/// Decode %XX percent escapes in `input`. Invalid sequences are left
/// untouched so well-formed ASCII URLs round-trip unchanged.
fn percent_decode_utf8_lossy(input: &str) -> String {
    let bytes = input.as_bytes();
    let mut decoded = Vec::with_capacity(bytes.len());
    let mut i = 0;
    while i < bytes.len() {
        if bytes[i] == b'%' && i + 2 < bytes.len() {
            let hi = (bytes[i + 1] as char).to_digit(16);
            let lo = (bytes[i + 2] as char).to_digit(16);
            if let (Some(hi), Some(lo)) = (hi, lo) {
                if let Ok(byte) = u8::try_from((hi << 4) | lo) {
                    decoded.push(byte);
                    i += 3;
                    continue;
                }
            }
        }
        decoded.push(bytes[i]);
        i += 1;
    }
    String::from_utf8_lossy(&decoded).into_owned()
}

fn unescape_public_export_punctuation(markdown: &str) -> String {
    markdown
        .replace("\\.", ".")
        .replace("\\!", "!")
        .replace("\\(", "(")
        .replace("\\)", ")")
        .replace("\\[", "[")
        .replace("\\]", "]")
}

fn convert_setext_headings(markdown: &str) -> String {
    let lines: Vec<&str> = markdown.lines().collect();
    let mut out = Vec::with_capacity(lines.len());
    let mut index = 0;
    while index < lines.len() {
        if index + 1 < lines.len() {
            let underline = lines[index + 1].trim();
            if is_setext_underline(underline, '=') {
                out.push(format!("# {}", lines[index].trim()));
                index += 2;
                continue;
            }
            if is_setext_underline(underline, '-') {
                out.push(format!("## {}", lines[index].trim()));
                index += 2;
                continue;
            }
        }
        out.push(lines[index].to_string());
        index += 1;
    }
    out.join("\n")
}

fn is_setext_underline(line: &str, marker: char) -> bool {
    line.len() >= 5 && line.chars().all(|ch| ch == marker)
}

fn normalize_atx_headings(markdown: &str) -> String {
    let heading_re = Regex::new(r"^(#{1,6})\s+(.+?)\s*$").expect("valid regex");
    let closing_re = closing_atx_heading_re();
    markdown
        .lines()
        .map(|line| {
            let Some(caps) = heading_re.captures(line) else {
                return line.to_string();
            };
            let hashes = caps.get(1).map_or("", |m| m.as_str());
            let mut text = caps.get(2).map_or("", |m| m.as_str()).trim().to_string();
            text = closing_re.replace(&text, "").trim().to_string();
            text = strip_wrapping_markdown_emphasis(&text);
            format!("{hashes} {text}")
        })
        .collect::<Vec<_>>()
        .join("\n")
}

fn strip_wrapping_markdown_emphasis(text: &str) -> String {
    let trimmed = text.trim();
    for marker in ["***", "**", "*"] {
        if trimmed.len() > marker.len() * 2
            && trimmed.starts_with(marker)
            && trimmed.ends_with(marker)
        {
            return trimmed[marker.len()..trimmed.len() - marker.len()]
                .trim()
                .to_string();
        }
    }
    trimmed.to_string()
}

fn normalize_bullet_markers(markdown: &str) -> String {
    let bullet_re = asterisk_bullet_re();
    markdown
        .lines()
        .map(|line| bullet_re.replace(line, "$1- ").into_owned())
        .collect::<Vec<_>>()
        .join("\n")
}

fn normalize_list_spacing(markdown: &str) -> String {
    let lines: Vec<&str> = markdown.lines().collect();
    let mut out = Vec::with_capacity(lines.len());

    for (index, line) in lines.iter().enumerate() {
        if line.trim().is_empty()
            && previous_non_empty_line(&lines, index).is_some_and(is_markdown_list_item)
            && next_non_empty_line(&lines, index).is_some_and(is_markdown_list_item)
        {
            continue;
        }
        out.push((*line).to_string());
    }

    out.join("\n")
}

fn previous_non_empty_line<'a>(lines: &'a [&str], index: usize) -> Option<&'a str> {
    lines[..index]
        .iter()
        .rev()
        .copied()
        .find(|line| !line.trim().is_empty())
}

fn next_non_empty_line<'a>(lines: &'a [&str], index: usize) -> Option<&'a str> {
    lines[index + 1..]
        .iter()
        .copied()
        .find(|line| !line.trim().is_empty())
}

fn is_markdown_list_item(line: &str) -> bool {
    markdown_list_item_re().is_match(line)
}

fn normalize_blockquote_spacing(markdown: &str) -> String {
    let mut out = String::with_capacity(markdown.len());
    let mut pending_quote_blank = false;
    let mut in_quote = false;

    for line in markdown.lines() {
        if line.trim().is_empty() && in_quote {
            pending_quote_blank = true;
            continue;
        }

        if line.trim() == ">" {
            if in_quote {
                pending_quote_blank = true;
            }
            continue;
        }

        if line.starts_with("> ") {
            if pending_quote_blank {
                out.push_str(">\n");
                pending_quote_blank = false;
            }
            out.push_str(line);
            out.push('\n');
            in_quote = true;
            continue;
        }

        if in_quote && !line.trim().is_empty() {
            out.push('\n');
        }
        pending_quote_blank = false;
        in_quote = false;
        out.push_str(line);
        out.push('\n');
    }

    out
}

fn normalize_markdown_tables(markdown: &str) -> String {
    let lines: Vec<&str> = markdown.lines().collect();
    let mut out = Vec::with_capacity(lines.len());
    let mut index = 0;

    while index < lines.len() {
        if !is_markdown_table_line(lines[index]) {
            out.push(lines[index].to_string());
            index += 1;
            continue;
        }

        let start = index;
        while index < lines.len() && is_markdown_table_line(lines[index]) {
            index += 1;
        }
        let block = &lines[start..index];
        if block.len() >= 2 && is_markdown_separator_line(block[1]) {
            out.extend(normalize_markdown_table_block(block));
        } else {
            out.extend(block.iter().map(|line| (*line).to_string()));
        }
    }

    out.join("\n")
}

fn is_markdown_table_line(line: &str) -> bool {
    let trimmed = line.trim();
    trimmed.starts_with('|') && trimmed.ends_with('|') && trimmed.matches('|').count() >= 2
}

fn is_markdown_separator_line(line: &str) -> bool {
    split_markdown_table_cells(line)
        .iter()
        .all(|cell| markdown_table_separator_cell_re().is_match(cell))
}

fn normalize_markdown_table_block(lines: &[&str]) -> Vec<String> {
    lines
        .iter()
        .enumerate()
        .map(|(index, line)| {
            let cells = split_markdown_table_cells(line);
            if index == 1 {
                let separators = vec!["---".to_string(); cells.len()];
                render_markdown_table_row(&separators)
            } else {
                render_markdown_table_row(&cells)
            }
        })
        .collect()
}

fn split_markdown_table_cells(line: &str) -> Vec<String> {
    line.trim()
        .trim_matches('|')
        .split('|')
        .map(|cell| cell.trim().to_string())
        .collect()
}

fn render_markdown_table_row(cells: &[String]) -> String {
    format!("| {} |", cells.join(" | "))
}

fn closing_atx_heading_re() -> &'static Regex {
    static RE: OnceLock<Regex> = OnceLock::new();
    RE.get_or_init(|| Regex::new(r"\s+#{1,6}$").expect("valid regex"))
}

fn asterisk_bullet_re() -> &'static Regex {
    static RE: OnceLock<Regex> = OnceLock::new();
    RE.get_or_init(|| Regex::new(r"^(\s*)\* ").expect("valid regex"))
}

fn markdown_list_item_re() -> &'static Regex {
    static RE: OnceLock<Regex> = OnceLock::new();
    RE.get_or_init(|| Regex::new(r"^\s*(?:[-+*]|\d+\.)\s+").expect("valid regex"))
}

fn markdown_table_separator_cell_re() -> &'static Regex {
    static RE: OnceLock<Regex> = OnceLock::new();
    RE.get_or_init(|| Regex::new(r"^:?-{3,}:?$").expect("valid regex"))
}

/// Fetch and render a Google Docs document via the authenticated REST API.
///
/// # Errors
///
/// Returns an error when the URL is invalid, no token is provided, or the API request fails.
pub async fn fetch_google_doc_from_docs_api(
    url: &str,
    api_token: &str,
) -> crate::Result<GDocsRenderedResult> {
    let document_id = extract_document_id(url).ok_or_else(|| {
        WebCaptureError::InvalidUrl(format!("Not a valid Google Docs URL: {url}"))
    })?;
    let api_url = build_docs_api_url(&document_id);
    debug!(
        document_id = %document_id,
        api_url = %api_url,
        "fetching Google Doc via Docs API"
    );

    let response = reqwest::Client::new()
        .get(&api_url)
        .header("Authorization", format!("Bearer {api_token}"))
        .header("Accept", "application/json")
        .send()
        .await
        .map_err(|e| {
            WebCaptureError::FetchError(format!("Failed to fetch Google Doc via Docs API: {e}"))
        })?;
    debug!(
        document_id = %document_id,
        status = response.status().as_u16(),
        success = response.status().is_success(),
        content_type = response
            .headers()
            .get(reqwest::header::CONTENT_TYPE)
            .and_then(|value| value.to_str().ok())
            .unwrap_or(""),
        "received Google Docs API response"
    );

    if !response.status().is_success() {
        return Err(WebCaptureError::FetchError(format!(
            "Failed to fetch Google Doc via Docs API ({} {}): {}",
            response.status().as_u16(),
            response.status().canonical_reason().unwrap_or("Unknown"),
            api_url
        )));
    }

    let body = response.text().await.map_err(|e| {
        WebCaptureError::FetchError(format!("Failed to read Google Docs API response: {e}"))
    })?;
    let document = serde_json::from_str::<Value>(&body).map_err(|e| {
        WebCaptureError::ParseError(format!("Failed to parse Google Docs API response: {e}"))
    })?;
    let rendered = render_docs_api_document(&document);
    debug!(
        document_id = %document_id,
        title = document.get("title").and_then(|value| value.as_str()).unwrap_or(""),
        markdown_bytes = rendered.markdown.len(),
        html_bytes = rendered.html.len(),
        text_bytes = rendered.text.len(),
        "rendered Google Docs API document"
    );

    Ok(GDocsRenderedResult {
        markdown: rendered.markdown,
        html: rendered.html,
        text: rendered.text,
        document_id,
        export_url: api_url,
        remote_images: Vec::new(),
    })
}

/// Fetch and render the model data embedded in the Google Docs `/edit` route.
///
/// # Errors
///
/// Returns an error when the URL is invalid, the fetch fails, or no model chunks are present.
pub async fn fetch_google_doc_from_model(
    url: &str,
    api_token: Option<&str>,
) -> crate::Result<GDocsRenderedResult> {
    if api_token.is_some() {
        return Err(WebCaptureError::BrowserError(
            "Rust browser-model Google Docs capture cannot inject API tokens; use --capture api for authenticated Docs API capture".to_string(),
        ));
    }
    let document_id = extract_document_id(url).ok_or_else(|| {
        WebCaptureError::InvalidUrl(format!("Not a valid Google Docs URL: {url}"))
    })?;
    let edit_url = build_edit_url(&document_id);
    debug!(
        document_id = %document_id,
        edit_url = %edit_url,
        "capturing Google Doc editor model with a real browser"
    );
    let model_data = fetch_google_doc_editor_model_with_cdp(&edit_url, &document_id).await?;
    let BrowserModelData {
        chunks,
        cid_urls,
        chunk_payload_bytes,
        poll_count,
        stable_for,
    } = model_data;
    debug!(
        document_id = %document_id,
        chunks = chunks.len(),
        cid_urls = cid_urls.len(),
        chunk_payload_bytes,
        poll_count,
        stable_for_ms = stable_for.as_millis(),
        "extracted Google Docs editor model chunks through CDP"
    );
    if chunks.is_empty() {
        return Err(WebCaptureError::ParseError(
            "Google Docs editor page did not expose DOCS_modelChunk data".to_string(),
        ));
    }

    let export_html = match fetch_google_doc(url, "html", None).await {
        Ok(result) => Some(result.content),
        Err(error) => {
            warn!(
                document_id = %document_id,
                error = %error,
                "failed to fetch Google Docs export HTML for browser-model semantic hints"
            );
            None
        }
    };
    let capture = parse_model_chunks_with_export_html(&chunks, &cid_urls, export_html.as_deref());
    let remote_images = remote_images_from_capture(&capture);
    info!(
        document_id = %document_id,
        chunks = chunks.len(),
        cid_urls = cid_urls.len(),
        chunk_payload_bytes,
        poll_count,
        stable_for_ms = stable_for.as_millis(),
        blocks = capture.blocks.len(),
        tables = capture.tables.len(),
        images = capture.images.len(),
        text_bytes = capture.text.len(),
        "parsed Google Docs editor model"
    );

    Ok(GDocsRenderedResult {
        markdown: render_captured_document(&capture, "markdown"),
        html: render_captured_document(&capture, "html"),
        text: render_captured_document(&capture, "txt"),
        document_id,
        export_url: edit_url,
        remote_images,
    })
}

async fn fetch_google_doc_editor_model_with_cdp(
    edit_url: &str,
    document_id: &str,
) -> crate::Result<BrowserModelData> {
    let chrome = crate::browser::find_chrome_executable().ok_or_else(|| {
        WebCaptureError::BrowserError(
            "Chrome/Chromium executable was not found. Set WEB_CAPTURE_CHROME, CHROME_PATH, or GOOGLE_CHROME_BIN.".to_string(),
        )
    })?;
    let user_data_dir = crate::browser::temporary_user_data_dir();
    std::fs::create_dir_all(&user_data_dir)?;

    debug!(
        document_id = %document_id,
        chrome = %chrome.display(),
        user_data_dir = %user_data_dir.display(),
        edit_url = %edit_url,
        "launching headless Chrome CDP session for Google Docs model capture"
    );

    let mut child = launch_cdp_chrome(&chrome, &user_data_dir)?;
    let capture_result = async {
        let ws_url = wait_for_devtools_ws_url(&mut child).await?;
        let (mut ws, _) = connect_async(&ws_url).await.map_err(|error| {
            WebCaptureError::BrowserError(format!(
                "Failed to connect to Chrome DevTools websocket: {error}"
            ))
        })?;
        let mut next_id = 0u64;
        let session_id = navigate_google_docs_cdp_page(&mut ws, &mut next_id, edit_url).await?;
        wait_for_google_docs_model_chunks(&mut ws, &mut next_id, &session_id, document_id).await
    }
    .await;

    if let Err(error) = child.kill().await {
        debug!(
            document_id = %document_id,
            error = %error,
            "failed to kill Chrome CDP browser process"
        );
    }
    let _ = child.wait().await;
    let _ = std::fs::remove_dir_all(&user_data_dir);

    capture_result
}

async fn navigate_google_docs_cdp_page(
    ws: &mut CdpWebSocket,
    next_id: &mut u64,
    edit_url: &str,
) -> crate::Result<String> {
    let target = cdp_send(
        ws,
        next_id,
        None,
        "Target.createTarget",
        serde_json::json!({ "url": "about:blank" }),
    )
    .await?;
    let target_id = target
        .get("targetId")
        .and_then(Value::as_str)
        .ok_or_else(|| {
            WebCaptureError::BrowserError(
                "Chrome DevTools Target.createTarget did not return targetId".to_string(),
            )
        })?
        .to_string();
    let attached = cdp_send(
        ws,
        next_id,
        None,
        "Target.attachToTarget",
        serde_json::json!({ "targetId": target_id, "flatten": true }),
    )
    .await?;
    let session_id = attached
        .get("sessionId")
        .and_then(Value::as_str)
        .ok_or_else(|| {
            WebCaptureError::BrowserError(
                "Chrome DevTools Target.attachToTarget did not return sessionId".to_string(),
            )
        })?
        .to_string();

    cdp_send(
        ws,
        next_id,
        Some(&session_id),
        "Page.enable",
        serde_json::json!({}),
    )
    .await?;
    cdp_send(
        ws,
        next_id,
        Some(&session_id),
        "Runtime.enable",
        serde_json::json!({}),
    )
    .await?;
    cdp_send(
        ws,
        next_id,
        Some(&session_id),
        "Page.addScriptToEvaluateOnNewDocument",
        serde_json::json!({ "source": GDOCS_MODEL_CAPTURE_INIT_SCRIPT }),
    )
    .await?;
    cdp_send(
        ws,
        next_id,
        Some(&session_id),
        "Page.navigate",
        serde_json::json!({ "url": edit_url }),
    )
    .await?;

    Ok(session_id)
}

async fn wait_for_google_docs_model_chunks(
    ws: &mut CdpWebSocket,
    next_id: &mut u64,
    session_id: &str,
    document_id: &str,
) -> crate::Result<BrowserModelData> {
    let started = Instant::now();
    let max_wait = gdocs_editor_model_max_wait();
    let stability_window = gdocs_editor_model_stability_window();
    let mut quiescence = BrowserModelQuiescence::default();
    let mut last_chunks = 0usize;
    let mut last_cid_urls = 0usize;
    let mut last_payload_bytes = 0usize;
    let mut last_stable_for = Duration::ZERO;
    let mut poll_count = 0usize;

    while started.elapsed() < max_wait {
        let result = cdp_send(
            ws,
            next_id,
            Some(session_id),
            "Runtime.evaluate",
            serde_json::json!({
                "expression": format!("({GDOCS_MODEL_EXTRACT_SCRIPT})()"),
                "returnByValue": true,
                "awaitPromise": true
            }),
        )
        .await?;
        if let Some(exception) = result.get("exceptionDetails") {
            return Err(WebCaptureError::BrowserError(format!(
                "Google Docs model extraction script failed: {exception}"
            )));
        }
        let value = result
            .pointer("/result/value")
            .cloned()
            .unwrap_or(Value::Null);
        let model_data = browser_model_data_from_value(&value);
        poll_count += 1;
        let fingerprint = model_data.fingerprint();
        last_chunks = model_data.chunks.len();
        last_cid_urls = model_data.cid_urls.len();
        last_payload_bytes = model_data.chunk_payload_bytes;
        let now = Instant::now();
        if let Some(stable_for) = quiescence.observe(fingerprint, now, stability_window) {
            let mut model_data = model_data;
            model_data.poll_count = poll_count;
            model_data.stable_for = stable_for;
            debug!(
                document_id = %document_id,
                chunks = model_data.chunks.len(),
                cid_urls = model_data.cid_urls.len(),
                chunk_payload_bytes = model_data.chunk_payload_bytes,
                poll_count,
                stable_for_ms = stable_for.as_millis(),
                elapsed_ms = started.elapsed().as_millis(),
                "captured quiesced Google Docs model chunks through CDP Runtime.evaluate"
            );
            return Ok(model_data);
        }
        last_stable_for = quiescence.stable_for(now);
        tokio::time::sleep(GDOCS_EDITOR_MODEL_POLL_INTERVAL).await;
    }

    Err(WebCaptureError::BrowserError(format!(
        "Timed out waiting for Google Docs DOCS_modelChunk stream to quiesce for document {document_id} after {} ms (last chunks={last_chunks}, payload_bytes={last_payload_bytes}, cid_urls={last_cid_urls}, poll_count={poll_count}, stable_for_ms={})",
        max_wait.as_millis(),
        last_stable_for.as_millis()
    )))
}

fn launch_cdp_chrome(
    chrome: &std::path::Path,
    user_data_dir: &std::path::Path,
) -> crate::Result<Child> {
    let mut command = Command::new(chrome);
    command
        .args([
            "--headless=new",
            "--disable-gpu",
            "--disable-extensions",
            "--disable-dev-shm-usage",
            "--disable-background-networking",
            "--disable-component-update",
            "--disable-default-apps",
            "--disable-sync",
            "--metrics-recording-only",
            "--no-default-browser-check",
            "--no-first-run",
            "--no-sandbox",
            "--remote-debugging-port=0",
            "--window-size=1280,800",
        ])
        .arg(format!("--user-data-dir={}", user_data_dir.display()))
        .arg(format!("--user-agent={GDOCS_USER_AGENT}"))
        .stderr(Stdio::piped())
        .stdout(Stdio::null())
        .kill_on_drop(true);

    command.spawn().map_err(|error| {
        WebCaptureError::BrowserError(format!("Failed to launch Chrome CDP browser: {error}"))
    })
}

async fn wait_for_devtools_ws_url(child: &mut Child) -> crate::Result<String> {
    let stderr = child.stderr.take().ok_or_else(|| {
        WebCaptureError::BrowserError("Chrome CDP process did not expose stderr".to_string())
    })?;
    let mut lines = BufReader::new(stderr).lines();
    let started = Instant::now();

    while started.elapsed() < GDOCS_BROWSER_LAUNCH_TIMEOUT {
        let line = tokio::time::timeout(Duration::from_millis(250), lines.next_line()).await;
        match line {
            Ok(Ok(Some(line))) => {
                if let Some((_, ws_url)) = line.split_once("DevTools listening on ") {
                    return Ok(ws_url.trim().to_string());
                }
            }
            Ok(Ok(None)) => {
                break;
            }
            Ok(Err(error)) => {
                return Err(WebCaptureError::BrowserError(format!(
                    "Failed to read Chrome CDP stderr: {error}"
                )));
            }
            Err(_) => {}
        }
    }

    Err(WebCaptureError::BrowserError(format!(
        "Timed out waiting for Chrome DevTools websocket URL after {} ms",
        GDOCS_BROWSER_LAUNCH_TIMEOUT.as_millis()
    )))
}

async fn cdp_send(
    ws: &mut CdpWebSocket,
    next_id: &mut u64,
    session_id: Option<&str>,
    method: &str,
    params: Value,
) -> crate::Result<Value> {
    *next_id += 1;
    let id = *next_id;
    let mut message = serde_json::json!({
        "id": id,
        "method": method,
        "params": params
    });
    if let Some(session_id) = session_id {
        message["sessionId"] = Value::String(session_id.to_string());
    }

    ws.send(Message::Text(message.to_string()))
        .await
        .map_err(|error| {
            WebCaptureError::BrowserError(format!(
                "Failed to send Chrome DevTools command {method}: {error}"
            ))
        })?;

    while let Some(message) = ws.next().await {
        let message = message.map_err(|error| {
            WebCaptureError::BrowserError(format!(
                "Failed to read Chrome DevTools response for {method}: {error}"
            ))
        })?;
        if !message.is_text() {
            continue;
        }
        let text = message.to_text().map_err(|error| {
            WebCaptureError::BrowserError(format!(
                "Chrome DevTools response for {method} was not text: {error}"
            ))
        })?;
        let value = serde_json::from_str::<Value>(text).map_err(|error| {
            WebCaptureError::ParseError(format!(
                "Failed to parse Chrome DevTools response for {method}: {error}; response={text}"
            ))
        })?;
        if value.get("id").and_then(Value::as_u64) != Some(id) {
            continue;
        }
        if let Some(error) = value.get("error") {
            return Err(WebCaptureError::BrowserError(format!(
                "Chrome DevTools command {method} failed: {error}"
            )));
        }
        return Ok(value.get("result").cloned().unwrap_or(Value::Null));
    }

    Err(WebCaptureError::BrowserError(format!(
        "Chrome DevTools websocket closed before response for {method}"
    )))
}

fn browser_model_data_from_value(value: &Value) -> BrowserModelData {
    let chunks = value
        .get("chunks")
        .and_then(Value::as_array)
        .cloned()
        .unwrap_or_default();
    let chunk_payload_bytes = model_chunk_payload_bytes(&chunks);
    let cid_urls = value
        .get("cidUrlMap")
        .and_then(Value::as_object)
        .map(|map| {
            map.iter()
                .filter_map(|(key, value)| value.as_str().map(|url| (key.clone(), url.to_string())))
                .collect::<HashMap<_, _>>()
        })
        .unwrap_or_default();
    BrowserModelData {
        chunks,
        cid_urls,
        chunk_payload_bytes,
        poll_count: 0,
        stable_for: Duration::ZERO,
    }
}

fn model_chunk_payload_bytes(chunks: &[Value]) -> usize {
    chunks
        .iter()
        .map(|chunk| serde_json::to_vec(chunk).map_or(0, |encoded| encoded.len()))
        .sum()
}

fn gdocs_editor_model_max_wait() -> Duration {
    duration_from_env_ms(
        "WEB_CAPTURE_GDOCS_MAX_WAIT_MS",
        GDOCS_EDITOR_MODEL_MAX_WAIT_DEFAULT,
    )
}

fn gdocs_editor_model_stability_window() -> Duration {
    duration_from_env_ms(
        "WEB_CAPTURE_GDOCS_STABILITY_MS",
        GDOCS_EDITOR_MODEL_STABILITY_DEFAULT,
    )
}

fn duration_from_env_ms(name: &str, default: Duration) -> Duration {
    std::env::var(name).map_or(default, |value| match value.trim().parse::<u64>() {
        Ok(ms) => Duration::from_millis(ms),
        Err(error) => {
            warn!(
                name,
                value,
                error = %error,
                default_ms = default.as_millis(),
                "ignoring invalid Google Docs model wait environment variable"
            );
            default
        }
    })
}

fn remote_images_from_capture(capture: &CapturedDocument) -> Vec<RemoteImage> {
    capture
        .images
        .iter()
        .filter_map(|node| match node {
            ContentNode::Image {
                url: Some(url),
                alt,
                ..
            } => Some(RemoteImage {
                url: url.clone(),
                alt: alt.clone(),
            }),
            ContentNode::Image { .. } | ContentNode::Text { .. } => None,
        })
        .collect()
}

/// Render a Google Docs REST API document value.
#[must_use]
pub fn render_docs_api_document(document: &Value) -> GDocsRenderedOutput {
    let blocks = structural_elements_to_blocks(
        document
            .pointer("/body/content")
            .and_then(Value::as_array)
            .map_or(&[] as &[Value], Vec::as_slice),
        document.pointer("/inlineObjects").unwrap_or(&Value::Null),
    );
    GDocsRenderedOutput {
        markdown: render_blocks_markdown(&blocks),
        html: render_blocks_html(&blocks),
        text: blocks_to_text(&blocks),
    }
}

/// Rendered document output.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct GDocsRenderedOutput {
    /// Markdown output.
    pub markdown: String,
    /// HTML output.
    pub html: String,
    /// Plain text output.
    pub text: String,
}

fn structural_elements_to_blocks(elements: &[Value], inline_objects: &Value) -> Vec<CapturedBlock> {
    let mut blocks = Vec::new();
    for element in elements {
        if let Some(paragraph) = element.get("paragraph") {
            let content = paragraph_to_content(paragraph, inline_objects);
            if !content_to_text(&content).trim().is_empty()
                || content
                    .iter()
                    .any(|node| matches!(node, ContentNode::Image { .. }))
            {
                blocks.push(CapturedBlock::Paragraph {
                    style: paragraph
                        .pointer("/paragraphStyle/namedStyleType")
                        .and_then(Value::as_str)
                        .map(ToString::to_string),
                    list: None,
                    quote: false,
                    horizontal_rule: false,
                    content,
                });
            }
        } else if let Some(table) = element.get("table") {
            blocks.push(CapturedBlock::Table(table_to_block(table, inline_objects)));
        }
    }
    blocks
}

fn table_to_block(table: &Value, inline_objects: &Value) -> TableBlock {
    let rows = table
        .get("tableRows")
        .and_then(Value::as_array)
        .map_or(&[] as &[Value], Vec::as_slice)
        .iter()
        .map(|row| TableRow {
            cells: row
                .get("tableCells")
                .and_then(Value::as_array)
                .map_or(&[] as &[Value], Vec::as_slice)
                .iter()
                .map(|cell| TableCell {
                    content: structural_elements_to_inline_content(
                        cell.get("content")
                            .and_then(Value::as_array)
                            .map_or(&[] as &[Value], Vec::as_slice),
                        inline_objects,
                    ),
                })
                .collect(),
        })
        .collect();
    TableBlock { rows }
}

fn structural_elements_to_inline_content(
    elements: &[Value],
    inline_objects: &Value,
) -> Vec<ContentNode> {
    let mut content = Vec::new();
    for element in elements {
        if let Some(paragraph) = element.get("paragraph") {
            let paragraph_content = paragraph_to_content(paragraph, inline_objects);
            if !content.is_empty() && !paragraph_content.is_empty() {
                append_text(&mut content, "\n");
            }
            content.extend(paragraph_content);
        } else if let Some(table) = element.get("table") {
            append_text(
                &mut content,
                &render_blocks_markdown(&[CapturedBlock::Table(table_to_block(
                    table,
                    inline_objects,
                ))]),
            );
        }
    }
    content
}

fn paragraph_to_content(paragraph: &Value, inline_objects: &Value) -> Vec<ContentNode> {
    let mut content = Vec::new();
    for element in paragraph
        .get("elements")
        .and_then(Value::as_array)
        .map_or(&[] as &[Value], Vec::as_slice)
    {
        if let Some(text) = element
            .pointer("/textRun/content")
            .and_then(Value::as_str)
            .map(|text| text.strip_suffix('\n').unwrap_or(text))
        {
            append_text(&mut content, text);
        } else if let Some(inline_id) = element
            .pointer("/inlineObjectElement/inlineObjectId")
            .and_then(Value::as_str)
        {
            if let Some(image) = inline_object_to_image(inline_id, inline_objects) {
                content.push(image);
            }
        }
    }
    content
}

fn inline_object_to_image(inline_id: &str, inline_objects: &Value) -> Option<ContentNode> {
    let embedded = inline_objects
        .get(inline_id)?
        .pointer("/inlineObjectProperties/embeddedObject")?;
    let url = embedded
        .pointer("/imageProperties/contentUri")
        .or_else(|| embedded.pointer("/imageProperties/sourceUri"))
        .and_then(Value::as_str)?;
    let alt = embedded
        .get("title")
        .or_else(|| embedded.get("description"))
        .and_then(Value::as_str)
        .unwrap_or("image");
    Some(ContentNode::Image {
        cid: None,
        url: Some(url.to_string()),
        alt: alt.to_string(),
        width: json_dimension_to_string(embedded.pointer("/size/width/magnitude")),
        height: json_dimension_to_string(embedded.pointer("/size/height/magnitude")),
        is_suggestion: false,
    })
}

fn json_dimension_to_string(value: Option<&Value>) -> Option<String> {
    match value? {
        Value::Number(number) => Some(number.to_string()),
        Value::String(text) if !text.is_empty() => Some(text.clone()),
        _ => None,
    }
}

fn build_model_style_maps(
    items: &[Value],
    text_len: usize,
    utf16_position_map: &[usize],
) -> ModelStyleMaps {
    let mut maps = ModelStyleMaps {
        inline_styles: vec![TextStyle::default(); text_len],
        ..ModelStyleMaps::default()
    };

    for item in items {
        if item.get("ty").and_then(Value::as_str) != Some("as") {
            continue;
        }
        let (Some(start), Some(end), Some(style_type)) = (
            item.get("si").and_then(Value::as_u64),
            item.get("ei").and_then(Value::as_u64),
            item.get("st").and_then(Value::as_str),
        ) else {
            continue;
        };
        let (Ok(start), Ok(end)) = (usize::try_from(start), usize::try_from(end)) else {
            continue;
        };

        let start = utf16_position_to_char_position(utf16_position_map, start);
        let end = utf16_position_to_char_position(utf16_position_map, end);
        if start == 0 || end == 0 {
            continue;
        }

        match style_type {
            "text" => {
                let style = text_style(item);
                apply_inline_style(&mut maps.inline_styles, start, end, &style);
            }
            "link" => {
                let style = TextStyle {
                    link: item
                        .pointer("/sm/lnks_link/ulnk_url")
                        .and_then(Value::as_str)
                        .map(ToString::to_string),
                    ..TextStyle::default()
                };
                apply_inline_style(&mut maps.inline_styles, start, end, &style);
            }
            "paragraph" => {
                maps.paragraph_by_end
                    .insert(end, paragraph_style_from_model(item));
            }
            "list" => {
                maps.list_by_end.insert(
                    end,
                    ListMeta {
                        id: item
                            .pointer("/sm/ls_id")
                            .and_then(Value::as_str)
                            .unwrap_or("")
                            .to_string(),
                        level: item
                            .pointer("/sm/ls_nest")
                            .and_then(Value::as_u64)
                            .and_then(|value| usize::try_from(value).ok())
                            .unwrap_or(0),
                        ordered: false,
                    },
                );
            }
            "horizontal_rule" => {
                maps.horizontal_rules.insert(end);
            }
            _ => {}
        }
    }

    maps
}

fn apply_inline_style(styles: &mut [TextStyle], start: usize, end: usize, patch: &TextStyle) {
    let from = start.saturating_sub(1);
    let to = end.min(styles.len());
    if from >= to {
        return;
    }
    for style in &mut styles[from..to] {
        if patch.bold {
            style.bold = true;
        }
        if patch.italic {
            style.italic = true;
        }
        if patch.strike {
            style.strike = true;
        }
        if patch.link.is_some() {
            style.link.clone_from(&patch.link);
        }
    }
}

fn text_style(item: &Value) -> TextStyle {
    TextStyle {
        bold: item.pointer("/sm/ts_bd").and_then(Value::as_bool) == Some(true)
            && item.pointer("/sm/ts_bd_i").and_then(Value::as_bool) != Some(true),
        italic: item.pointer("/sm/ts_it").and_then(Value::as_bool) == Some(true)
            && item.pointer("/sm/ts_it_i").and_then(Value::as_bool) != Some(true),
        strike: item.pointer("/sm/ts_st").and_then(Value::as_bool) == Some(true)
            && item.pointer("/sm/ts_st_i").and_then(Value::as_bool) != Some(true),
        link: None,
    }
}

fn paragraph_style_from_model(item: &Value) -> ParagraphStyle {
    let heading = item.pointer("/sm/ps_hd").and_then(Value::as_u64);
    ParagraphStyle {
        style: heading.map(|level| format!("HEADING_{level}")),
        indent_start: item
            .pointer("/sm/ps_il")
            .and_then(Value::as_f64)
            .unwrap_or(0.0),
        indent_first_line: item
            .pointer("/sm/ps_ifl")
            .and_then(Value::as_f64)
            .unwrap_or(0.0),
    }
}

fn build_utf16_position_map(text: &str) -> Vec<usize> {
    let mut map = vec![0; text.encode_utf16().count() + 1];
    let mut utf16_pos = 1usize;
    for (idx, ch) in text.chars().enumerate() {
        let char_pos = idx + 1;
        for _ in 0..ch.len_utf16() {
            if let Some(slot) = map.get_mut(utf16_pos) {
                *slot = char_pos;
            }
            utf16_pos += 1;
        }
    }
    map
}

fn utf16_position_to_char_position(map: &[usize], position: usize) -> usize {
    map.get(position)
        .copied()
        .filter(|position| *position > 0)
        .or_else(|| map.iter().rfind(|position| **position > 0).copied())
        .unwrap_or(0)
}

/// Parse captured `DOCS_modelChunk` values.
#[must_use]
pub fn parse_model_chunks<S: BuildHasher>(
    chunks: &[Value],
    cid_urls: &HashMap<String, String, S>,
) -> CapturedDocument {
    parse_model_chunks_with_export_html(chunks, cid_urls, None)
}

/// Parse captured `DOCS_modelChunk` values and optionally merge semantic hints
/// from Google Docs export HTML.
#[must_use]
#[allow(clippy::too_many_lines)]
pub fn parse_model_chunks_with_export_html<S: BuildHasher>(
    chunks: &[Value],
    cid_urls: &HashMap<String, String, S>,
    export_html: Option<&str>,
) -> CapturedDocument {
    let items = collect_model_items(chunks);
    let full_text = items
        .iter()
        .filter(|item| matches!(item.get("ty").and_then(Value::as_str), Some("is" | "iss")))
        .filter_map(|item| item.get("s").and_then(Value::as_str))
        .collect::<String>();
    let chars: Vec<char> = full_text.chars().collect();
    let utf16_position_map = build_utf16_position_map(&full_text);
    let style_maps = build_model_style_maps(&items, chars.len(), &utf16_position_map);

    let mut positions = HashMap::new();
    for item in &items {
        if matches!(item.get("ty").and_then(Value::as_str), Some("te" | "ste")) {
            if let (Some(id), Some(pos)) = (
                item.get("id").and_then(Value::as_str),
                item.get("spi").and_then(Value::as_u64),
            ) {
                if let Ok(pos) = usize::try_from(pos) {
                    positions.insert(
                        id.to_string(),
                        utf16_position_to_char_position(&utf16_position_map, pos).saturating_sub(1),
                    );
                }
            }
        }
    }

    let mut images_by_pos: HashMap<usize, ContentNode> = HashMap::new();
    let mut images = Vec::new();
    for item in &items {
        let ty = item.get("ty").and_then(Value::as_str);
        if !matches!(ty, Some("ae" | "ase")) {
            continue;
        }
        let Some(id) = item.get("id").and_then(Value::as_str) else {
            continue;
        };
        let Some(pos) = positions.get(id).copied() else {
            continue;
        };
        let cid = item
            .pointer("/epm/ee_eo/i_cid")
            .and_then(Value::as_str)
            .map(ToString::to_string);
        let node = ContentNode::Image {
            url: cid.as_ref().and_then(|cid| cid_urls.get(cid).cloned()),
            cid,
            alt: item
                .pointer("/epm/ee_eo/eo_ad")
                .and_then(Value::as_str)
                .unwrap_or_else(|| {
                    if ty == Some("ase") {
                        "suggested image"
                    } else {
                        "image"
                    }
                })
                .to_string(),
            width: json_dimension_to_string(item.pointer("/epm/ee_eo/i_wth")),
            height: json_dimension_to_string(item.pointer("/epm/ee_eo/i_ht")),
            is_suggestion: ty == Some("ase"),
        };
        images_by_pos.insert(pos, node.clone());
        images.push(node);
    }

    let mut blocks = Vec::new();
    let mut tables = Vec::new();
    let mut paragraph = Vec::new();
    let mut table: Option<TableBlock> = None;
    let mut row: Option<TableRow> = None;
    let mut cell: Option<TableCell> = None;
    let mut previous_table_control: Option<u32> = None;
    let mut skip_next_table_newline = false;

    for (idx, ch) in chars.iter().copied().enumerate() {
        match ch as u32 {
            0x10 => {
                flush_paragraph(&mut paragraph, &mut blocks, Some(idx + 1), &style_maps);
                table = Some(TableBlock::default());
                previous_table_control = Some(0x10);
                skip_next_table_newline = false;
            }
            0x11 => {
                flush_table(&mut table, &mut row, &mut cell, &mut tables, &mut blocks);
                previous_table_control = None;
                skip_next_table_newline = false;
            }
            0x12 => {
                flush_row(&mut row, &mut cell, table.as_mut(), true);
                row = Some(TableRow::default());
                previous_table_control = Some(0x12);
                skip_next_table_newline = false;
            }
            0x1c => {
                if cell.as_ref().is_none_or(cell_is_empty) && previous_table_control == Some(0x0a) {
                    previous_table_control = Some(0x1c);
                    continue;
                }
                let had_content = cell.as_ref().is_some_and(|cell| !cell_is_empty(cell));
                flush_cell(&mut row, &mut cell, false);
                if row.is_none() {
                    row = Some(TableRow::default());
                }
                cell = Some(TableCell::default());
                if had_content && chars.get(idx + 1).is_some_and(|ch| *ch as u32 == 0x0a) {
                    skip_next_table_newline = true;
                }
                previous_table_control = Some(0x1c);
            }
            0x0a => {
                if table.is_some() {
                    if skip_next_table_newline {
                        skip_next_table_newline = false;
                        previous_table_control = Some(0x0a);
                        continue;
                    }
                    // Inside a table, a bare newline separates cells within the
                    // current row (rows are delimited by 0x12/0x11). See R2.
                    flush_cell(&mut row, &mut cell, false);
                    if row.is_none() {
                        row = Some(TableRow::default());
                    }
                    cell = Some(TableCell::default());
                    previous_table_control = Some(0x0a);
                } else {
                    flush_paragraph(&mut paragraph, &mut blocks, Some(idx + 1), &style_maps);
                }
            }
            0x0b => {
                append_to_current(
                    &mut paragraph,
                    &mut row,
                    &mut cell,
                    table.is_some(),
                    "\n",
                    TextStyle::default(),
                );
                previous_table_control = None;
                skip_next_table_newline = false;
            }
            _ => {
                if let Some(image) = images_by_pos.get(&idx).cloned() {
                    push_to_current(&mut paragraph, &mut row, &mut cell, table.is_some(), image);
                    previous_table_control = None;
                    skip_next_table_newline = false;
                    if ch == '*' {
                        continue;
                    }
                }
                append_to_current(
                    &mut paragraph,
                    &mut row,
                    &mut cell,
                    table.is_some(),
                    &ch.to_string(),
                    style_maps
                        .inline_styles
                        .get(idx)
                        .cloned()
                        .unwrap_or_default(),
                );
                previous_table_control = None;
                skip_next_table_newline = false;
            }
        }
    }

    if table.is_some() {
        flush_table(&mut table, &mut row, &mut cell, &mut tables, &mut blocks);
    }
    flush_paragraph(&mut paragraph, &mut blocks, Some(chars.len()), &style_maps);

    let mut capture = CapturedDocument {
        text: blocks_to_text(&blocks),
        blocks,
        tables,
        images,
    };
    if let Some(export_html) = export_html {
        apply_export_semantic_hints(&mut capture.blocks, export_html);
        capture.text = blocks_to_text(&capture.blocks);
    }
    capture
}

fn collect_model_items(chunks: &[Value]) -> Vec<Value> {
    let mut items = Vec::new();
    for chunk in chunks {
        if let Some(array) = chunk.as_array() {
            items.extend(array.iter().cloned());
        } else if let Some(array) = chunk.get("chunk").and_then(Value::as_array) {
            items.extend(array.iter().cloned());
        } else if chunk.get("ty").and_then(Value::as_str).is_some() {
            items.push(chunk.clone());
        }
    }
    items
}

fn flush_paragraph(
    paragraph: &mut Vec<ContentNode>,
    blocks: &mut Vec<CapturedBlock>,
    end_pos: Option<usize>,
    style_maps: &ModelStyleMaps,
) {
    if !content_to_text(paragraph).trim().is_empty()
        || paragraph
            .iter()
            .any(|node| matches!(node, ContentNode::Image { .. }))
    {
        let meta =
            paragraph_meta_for_end_position(style_maps, end_pos, content_to_text(paragraph).trim());
        blocks.push(CapturedBlock::Paragraph {
            content: std::mem::take(paragraph),
            style: meta.style,
            list: meta.list,
            quote: meta.quote,
            horizontal_rule: meta.horizontal_rule,
        });
    } else {
        paragraph.clear();
    }
}

fn paragraph_meta_for_end_position(
    style_maps: &ModelStyleMaps,
    end_pos: Option<usize>,
    text: &str,
) -> ParagraphMeta {
    let Some(end_pos) = end_pos else {
        return ParagraphMeta::default();
    };
    let paragraph_style = style_maps.paragraph_by_end.get(&end_pos);
    let mut meta = ParagraphMeta {
        style: paragraph_style.and_then(|style| style.style.clone()),
        ..ParagraphMeta::default()
    };

    if let Some(list) = style_maps.list_by_end.get(&end_pos) {
        let mut list = list.clone();
        list.ordered = infer_ordered_list(&list, text);
        meta.list = Some(list);
    } else if paragraph_style.is_some_and(|style| {
        style.indent_start > 0.0
            && (style.indent_start - style.indent_first_line).abs() < f64::EPSILON
    }) {
        meta.quote = true;
    }

    meta.horizontal_rule = (style_maps.horizontal_rules.contains(&end_pos)
        || end_pos
            .checked_sub(1)
            .is_some_and(|pos| style_maps.horizontal_rules.contains(&pos)))
        && text.trim().chars().all(|ch| ch == '-');
    meta
}

const fn infer_ordered_list(_list: &ListMeta, _text: &str) -> bool {
    false
}

fn apply_export_semantic_hints(blocks: &mut [CapturedBlock], export_html: &str) {
    let hints = extract_export_semantic_hints(export_html);
    let mut cursor = 0usize;
    for block in blocks {
        let CapturedBlock::Paragraph {
            content,
            list,
            quote,
            ..
        } = block
        else {
            continue;
        };
        let text = normalize_semantic_text(&content_to_text(content));
        if text.is_empty() {
            continue;
        }
        let Some((index, hint)) = find_next_semantic_hint(&hints, &text, cursor, list.is_some())
        else {
            continue;
        };
        cursor = index + 1;
        if let Some(list) = list.as_mut() {
            if let Some(ordered) = hint.list_ordered {
                list.ordered = ordered;
            }
        } else {
            *quote = hint.quote;
        }
    }
}

fn find_next_semantic_hint<'a>(
    hints: &'a [ExportSemanticHint],
    text: &str,
    cursor: usize,
    needs_list_hint: bool,
) -> Option<(usize, &'a ExportSemanticHint)> {
    hints.iter().enumerate().skip(cursor).find(|(_, hint)| {
        hint.text == text
            && if needs_list_hint {
                hint.list_ordered.is_some()
            } else {
                hint.list_ordered.is_none()
            }
    })
}

fn extract_export_semantic_hints(export_html: &str) -> Vec<ExportSemanticHint> {
    let preprocessed = preprocess_google_docs_export_html(export_html).html;
    let document = Html::parse_document(&preprocessed);
    let selector =
        Selector::parse("body h1,body h2,body h3,body h4,body h5,body h6,body p,body li")
            .expect("valid semantic hint selector");
    document
        .select(&selector)
        .filter_map(|element| {
            let tag = element.value().name();
            let text = export_element_semantic_text(&element);
            if text.is_empty() {
                return None;
            }
            let list_ordered = if tag == "li" {
                nearest_list_is_ordered(&element)
            } else {
                None
            };
            Some(ExportSemanticHint {
                text,
                list_ordered,
                quote: tag != "li" && has_ancestor_tag(&element, "blockquote"),
            })
        })
        .collect()
}

fn export_element_semantic_text(element: &ElementRef<'_>) -> String {
    let raw_text = if element.value().name() == "li" {
        list_item_own_text(element)
    } else {
        element.text().collect()
    };
    normalize_semantic_text(&raw_text)
}

fn list_item_own_text(element: &ElementRef<'_>) -> String {
    let mut text = String::new();
    let mut stack: Vec<_> = element.children().collect();
    stack.reverse();

    while let Some(node) = stack.pop() {
        match node.value() {
            Node::Text(value) => text.push_str(value),
            Node::Element(child) if matches!(child.name(), "ol" | "ul") => {}
            Node::Element(_) => {
                let mut children: Vec<_> = node.children().collect();
                children.reverse();
                stack.extend(children);
            }
            _ => {}
        }
    }

    text
}

fn nearest_list_is_ordered(element: &ElementRef<'_>) -> Option<bool> {
    element
        .ancestors()
        .filter_map(ElementRef::wrap)
        .find_map(|ancestor| match ancestor.value().name() {
            "ol" => Some(true),
            "ul" => Some(false),
            _ => None,
        })
}

fn has_ancestor_tag(element: &ElementRef<'_>, tag: &str) -> bool {
    element
        .ancestors()
        .filter_map(ElementRef::wrap)
        .any(|ancestor| ancestor.value().name() == tag)
}

fn normalize_semantic_text(text: &str) -> String {
    text.replace('\u{a0}', " ")
        .split_whitespace()
        .collect::<Vec<_>>()
        .join(" ")
}

fn cell_is_empty(cell: &TableCell) -> bool {
    cell.content.iter().all(|node| match node {
        ContentNode::Text { text, .. } => text.trim().is_empty(),
        ContentNode::Image { .. } => false,
    })
}

fn row_is_empty(row: &TableRow) -> bool {
    row.cells.is_empty() || row.cells.iter().all(cell_is_empty)
}

fn flush_cell(row: &mut Option<TableRow>, cell: &mut Option<TableCell>, drop_empty: bool) {
    if let (Some(row), Some(cell)) = (row.as_mut(), cell.take()) {
        if drop_empty && cell_is_empty(&cell) {
            return;
        }
        row.cells.push(cell);
    }
}

fn flush_row(
    row: &mut Option<TableRow>,
    cell: &mut Option<TableCell>,
    table: Option<&mut TableBlock>,
    drop_empty_trailing_cell: bool,
) {
    flush_cell(row, cell, drop_empty_trailing_cell);
    if let (Some(table), Some(row)) = (table, row.take()) {
        table.rows.push(row);
    }
}

fn flush_table(
    table: &mut Option<TableBlock>,
    row: &mut Option<TableRow>,
    cell: &mut Option<TableCell>,
    tables: &mut Vec<TableBlock>,
    blocks: &mut Vec<CapturedBlock>,
) {
    flush_row(row, cell, table.as_mut(), true);
    if let Some(mut table) = table.take() {
        // Drop trailing empty rows that can be introduced by '\n' immediately
        // before the 0x11 table-close marker. See R2.
        while table.rows.last().is_some_and(row_is_empty) {
            table.rows.pop();
        }
        tables.push(table.clone());
        blocks.push(CapturedBlock::Table(table));
    }
}

fn push_to_current(
    paragraph: &mut Vec<ContentNode>,
    row: &mut Option<TableRow>,
    cell: &mut Option<TableCell>,
    in_table: bool,
    node: ContentNode,
) {
    if in_table {
        if row.is_none() {
            *row = Some(TableRow::default());
        }
        if cell.is_none() {
            *cell = Some(TableCell::default());
        }
        if let Some(cell) = cell.as_mut() {
            cell.content.push(node);
        }
    } else {
        paragraph.push(node);
    }
}

fn append_to_current(
    paragraph: &mut Vec<ContentNode>,
    row: &mut Option<TableRow>,
    cell: &mut Option<TableCell>,
    in_table: bool,
    text: &str,
    style: TextStyle,
) {
    if in_table {
        if row.is_none() {
            *row = Some(TableRow::default());
        }
        if cell.is_none() {
            *cell = Some(TableCell::default());
        }
        if let Some(cell) = cell.as_mut() {
            append_styled_text(&mut cell.content, text, style);
        }
    } else {
        append_styled_text(paragraph, text, style);
    }
}

fn append_text(content: &mut Vec<ContentNode>, text: &str) {
    append_styled_text(content, text, TextStyle::default());
}

fn append_styled_text(content: &mut Vec<ContentNode>, text: &str, style: TextStyle) {
    if text.is_empty() {
        return;
    }
    if let Some(ContentNode::Text {
        text: last,
        bold,
        italic,
        strike,
        link,
    }) = content.last_mut()
    {
        let last_style = TextStyle {
            bold: *bold,
            italic: *italic,
            strike: *strike,
            link: link.clone(),
        };
        if last_style == style {
            last.push_str(text);
            return;
        }
    }
    content.push(ContentNode::Text {
        text: text.to_string(),
        bold: style.bold,
        italic: style.italic,
        strike: style.strike,
        link: style.link,
    });
}

/// Render a parsed Google Docs capture as Markdown, HTML, or text.
#[must_use]
pub fn render_captured_document(capture: &CapturedDocument, format: &str) -> String {
    match format.to_lowercase().as_str() {
        "html" => render_blocks_html(&capture.blocks),
        "txt" | "text" => blocks_to_text(&capture.blocks),
        _ => render_blocks_markdown(&capture.blocks),
    }
}

/// One rendered block plus enough context for `render_blocks_markdown` to
/// choose a Markdown-safe separator.
struct RenderedBlock {
    markdown: String,
    list_id: Option<String>,
    quote: bool,
}

fn render_blocks_markdown(blocks: &[CapturedBlock]) -> String {
    // Track an ordered-list counter per (list.id, level) so ordered items are
    // numbered sequentially 1., 2., 3., ... instead of all being "1.". See R3.
    // When we re-enter a shallower list level, deeper counters reset so a new
    // parent restarts its children at 1.
    let mut counters: HashMap<(String, usize), usize> = HashMap::new();
    let mut rendered: Vec<RenderedBlock> = Vec::new();

    for block in blocks {
        match block {
            CapturedBlock::Paragraph {
                content,
                style,
                list,
                quote,
                horizontal_rule,
            } => {
                let text = render_content_markdown(content).trim().to_string();
                if text.is_empty() {
                    continue;
                }
                let ordered_index = list.as_ref().and_then(|list_meta| {
                    if !list_meta.ordered {
                        return None;
                    }
                    // Reset counters for deeper levels when we move up to a
                    // shallower level — otherwise a new parent item would see
                    // its previous children's final count.
                    let key = (list_meta.id.clone(), list_meta.level);
                    counters.retain(|(id, level), _| {
                        !(id == &list_meta.id && *level > list_meta.level)
                    });
                    let next = counters.entry(key).or_insert(0);
                    *next += 1;
                    Some(*next)
                });
                let markdown = render_paragraph_markdown(
                    &text,
                    style.as_deref(),
                    list.as_ref(),
                    *quote,
                    *horizontal_rule,
                    ordered_index,
                );
                rendered.push(RenderedBlock {
                    markdown,
                    list_id: list.as_ref().map(|l| l.id.clone()),
                    quote: *quote,
                });
            }
            CapturedBlock::Table(table) => {
                rendered.push(RenderedBlock {
                    markdown: render_table_markdown(table),
                    list_id: None,
                    quote: false,
                });
            }
        }
    }

    // Choose separator per adjacent pair: consecutive items from the same
    // Google Docs list use a single newline, including nested levels; adjacent
    // blockquote paragraphs keep a quoted blank line between them.
    let mut out = String::new();
    for (idx, block) in rendered.iter().enumerate() {
        if idx == 0 {
            out.push_str(&block.markdown);
            continue;
        }
        let prev = &rendered[idx - 1];
        if block.list_id.is_some() && prev.list_id.is_some() {
            out.push('\n');
        } else if block.quote && prev.quote {
            out.push_str("\n>\n");
        } else {
            out.push_str("\n\n");
        }
        out.push_str(&block.markdown);
    }
    if !out.is_empty() && !out.ends_with('\n') {
        out.push('\n');
    }
    out
}

fn render_paragraph_markdown(
    text: &str,
    style: Option<&str>,
    list: Option<&ListMeta>,
    quote: bool,
    horizontal_rule: bool,
    ordered_index: Option<usize>,
) -> String {
    if horizontal_rule {
        return "---".to_string();
    }
    match style {
        Some("TITLE") => format!("# {text}"),
        Some("SUBTITLE") => format!("## {text}"),
        Some(style) if style.starts_with("HEADING_") => {
            let level = style
                .trim_start_matches("HEADING_")
                .parse::<usize>()
                .unwrap_or(1);
            format!("{} {text}", "#".repeat(level.clamp(1, 6)))
        }
        _ => list.map_or_else(
            || {
                if quote {
                    text.lines()
                        .map(|line| {
                            if line.is_empty() {
                                ">".to_string()
                            } else {
                                format!("> {line}")
                            }
                        })
                        .collect::<Vec<_>>()
                        .join("\n")
                } else {
                    text.to_string()
                }
            },
            |list| {
                let indent = "    ".repeat(list.level);
                let marker = if list.ordered {
                    format!("{}.", ordered_index.unwrap_or(1))
                } else {
                    "-".to_string()
                };
                format!("{indent}{marker} {text}")
            },
        ),
    }
}

fn render_table_markdown(table: &TableBlock) -> String {
    if table.rows.is_empty() {
        return String::new();
    }
    let width = table
        .rows
        .iter()
        .map(|row| row.cells.len())
        .max()
        .unwrap_or(1);
    let rows = table
        .rows
        .iter()
        .map(|row| {
            (0..width)
                .map(|idx| {
                    row.cells.get(idx).map_or_else(String::new, |cell| {
                        escape_markdown_table_cell(&render_content_markdown(&cell.content))
                    })
                })
                .collect::<Vec<_>>()
        })
        .collect::<Vec<_>>();
    let separator = vec!["---".to_string(); width];
    std::iter::once(&rows[0])
        .chain(std::iter::once(&separator))
        .chain(rows.iter().skip(1))
        .map(|row| format!("| {} |", row.join(" | ")))
        .collect::<Vec<_>>()
        .join("\n")
}

fn render_content_markdown(content: &[ContentNode]) -> String {
    let mut rendered = String::new();
    let mut idx = 0usize;
    while idx < content.len() {
        match &content[idx] {
            ContentNode::Text {
                text,
                bold,
                italic,
                strike,
                link,
            } => {
                let link_target = link.as_deref();
                let mut runs = vec![(text.as_str(), *bold, *italic, *strike)];
                idx += 1;
                while let Some(ContentNode::Text {
                    text,
                    bold,
                    italic,
                    strike,
                    link: next_link,
                }) = content.get(idx)
                {
                    if next_link.as_deref() != link_target {
                        break;
                    }
                    runs.push((text.as_str(), *bold, *italic, *strike));
                    idx += 1;
                }
                let label = render_text_runs_markdown(&runs);
                if let Some(link_target) = link_target {
                    let _ = write!(rendered, "[{label}]({link_target})");
                } else {
                    rendered.push_str(&label);
                }
            }
            ContentNode::Image {
                url: Some(url),
                alt,
                ..
            } => {
                let _ = write!(rendered, "![{alt}]({url})");
                idx += 1;
            }
            ContentNode::Image { .. } => idx += 1,
        }
    }
    rendered
}

#[derive(Clone, Copy, Default)]
struct MarkdownMarkerState {
    bold: bool,
    italic: bool,
    strike: bool,
}

fn render_text_runs_markdown(runs: &[(&str, bool, bool, bool)]) -> String {
    let inactive = MarkdownMarkerState::default();
    let mut active = inactive;
    let mut output = String::new();
    for (text, bold, italic, strike) in runs {
        let next = MarkdownMarkerState {
            bold: *bold,
            italic: *italic,
            strike: *strike,
        };
        let mut start = 0usize;
        for (offset, ch) in text.char_indices() {
            if ch != '\n' {
                continue;
            }
            if offset > start {
                output.push_str(&markdown_marker_transition(active, next));
                output.push_str(&text[start..offset]);
                active = next;
            }
            output.push_str(&markdown_marker_transition(active, inactive));
            output.push('\n');
            active = inactive;
            start = offset + ch.len_utf8();
        }
        if start < text.len() {
            output.push_str(&markdown_marker_transition(active, next));
            output.push_str(&text[start..]);
            active = next;
        }
    }
    output.push_str(&markdown_marker_transition(active, inactive));
    output
}

fn markdown_marker_transition(active: MarkdownMarkerState, next: MarkdownMarkerState) -> String {
    let mut markers = String::new();
    if active.strike && !next.strike {
        markers.push_str("~~");
    }
    if active.italic && !next.italic {
        markers.push('*');
    }
    if active.bold && !next.bold {
        markers.push_str("**");
    }
    if !active.bold && next.bold {
        markers.push_str("**");
    }
    if !active.italic && next.italic {
        markers.push('*');
    }
    if !active.strike && next.strike {
        markers.push_str("~~");
    }
    markers
}

fn render_blocks_html(blocks: &[CapturedBlock]) -> String {
    format!(
        "<!doctype html><html><body>{}</body></html>",
        blocks
            .iter()
            .map(|block| match block {
                CapturedBlock::Paragraph {
                    content,
                    style,
                    list,
                    quote,
                    horizontal_rule,
                } => {
                    if *horizontal_rule {
                        "<hr>".to_string()
                    } else if let Some(list) = list {
                        let tag = if list.ordered { "ol" } else { "ul" };
                        format!("<{tag}><li>{}</li></{tag}>", render_content_html(content))
                    } else if *quote {
                        format!("<blockquote>{}</blockquote>", render_content_html(content))
                    } else {
                        let tag = paragraph_tag(style.as_deref());
                        format!("<{tag}>{}</{tag}>", render_content_html(content))
                    }
                }
                CapturedBlock::Table(table) => render_table_html(table),
            })
            .collect::<String>()
    )
}

fn render_table_html(table: &TableBlock) -> String {
    let mut html = String::from("<table>");
    for row in &table.rows {
        html.push_str("<tr>");
        for cell in &row.cells {
            html.push_str("<td>");
            html.push_str(&render_content_html(&cell.content));
            html.push_str("</td>");
        }
        html.push_str("</tr>");
    }
    html.push_str("</table>");
    html
}

fn render_content_html(content: &[ContentNode]) -> String {
    content
        .iter()
        .map(|node| match node {
            ContentNode::Text {
                text,
                bold,
                italic,
                strike,
                link,
            } => render_marked_html(text, *bold, *italic, *strike, link.as_deref()),
            ContentNode::Image {
                url: Some(url),
                alt,
                width,
                height,
                ..
            } => render_image_html(url, alt, width.as_deref(), height.as_deref()),
            ContentNode::Image { .. } => String::new(),
        })
        .collect()
}

fn render_image_html(url: &str, alt: &str, width: Option<&str>, height: Option<&str>) -> String {
    let mut html = format!(
        "<img src=\"{}\" alt=\"{}\"",
        escape_html(url),
        escape_html(alt)
    );
    if let Some(width) = width.filter(|value| !value.is_empty()) {
        let _ = write!(html, " width=\"{}\"", escape_html(width));
    }
    if let Some(height) = height.filter(|value| !value.is_empty()) {
        let _ = write!(html, " height=\"{}\"", escape_html(height));
    }
    html.push('>');
    html
}

fn render_marked_html(
    text: &str,
    bold: bool,
    italic: bool,
    strike: bool,
    link: Option<&str>,
) -> String {
    text.split('\n')
        .map(|segment| render_marked_html_segment(segment, bold, italic, strike, link))
        .collect::<Vec<_>>()
        .join("<br>")
}

fn render_marked_html_segment(
    text: &str,
    bold: bool,
    italic: bool,
    strike: bool,
    link: Option<&str>,
) -> String {
    if text.is_empty() {
        return String::new();
    }
    let mut output = escape_html(text);
    if bold {
        output = format!("<strong>{output}</strong>");
    }
    if italic {
        output = format!("<em>{output}</em>");
    }
    if strike {
        output = format!("<s>{output}</s>");
    }
    if let Some(link) = link {
        output = format!("<a href=\"{}\">{output}</a>", escape_html(link));
    }
    output
}

fn paragraph_tag(style: Option<&str>) -> &'static str {
    match style {
        Some("TITLE" | "HEADING_1") => "h1",
        Some("SUBTITLE" | "HEADING_2") => "h2",
        Some("HEADING_3") => "h3",
        Some("HEADING_4") => "h4",
        Some("HEADING_5") => "h5",
        Some("HEADING_6") => "h6",
        _ => "p",
    }
}

fn blocks_to_text(blocks: &[CapturedBlock]) -> String {
    blocks
        .iter()
        .map(|block| match block {
            CapturedBlock::Paragraph { content, .. } => content_to_text(content),
            CapturedBlock::Table(table) => table
                .rows
                .iter()
                .map(|row| {
                    row.cells
                        .iter()
                        .map(|cell| content_to_text(&cell.content))
                        .collect::<Vec<_>>()
                        .join("\t")
                })
                .collect::<Vec<_>>()
                .join("\n"),
        })
        .filter(|text| !text.is_empty())
        .collect::<Vec<_>>()
        .join("\n")
}

fn content_to_text(content: &[ContentNode]) -> String {
    content
        .iter()
        .map(|node| match node {
            ContentNode::Text { text, .. } => text.clone(),
            ContentNode::Image {
                url: Some(_), alt, ..
            } => format!("[{alt}]"),
            ContentNode::Image { .. } => String::new(),
        })
        .collect()
}

fn escape_html(value: &str) -> String {
    value
        .replace('&', "&amp;")
        .replace('<', "&lt;")
        .replace('>', "&gt;")
        .replace('"', "&quot;")
        .replace('\'', "&#39;")
}

fn escape_markdown_table_cell(value: &str) -> String {
    value.replace('|', "\\|").replace('\n', "<br>")
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

/// An image extracted from base64 data URIs in HTML.
#[derive(Debug, Clone)]
pub struct ExtractedImage {
    /// Local filename (e.g., "image-01.png")
    pub filename: String,
    /// Raw image bytes
    pub data: Vec<u8>,
    /// MIME type (e.g., "image/png")
    pub mime_type: String,
}

/// Result of fetching a Google Doc as an archive.
#[derive(Debug, Clone)]
pub struct GDocsArchiveResult {
    /// HTML content with local image paths
    pub html: String,
    /// Markdown content with local image paths
    pub markdown: String,
    /// Extracted images
    pub images: Vec<ExtractedImage>,
    /// Document ID
    pub document_id: String,
    /// Export URL used
    pub export_url: String,
}

/// Build a self-contained archive result from browser-model rendered output.
///
/// `DOCS_modelChunk` image nodes point at `docs-images-rt` URLs. Archive mode
/// downloads those URLs into `images/` and rewrites markdown/html references to
/// local paths so Rust browser capture matches the JavaScript archive path.
///
/// # Errors
///
/// Returns an error if the HTTP client cannot be created or an image response
/// body cannot be read. Individual failed image downloads are logged and left
/// out of the archive, matching the JS behavior.
pub async fn localize_rendered_remote_images_for_archive(
    rendered: &GDocsRenderedResult,
) -> crate::Result<GDocsArchiveResult> {
    let client = reqwest::Client::builder().build().map_err(|error| {
        WebCaptureError::FetchError(format!("Failed to create image download client: {error}"))
    })?;
    let mut seen = HashMap::new();
    let mut images = Vec::new();
    let mut next_index = 1usize;

    for image in &rendered.remote_images {
        if seen.contains_key(&image.url) {
            continue;
        }
        let filename = remote_image_filename(&image.url, next_index);
        next_index += 1;
        seen.insert(image.url.clone(), filename.clone());

        match client
            .get(&image.url)
            .header("User-Agent", GDOCS_USER_AGENT)
            .header("Accept", "image/*,*/*;q=0.8")
            .send()
            .await
        {
            Ok(response) if response.status().is_success() => {
                let mime_type = response
                    .headers()
                    .get(reqwest::header::CONTENT_TYPE)
                    .and_then(|value| value.to_str().ok())
                    .map_or_else(|| mime_type_for_filename(&filename), ToString::to_string);
                let data = response.bytes().await.map_err(|error| {
                    WebCaptureError::FetchError(format!(
                        "Failed to read Google Docs image {}: {error}",
                        image.url
                    ))
                })?;
                debug!(
                    url = %image.url,
                    filename = %filename,
                    bytes = data.len(),
                    mime_type = %mime_type,
                    "downloaded Google Docs browser-model archive image"
                );
                images.push(ExtractedImage {
                    filename,
                    data: data.to_vec(),
                    mime_type,
                });
            }
            Ok(response) => {
                warn!(
                    url = %image.url,
                    status = response.status().as_u16(),
                    "failed to download Google Docs browser-model archive image"
                );
            }
            Err(error) => {
                warn!(
                    url = %image.url,
                    error = %error,
                    "failed to download Google Docs browser-model archive image"
                );
            }
        }
    }

    let mut markdown = rendered.markdown.clone();
    let mut html = rendered.html.clone();
    for (url, filename) in seen {
        let local_path = format!("images/{filename}");
        markdown = markdown.replace(&url, &local_path);
        html = html.replace(&url, &local_path);
    }

    Ok(GDocsArchiveResult {
        html,
        markdown,
        images,
        document_id: rendered.document_id.clone(),
        export_url: rendered.export_url.clone(),
    })
}

fn remote_image_filename(url: &str, index: usize) -> String {
    let ext = crate::localize_images::get_extension_from_url(url);
    format!("image-{index:02}{ext}")
}

fn mime_type_for_filename(filename: &str) -> String {
    match filename
        .rsplit('.')
        .next()
        .unwrap_or("png")
        .to_lowercase()
        .as_str()
    {
        "jpg" | "jpeg" => "image/jpeg",
        "gif" => "image/gif",
        "webp" => "image/webp",
        "svg" => "image/svg+xml",
        _ => "image/png",
    }
    .to_string()
}

fn base64_image_pattern() -> &'static Regex {
    static PATTERN: OnceLock<Regex> = OnceLock::new();
    PATTERN.get_or_init(|| {
        Regex::new(
            r#"(<img\s[^>]*src=")data:image/(png|jpeg|jpg|gif|webp|svg\+xml);base64,([^"]+)(")"#,
        )
        .unwrap()
    })
}

/// Extract base64 data URI images from HTML content.
///
/// Google Docs HTML exports embed images as base64 data URIs.
/// This function extracts them and replaces with local file paths.
///
/// # Arguments
///
/// * `html` - HTML content with embedded base64 images
///
/// # Returns
///
/// Tuple of (updated HTML with local paths, extracted images)
#[must_use]
pub fn extract_base64_images(html: &str) -> (String, Vec<ExtractedImage>) {
    let mut images = Vec::new();
    let mut idx = 1u32;

    let updated_html = base64_image_pattern()
        .replace_all(html, |caps: &regex::Captures<'_>| {
            let prefix = &caps[1];
            let mime_ext = &caps[2];
            let base64_data = &caps[3];
            let suffix = &caps[4];

            let ext = match mime_ext {
                "jpeg" => "jpg",
                "svg+xml" => "svg",
                other => other,
            };

            let filename = format!("image-{idx:02}.{ext}");
            let mime_type = format!("image/{mime_ext}");

            if let Ok(data) = base64::engine::general_purpose::STANDARD.decode(base64_data) {
                debug!("Extracted image: {} ({} bytes)", filename, data.len());
                images.push(ExtractedImage {
                    filename: filename.clone(),
                    data,
                    mime_type,
                });
            }

            idx += 1;
            format!("{prefix}images/{filename}{suffix}")
        })
        .into_owned();

    (updated_html, images)
}

/// Fetch a Google Docs document as a ZIP archive.
///
/// Fetches the document as HTML, extracts embedded base64 images,
/// converts to Markdown, and returns all components ready for archiving.
///
/// The archive contains:
/// - `document.md` — Markdown version
/// - `document.html` — HTML version with local image paths
/// - `images/` — extracted images
///
/// # Arguments
///
/// * `url` - Google Docs URL
/// * `api_token` - Optional API token for private documents
///
/// # Errors
///
/// Returns an error if the fetch or conversion fails.
pub async fn fetch_google_doc_as_archive(
    url: &str,
    api_token: Option<&str>,
) -> crate::Result<GDocsArchiveResult> {
    let result = fetch_google_doc(url, "html", api_token).await?;

    let preprocess = preprocess_google_docs_export_html(&result.content);
    debug!(
        document_id = %result.document_id,
        hoisted = preprocess.hoisted,
        unwrapped_links = preprocess.unwrapped_links,
        "google-docs-export pre-processor rewrote archive markup"
    );

    let (local_html, images) = extract_base64_images(&preprocess.html);

    let markdown = normalize_google_docs_export_markdown(
        &crate::markdown::convert_html_to_markdown(&local_html, None)?,
    );

    debug!(
        "Archive prepared: {} images extracted, {} bytes HTML, {} bytes Markdown",
        images.len(),
        local_html.len(),
        markdown.len()
    );

    Ok(GDocsArchiveResult {
        html: local_html,
        markdown,
        images,
        document_id: result.document_id,
        export_url: result.export_url,
    })
}

/// Create a ZIP archive from a `GDocsArchiveResult`.
///
/// # Arguments
///
/// * `archive` - The archive result to bundle
/// * `pretty_html` - Whether to pretty-print the HTML output
///
/// # Errors
///
/// Returns an error if ZIP creation fails.
pub fn create_archive_zip(
    archive: &GDocsArchiveResult,
    pretty_html: bool,
) -> crate::Result<Vec<u8>> {
    let mut buf = std::io::Cursor::new(Vec::new());

    {
        let mut zip = zip::ZipWriter::new(&mut buf);
        let options = zip::write::SimpleFileOptions::default()
            .compression_method(zip::CompressionMethod::Deflated);

        zip.start_file("document.md", options)
            .map_err(|e| WebCaptureError::IoError(std::io::Error::other(e)))?;
        zip.write_all(archive.markdown.as_bytes())?;

        let html_output = if pretty_html {
            crate::html::pretty_print_html(&archive.html)
        } else {
            archive.html.clone()
        };
        zip.start_file("document.html", options)
            .map_err(|e| WebCaptureError::IoError(std::io::Error::other(e)))?;
        zip.write_all(html_output.as_bytes())?;

        for img in &archive.images {
            zip.start_file(format!("images/{}", img.filename), options)
                .map_err(|e| WebCaptureError::IoError(std::io::Error::other(e)))?;
            zip.write_all(&img.data)?;
        }

        zip.finish()
            .map_err(|e| WebCaptureError::IoError(std::io::Error::other(e)))?;
    }

    Ok(buf.into_inner())
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;

    #[test]
    fn browser_model_fingerprint_includes_payload_size() {
        let small = browser_model_data_from_value(&json!({
            "chunks": [{ "chunk": [{ "ty": "is", "s": "first" }] }],
            "cidUrlMap": {}
        }));
        let larger = browser_model_data_from_value(&json!({
            "chunks": [{ "chunk": [{ "ty": "is", "s": "first and later text" }] }],
            "cidUrlMap": {}
        }));

        assert_eq!(small.fingerprint().chunks, larger.fingerprint().chunks);
        assert_ne!(
            small.fingerprint().payload_bytes,
            larger.fingerprint().payload_bytes
        );
    }

    #[test]
    fn browser_model_quiescence_resets_when_chunks_change() {
        let start = Instant::now();
        let stability_window = Duration::from_millis(1500);
        let one_chunk = BrowserModelFingerprint {
            chunks: 1,
            payload_bytes: 100,
        };
        let two_chunks = BrowserModelFingerprint {
            chunks: 2,
            payload_bytes: 200,
        };
        let mut quiescence = BrowserModelQuiescence::default();

        assert_eq!(quiescence.observe(one_chunk, start, stability_window), None);
        assert_eq!(
            quiescence.observe(
                one_chunk,
                start + Duration::from_millis(250),
                stability_window
            ),
            None
        );
        assert_eq!(
            quiescence.observe(
                two_chunks,
                start + Duration::from_millis(500),
                stability_window
            ),
            None
        );
        assert_eq!(
            quiescence.observe(
                two_chunks,
                start + Duration::from_millis(750),
                stability_window
            ),
            None
        );
        assert_eq!(
            quiescence.observe(
                two_chunks,
                start + Duration::from_millis(2300),
                stability_window
            ),
            Some(Duration::from_millis(1550))
        );
    }
}
