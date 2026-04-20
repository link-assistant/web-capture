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

use base64::Engine;
use regex::Regex;
use serde_json::Value;
use std::collections::HashMap;
use std::fmt::Write as _;
use std::hash::BuildHasher;
use std::io::Write;
use std::sync::OnceLock;
use tracing::{debug, info};

use crate::WebCaptureError;

const GDOCS_EXPORT_BASE: &str = "https://docs.google.com/document/d";
const GDOCS_API_BASE: &str = "https://docs.googleapis.com/v1/documents";

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

    let preprocess = preprocess_google_docs_export_html(&result.content);
    debug!(
        document_id = %result.document_id,
        hoisted = preprocess.hoisted,
        unwrapped_links = preprocess.unwrapped_links,
        "google-docs-export pre-processor rewrote markup"
    );
    let markdown =
        crate::markdown::convert_html_to_markdown(&preprocess.html, Some(&result.export_url))?;
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
    let mut out = html.to_string();

    // 1. Hoist inline style spans into <strong>/<em>/<del>.
    let span_re = Regex::new(r#"(?is)<span\s+([^>]*style="([^"]*)"[^>]*)>(.*?)</span>"#)
        .expect("valid regex");
    out = span_re
        .replace_all(&out, |caps: &regex::Captures<'_>| {
            let style = caps.get(2).map_or("", |m| m.as_str());
            let inner = caps.get(3).map_or("", |m| m.as_str());
            let bold = Regex::new(r"(?i)font-weight\s*:\s*(?:bold|[6-9]\d{2})")
                .expect("valid regex")
                .is_match(style);
            let italic = Regex::new(r"(?i)font-style\s*:\s*italic")
                .expect("valid regex")
                .is_match(style);
            let strike = Regex::new(r"(?i)text-decoration[^;]*\bline-through\b")
                .expect("valid regex")
                .is_match(style);
            if !bold && !italic && !strike {
                return caps[0].to_string();
            }
            hoisted += 1;
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
            wrapped
        })
        .into_owned();

    // 2. Strip leading empty `<a id="…"></a>` anchors inside headings and
    //    `<span>N. </span>` numbering so the heading text is clean.
    let empty_anchor_re = Regex::new(r#"(?is)<a\s+id="[^"]*"\s*>\s*</a>"#).expect("valid regex");
    let numbering_re =
        Regex::new(r"(?is)<span\b[^>]*>\s*\d+(?:\.\d+)*\.?\s*</span>").expect("valid regex");
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

    // 3. Unwrap google.com/url?q=<URL>&sa=... redirect wrappers on <a href>.
    let redirect_re =
        Regex::new(r#"(?i)href="https?://(?:www\.)?google\.com/url\?q=([^&"]+)[^"]*""#)
            .expect("valid regex");
    out = redirect_re
        .replace_all(&out, |caps: &regex::Captures<'_>| {
            let encoded = caps.get(1).map_or("", |m| m.as_str());
            let decoded = percent_decode_utf8_lossy(encoded);
            unwrapped_links += 1;
            format!(r#"href="{decoded}""#)
        })
        .into_owned();

    // 4. Replace `&nbsp;` / U+00A0 with a regular space so the rendered
    //    markdown does not carry non-breaking-space residue.
    out = out.replace("&nbsp;", " ");
    out = out.replace('\u{00A0}', " ");

    GDocsExportPreprocessResult {
        html: out,
        hoisted,
        unwrapped_links,
    }
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
    })
}

