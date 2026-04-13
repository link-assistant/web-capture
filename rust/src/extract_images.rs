//! Extract base64 data URI images from markdown and save as files.

use base64::Engine;
use regex::Regex;
use std::collections::hash_map::DefaultHasher;
use std::fs;
use std::hash::{Hash, Hasher};
use std::path::Path;
use std::sync::OnceLock;
use tracing::debug;

fn base64_md_image_pattern() -> &'static Regex {
    static PATTERN: OnceLock<Regex> = OnceLock::new();
    PATTERN.get_or_init(|| {
        Regex::new(r"!\[([^\]]*)\]\(data:image/(png|jpeg|jpg|gif|webp|svg\+xml);base64,([^)]+)\)")
            .unwrap()
    })
}

/// Result of extracting images from markdown.
#[derive(Debug, Clone)]
pub struct ExtractionResult {
    /// Updated markdown with local image paths.
    pub markdown: String,
    /// Number of images extracted.
    pub extracted: usize,
}

/// Extract base64 data URI images from markdown, save them as files,
/// and rewrite references to relative paths.
///
/// # Arguments
///
/// * `markdown` - Markdown content with data URI images
/// * `output_dir` - Directory where the markdown file is being written
/// * `images_dir` - Subdirectory name for images (default: "images")
///
/// # Errors
///
/// Returns an error if file I/O fails.
pub fn extract_and_save_images(
    markdown: &str,
    output_dir: &Path,
    images_dir: &str,
) -> crate::Result<ExtractionResult> {
    let images_path = output_dir.join(images_dir);
    let mut images: Vec<(String, Vec<u8>)> = Vec::new();

    let updated_markdown =
        base64_md_image_pattern().replace_all(markdown, |caps: &regex::Captures<'_>| {
            let alt_text = &caps[1];
            let mime_ext = &caps[2];
            let base64_data = &caps[3];

            let ext = match mime_ext {
                "jpeg" => "jpg",
                "svg+xml" => "svg",
                other => other,
            };

            base64::engine::general_purpose::STANDARD
                .decode(base64_data)
                .map_or_else(
                    |_| format!("![{alt_text}](data:image/{mime_ext};base64,{base64_data})"),
                    |data| {
                        let mut hasher = DefaultHasher::new();
                        data.hash(&mut hasher);
                        let hash = format!("{:016x}", hasher.finish());
                        let hash_prefix = &hash[..8];
                        let filename = format!("image-{hash_prefix}.{ext}");
                        let relative_path = format!("{images_dir}/{filename}");
                        debug!("Extracted image: {} ({} bytes)", filename, data.len());
                        images.push((filename, data));
                        format!("![{alt_text}]({relative_path})")
                    },
                )
        });

    let extracted = images.len();

    if !images.is_empty() {
        fs::create_dir_all(&images_path)?;
        for (filename, data) in &images {
            fs::write(images_path.join(filename), data)?;
        }
    }

    Ok(ExtractionResult {
        markdown: updated_markdown.into_owned(),
        extracted,
    })
}

/// Check if markdown contains any base64 data URI images.
#[must_use]
pub fn has_base64_images(markdown: &str) -> bool {
    base64_md_image_pattern().is_match(markdown)
}
