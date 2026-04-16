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
use std::hash::BuildHasher;
use std::io::Write;
use std::sync::OnceLock;
use tracing::debug;

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
    Text(String),
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

    let response = reqwest::Client::new()
        .get(&api_url)
        .header("Authorization", format!("Bearer {api_token}"))
        .header("Accept", "application/json")
        .send()
        .await
        .map_err(|e| {
            WebCaptureError::FetchError(format!("Failed to fetch Google Doc via Docs API: {e}"))
        })?;

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
    let document_id = extract_document_id(url).ok_or_else(|| {
        WebCaptureError::InvalidUrl(format!("Not a valid Google Docs URL: {url}"))
    })?;
    let edit_url = build_edit_url(&document_id);
    let mut request = reqwest::Client::new()
        .get(&edit_url)
        .header(
            "User-Agent",
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        )
        .header("Accept-Language", "en-US,en;q=0.9");

    if let Some(token) = api_token {
        request = request.header("Authorization", format!("Bearer {token}"));
    }

    let response = request.send().await.map_err(|e| {
        WebCaptureError::FetchError(format!("Failed to fetch Google Doc editor: {e}"))
    })?;

    if !response.status().is_success() {
        return Err(WebCaptureError::FetchError(format!(
            "Failed to fetch Google Doc editor ({} {}): {}",
            response.status().as_u16(),
            response.status().canonical_reason().unwrap_or("Unknown"),
            edit_url
        )));
    }

    let html = response.text().await.map_err(|e| {
        WebCaptureError::FetchError(format!("Failed to read Google Doc editor response: {e}"))
    })?;
    let chunks = extract_model_chunks_from_html(&html);
    if chunks.is_empty() {
        return Err(WebCaptureError::ParseError(
            "Google Docs editor HTML did not contain DOCS_modelChunk data".to_string(),
        ));
    }

    let cid_urls = extract_cid_urls_from_html(&html);
    let capture = parse_model_chunks(&chunks, &cid_urls);

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

    let mut positions = HashMap::new();
    for item in &items {
        if matches!(item.get("ty").and_then(Value::as_str), Some("te" | "ste")) {
            if let (Some(id), Some(pos)) = (
                item.get("id").and_then(Value::as_str),
                item.get("spi").and_then(Value::as_u64),
            ) {
                if let Ok(pos) = usize::try_from(pos) {
                    positions.insert(id.to_string(), pos);
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
            alt: if ty == Some("ase") {
                "suggested image".to_string()
            } else {
                "image".to_string()
            },
            is_suggestion: ty == Some("ase"),
        };
        images_by_pos.insert(pos, node.clone());
        images.push(node);
    }

    let chars: Vec<char> = full_text.chars().collect();
    let mut blocks = Vec::new();
    let mut tables = Vec::new();
    let mut paragraph = Vec::new();
    let mut table: Option<TableBlock> = None;
    let mut row: Option<TableRow> = None;
    let mut cell: Option<TableCell> = None;

    for (idx, ch) in chars.iter().copied().enumerate() {
        match ch as u32 {
            0x10 => {
                flush_paragraph(&mut paragraph, &mut blocks);
                table = Some(TableBlock::default());
            }
            0x11 => flush_table(&mut table, &mut row, &mut cell, &mut tables, &mut blocks),
            0x12 => {
                flush_row(&mut row, &mut cell, table.as_mut());
                row = Some(TableRow::default());
            }
            0x1c => {
                flush_cell(&mut row, &mut cell);
                if row.is_none() {
                    row = Some(TableRow::default());
                }
                cell = Some(TableCell::default());
            }
            0x0a => {
                if table.is_some() {
                    flush_row(&mut row, &mut cell, table.as_mut());
                } else {
                    flush_paragraph(&mut paragraph, &mut blocks);
                }
            }
            0x0b => append_to_current(&mut paragraph, &mut row, &mut cell, table.is_some(), "\n"),
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
                );
            }
        }
    }

    if table.is_some() {
        flush_table(&mut table, &mut row, &mut cell, &mut tables, &mut blocks);
    }
    flush_paragraph(&mut paragraph, &mut blocks);

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
        }
    }
    items
}

fn flush_paragraph(paragraph: &mut Vec<ContentNode>, blocks: &mut Vec<CapturedBlock>) {
    if !content_to_text(paragraph).trim().is_empty()
        || paragraph
            .iter()
            .any(|node| matches!(node, ContentNode::Image { .. }))
    {
        blocks.push(CapturedBlock::Paragraph {
            content: std::mem::take(paragraph),
            style: None,
        });
    } else {
        paragraph.clear();
    }
}

fn flush_cell(row: &mut Option<TableRow>, cell: &mut Option<TableCell>) {
    if let (Some(row), Some(cell)) = (row.as_mut(), cell.take()) {
        row.cells.push(cell);
    }
}

fn flush_row(
    row: &mut Option<TableRow>,
    cell: &mut Option<TableCell>,
    table: Option<&mut TableBlock>,
) {
    flush_cell(row, cell);
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
    flush_row(row, cell, table.as_mut());
    if let Some(table) = table.take() {
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
) {
    if in_table {
        if row.is_none() {
            *row = Some(TableRow::default());
        }
        if cell.is_none() {
            *cell = Some(TableCell::default());
        }
        if let Some(cell) = cell.as_mut() {
            append_text(&mut cell.content, text);
        }
    } else {
        append_text(paragraph, text);
    }
}

fn append_text(content: &mut Vec<ContentNode>, text: &str) {
    if text.is_empty() {
        return;
    }
    if let Some(ContentNode::Text(last)) = content.last_mut() {
        last.push_str(text);
    } else {
        content.push(ContentNode::Text(text.to_string()));
    }
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

fn render_blocks_markdown(blocks: &[CapturedBlock]) -> String {
    blocks
        .iter()
        .filter_map(|block| match block {
            CapturedBlock::Paragraph { content, style } => {
                let text = render_content_markdown(content).trim().to_string();
                if text.is_empty() {
                    None
                } else {
                    Some(render_paragraph_markdown(&text, style.as_deref()))
                }
            }
            CapturedBlock::Table(table) => Some(render_table_markdown(table)),
        })
        .collect::<Vec<_>>()
        .join("\n\n")
}

fn render_paragraph_markdown(text: &str, style: Option<&str>) -> String {
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
        _ => text.to_string(),
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
    content
        .iter()
        .map(|node| match node {
            ContentNode::Text(text) => text.clone(),
            ContentNode::Image {
                url: Some(url),
                alt,
                ..
            } => format!("![{alt}]({url})"),
            ContentNode::Image { .. } => String::new(),
        })
        .collect()
}

fn render_blocks_html(blocks: &[CapturedBlock]) -> String {
    format!(
        "<!doctype html><html><body>{}</body></html>",
        blocks
            .iter()
            .map(|block| match block {
                CapturedBlock::Paragraph { content, style } => {
                    let tag = paragraph_tag(style.as_deref());
                    format!("<{tag}>{}</{tag}>", render_content_html(content))
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
            ContentNode::Text(text) => escape_html(text).replace('\n', "<br>"),
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
            ContentNode::Text(text) => text.clone(),
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

    let (local_html, images) = extract_base64_images(&result.content);

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