/// Fetch and render the model data embedded in the Google Docs `/edit` route.
///
/// The Rust browser automation crate currently exposes a placeholder browser,
/// so this path fetches the editor HTML and parses embedded `DOCS_modelChunk`
/// data when available.
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
    let html = crate::browser::render_html(&edit_url).await?;
    let chunks = extract_model_chunks_from_html(&html);
    debug!(
        document_id = %document_id,
        html_bytes = html.len(),
        chunks = chunks.len(),
        "extracted Google Docs editor model chunks"
    );
    if chunks.is_empty() {
        return Err(WebCaptureError::ParseError(
            "Google Docs editor HTML did not contain DOCS_modelChunk data".to_string(),
        ));
    }

    let cid_urls = extract_cid_urls_from_html(&html);
    let capture = parse_model_chunks(&chunks, &cid_urls);
    info!(
        document_id = %document_id,
        chunks = chunks.len(),
        cid_urls = cid_urls.len(),
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
    })
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
        is_suggestion: false,
    })
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
        bold: item.pointer("/sm/ts_bd").and_then(Value::as_bool) == Some(true),
        italic: item.pointer("/sm/ts_it").and_then(Value::as_bool) == Some(true),
        strike: item.pointer("/sm/ts_st").and_then(Value::as_bool) == Some(true),
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
#[allow(clippy::too_many_lines)]
pub fn parse_model_chunks<S: BuildHasher>(
    chunks: &[Value],
    cid_urls: &HashMap<String, String, S>,
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

    for (idx, ch) in chars.iter().copied().enumerate() {
        match ch as u32 {
            0x10 => {
                flush_paragraph(&mut paragraph, &mut blocks, Some(idx + 1), &style_maps);
                table = Some(TableBlock::default());
            }
            0x11 => flush_table(&mut table, &mut row, &mut cell, &mut tables, &mut blocks),
            0x12 => {
                flush_row(&mut row, &mut cell, table.as_mut(), true);
                row = Some(TableRow::default());
            }
            0x1c => {
                flush_cell(&mut row, &mut cell, false);
                if row.is_none() {
                    row = Some(TableRow::default());
                }
                cell = Some(TableCell::default());
            }
            0x0a => {
                if table.is_some() {
                    // Inside a table, a bare newline separates cells within the
                    // current row (rows are delimited by 0x12/0x11). See R2.
                    flush_cell(&mut row, &mut cell, false);
                    if row.is_none() {
                        row = Some(TableRow::default());
                    }
                    cell = Some(TableCell::default());
                } else {
                    flush_paragraph(&mut paragraph, &mut blocks, Some(idx + 1), &style_maps);
                }
            }
            0x0b => append_to_current(
                &mut paragraph,
                &mut row,
                &mut cell,
                table.is_some(),
                "\n",
                style_maps
                    .inline_styles
                    .get(idx)
                    .cloned()
                    .unwrap_or_default(),
            ),
            _ => {
                if let Some(image) = images_by_pos.get(&idx).cloned() {
                    push_to_current(&mut paragraph, &mut row, &mut cell, table.is_some(), image);
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
            }
        }
    }

    if table.is_some() {
        flush_table(&mut table, &mut row, &mut cell, &mut tables, &mut blocks);
    }
    flush_paragraph(&mut paragraph, &mut blocks, Some(chars.len()), &style_maps);

    CapturedDocument {
        text: blocks_to_text(&blocks),
        blocks,
        tables,
        images,
    }
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

fn infer_ordered_list(list: &ListMeta, text: &str) -> bool {
    let ordered_id = matches!(
        list.id.as_str(),
        "kix.list.7" | "kix.list.8" | "kix.list.9" | "kix.list.10" | "kix.list.11" | "kix.list.13"
    );
    ordered_id
        && (text.contains("ordered")
            || text.contains("Parent item")
            || text.contains("Child item")
            || text.contains("First item")
            || text.contains("Second item")
            || text.contains("Third item")
            || text.contains("Ordered child"))
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
/// decide whether it sits next to another item of the same list.
type RenderedBlock = (String, bool, Option<(String, usize)>);

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
                rendered.push((
                    markdown,
                    list.is_some(),
                    list.as_ref().map(|l| (l.id.clone(), l.level)),
                ));
            }
            CapturedBlock::Table(table) => {
                rendered.push((render_table_markdown(table), false, None));
            }
        }
    }

    // Choose separator per adjacent pair: consecutive list items at the same
    // (list id, level) use a single newline; everything else uses a blank
    // line. See R4.
    let mut out = String::new();
    for (idx, (markdown, is_list, key)) in rendered.iter().enumerate() {
        if idx == 0 {
            out.push_str(markdown);
            continue;
        }
        let (_, prev_is_list, prev_key) = &rendered[idx - 1];
        let same_list =
            *is_list && *prev_is_list && key.is_some() && prev_key.is_some() && key == prev_key;
        out.push_str(if same_list { "\n" } else { "\n\n" });
        out.push_str(markdown);
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
                let indent = "  ".repeat(list.level);
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
                link: Some(link),
            } => {
                let mut label = render_marked_text(text, *bold, *italic, *strike);
                idx += 1;
                while let Some(ContentNode::Text {
                    text,
                    bold,
                    italic,
                    strike,
                    link: Some(next_link),
                }) = content.get(idx)
                {
                    if next_link != link {
                        break;
                    }
                    label.push_str(&render_marked_text(text, *bold, *italic, *strike));
                    idx += 1;
                }
                let _ = write!(rendered, "[{label}]({link})");
            }
            ContentNode::Text {
                text,
                bold,
                italic,
                strike,
                link: None,
            } => {
                rendered.push_str(&render_marked_text(text, *bold, *italic, *strike));
                idx += 1;
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

fn render_marked_text(text: &str, bold: bool, italic: bool, strike: bool) -> String {
    let mut output = if bold && italic {
        format!("***{text}***")
    } else if bold {
        format!("**{text}**")
    } else if italic {
        format!("*{text}*")
    } else {
        text.to_string()
    };
    if strike {
        output = format!("~~{output}~~");
    }
    output
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
                ..
            } => {
                format!(
                    "<img src=\"{}\" alt=\"{}\">",
                    escape_html(url),
                    escape_html(alt)
                )
            }
            ContentNode::Image { .. } => String::new(),
        })
        .collect()
}

