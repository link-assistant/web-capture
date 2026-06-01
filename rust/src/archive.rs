//! Build a self-contained ZIP archive from raw HTML.
//!
//! Pins the default `--format archive` layout contract (see issue #113): the
//! produced zip contains **exactly** `document.md`, `document.html`, and an
//! `images/` folder, identical across every capture path.

use crate::extract_images::extract_base64_to_buffers;
use crate::gdocs::{create_archive_zip, ExtractedImage, GDocsArchiveResult};
use crate::markdown::convert_html_to_markdown;

/// Build a default `--format archive` ZIP (`Vec<u8>`) from raw HTML.
///
/// The archive contains exactly:
/// - `document.md` — markdown that references images by **relative** path to
///   the bundled `images/` folder.
/// - `document.html` — the source HTML the markdown was derived from, for
///   reference only (so reviewers can verify the conversion).
/// - `images/` — every inline base64 image as a separate file, in its original
///   format (PNG/JPEG/SVG…).
///
/// # Arguments
///
/// * `html` - Source HTML to convert.
/// * `base_url` - Base URL used to resolve relative links during conversion.
///
/// # Errors
///
/// Returns an error if HTML→Markdown conversion or ZIP creation fails.
pub fn build_zip_from_html(html: &str, base_url: &str) -> crate::Result<Vec<u8>> {
    let markdown = convert_html_to_markdown(html, Some(base_url))?;
    let buffers = extract_base64_to_buffers(&markdown, "images")?;

    let archive = GDocsArchiveResult {
        html: html.to_string(),
        markdown: buffers.markdown,
        images: buffers
            .images
            .into_iter()
            .map(|b| ExtractedImage {
                filename: b.filename,
                data: b.data,
                mime_type: String::new(),
            })
            .collect(),
        document_id: String::new(),
        export_url: base_url.to_string(),
    };

    create_archive_zip(&archive, true)
}