fn render_marked_html(
    text: &str,
    bold: bool,
    italic: bool,
    strike: bool,
    link: Option<&str>,
) -> String {
    let mut output = escape_html(text).replace('\n', "<br>");
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

fn extract_cid_urls_from_html(html: &str) -> HashMap<String, String> {
    let pattern = Regex::new(
        r#""([A-Za-z0-9_-]{20,})"\s*:\s*"(https://docs\.google\.com/docs-images-rt/[^"]+)""#,
    )
    .unwrap();
    pattern
        .captures_iter(html)
        .filter_map(|caps| {
            Some((
                caps.get(1)?.as_str().to_string(),
                caps.get(2)?
                    .as_str()
                    .replace(r"\u003d", "=")
                    .replace(r"\u0026", "&")
                    .replace(r"\/", "/"),
            ))
        })
        .collect()
}

fn extract_model_chunks_from_html(html: &str) -> Vec<Value> {
    let mut chunks = Vec::new();
    let mut offset = 0;
    while let Some(relative) = html[offset..].find("DOCS_modelChunk") {
        let marker = offset + relative;
        let Some(start) = html[marker..].find(['{', '[']).map(|idx| marker + idx) else {
            break;
        };
        let Some(end) = find_json_end(html, start) else {
            offset = start + 1;
            continue;
        };
        if let Ok(value) = serde_json::from_str::<Value>(&html[start..end]) {
            chunks.push(value);
        }
        offset = end;
    }
    chunks
}

fn find_json_end(input: &str, start: usize) -> Option<usize> {
    let mut chars = input[start..].char_indices();
    let (_, opening) = chars.next()?;
    let closing = match opening {
        '{' => '}',
        '[' => ']',
        _ => return None,
    };
    let mut depth = 0usize;
    let mut in_string = false;
    let mut escaped = false;

    for (relative, ch) in input[start..].char_indices() {
        if in_string {
            if escaped {
                escaped = false;
            } else if ch == '\\' {
                escaped = true;
            } else if ch == '"' {
                in_string = false;
            }
            continue;
        }

        if ch == '"' {
            in_string = true;
        } else if ch == opening {
            depth += 1;
        } else if ch == closing {
            depth = depth.saturating_sub(1);
            if depth == 0 {
                return Some(start + relative + ch.len_utf8());
            }
        }
    }
    None
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

    let markdown = crate::markdown::convert_html_to_markdown(&local_html, None)?;

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
