//! Extract base64 data URI images from markdown and save as files.

use base64::Engine;
use regex::Regex;
use std::collections::hash_map::DefaultHasher;
use std::fs;
use std::hash::{Hash, Hasher};
use std::path::{Path, PathBuf};
use std::sync::OnceLock;
use tracing::{debug, warn};

fn base64_md_image_pattern() -> &'static Regex {
    static PATTERN: OnceLock<Regex> = OnceLock::new();
    PATTERN.get_or_init(|| {
        // Capture groups:
        //   1: alt text
        //   2: image subtype (png|jpeg|...)
        //   3: base64 payload — strictly alphabet/digits/+, /, =
        // An optional trailing ` "title"` block is matched but discarded, so
        // markdown like `![](data:...;base64,XYZ== "")` decodes cleanly
        // instead of letting the empty title leak into the base64 payload.
        Regex::new(
            r#"!\[([^\]]*)\]\(data:image/(png|jpeg|jpg|gif|webp|svg\+xml);base64,([A-Za-z0-9+/=]+)(?:\s+"[^"]*")?\)"#,
        )
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

/// Extract base64 images from markdown into memory buffers without writing to disk.
/// Intended for streaming into archives.
pub fn extract_base64_to_buffers(
    markdown: &str,
    images_dir: &str,
) -> crate::Result<ExtractedBuffers> {
    let mut images: Vec<ImageBuffer> = Vec::new();

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
                        images.push(ImageBuffer { filename, data });
                        format!("![{alt_text}]({relative_path})")
                    },
                )
        });

    Ok(ExtractedBuffers {
        markdown: updated_markdown.into_owned(),
        images,
    })
}

/// Result of extracting base64 images to memory buffers.
#[derive(Debug, Clone)]
pub struct ExtractedBuffers {
    pub markdown: String,
    pub images: Vec<ImageBuffer>,
}

/// An extracted image as an in-memory buffer.
#[derive(Debug, Clone)]
pub struct ImageBuffer {
    pub filename: String,
    pub data: Vec<u8>,
}

/// Strip base64 data URI images from markdown, leaving a visible placeholder.
///
/// Non-empty alt becomes `*[image: <alt>]*`. Empty alt — common for Google
/// Docs HTML exports, which emit `<img alt="" src="data:...">` for every
/// image — becomes `![]()`, an empty markdown image reference that renderers
/// still surface as a slot. Emitting `""` for empty-alt would silently delete
/// every image in the document (see issue #117).
#[must_use]
pub fn strip_base64_images(markdown: &str) -> StrippedResult {
    let mut stripped = 0;
    let updated = base64_md_image_pattern().replace_all(markdown, |caps: &regex::Captures<'_>| {
        stripped += 1;
        let alt_text = &caps[1];
        if alt_text.is_empty() {
            "![]()".to_string()
        } else {
            format!("*[image: {alt_text}]*")
        }
    });
    StrippedResult {
        markdown: updated.into_owned(),
        stripped,
    }
}

/// Result of stripping base64 images.
#[derive(Debug, Clone)]
pub struct StrippedResult {
    pub markdown: String,
    pub stripped: usize,
}

/// Check if markdown contains any base64 data URI images.
#[must_use]
pub fn has_base64_images(markdown: &str) -> bool {
    base64_md_image_pattern().is_match(markdown)
}

/// Matches a markdown image whose source is a remote `http(s)` URL. A trailing
/// markdown title attribute (e.g. `![](url "caption")`) is matched but excluded
/// from the captured URL.
fn remote_md_image_pattern() -> &'static Regex {
    static PATTERN: OnceLock<Regex> = OnceLock::new();
    PATTERN.get_or_init(|| {
        Regex::new(r#"!\[([^\]]*)\]\((https?://[^)\s]+)(?:\s+"[^"]*")?\)"#).unwrap()
    })
}

fn remote_image_extension(url: &str) -> &'static str {
    let path = url.split(['?', '#']).next().unwrap_or(url);
    let lower = path.rsplit('.').next().unwrap_or("").to_lowercase();
    match lower.as_str() {
        "jpg" | "jpeg" => "jpg",
        "gif" => "gif",
        "webp" => "webp",
        "svg" => "svg",
        _ => "png",
    }
}

/// How the unified image pipeline should treat images in captured markdown.
///
/// This is the single chokepoint every CLI/server capture path routes through,
/// so the same flag produces the same result regardless of capture method
/// (browser vs API, JS vs Rust). See issue #112.
#[derive(Debug, Clone)]
pub enum ImageMode {
    /// Default `--format markdown` contract: keep remote URLs as **direct
    /// links**, and strip inline base64 data URIs (which have no remote URL to
    /// restore) down to a visible placeholder. No `images/` folder is written
    /// and no multi-megabyte base64 blob is silently kept inline.
    Default,
    /// `--embed-images`: keep base64 data URIs inline so the output is a single
    /// self-contained file.
    Embed,
    /// `--extract-images`: extract base64 images to files under `dir/subdir`,
    /// and rewrite remote image references to the same local `subdir/` paths
    /// (the remote bytes are downloaded by the caller — see `pending_remote`).
    Extract { dir: PathBuf, subdir: String },
}

/// A remote image whose reference was rewritten to a local path by
/// [`ImageMode::Extract`] but whose bytes still need to be downloaded.
#[derive(Debug, Clone)]
pub struct PendingRemoteImage {
    /// Original remote URL.
    pub url: String,
    /// Local filename (relative to the images subdirectory).
    pub filename: String,
}

/// Result of applying an [`ImageMode`] to markdown.
#[derive(Debug, Clone)]
pub struct ApplyResult {
    /// Rewritten markdown.
    pub markdown: String,
    /// Number of base64 images extracted to disk.
    pub extracted: usize,
    /// Number of base64 images stripped to placeholders.
    pub stripped: usize,
    /// Remote images whose references were localized and still need downloading.
    pub pending_remote: Vec<PendingRemoteImage>,
}

/// Apply an [`ImageMode`] to markdown — the single image-handling chokepoint.
///
/// `base_url` is reserved for resolving relative image URLs and is currently
/// unused; callers pass the source document URL (or `None`).
///
/// # Errors
///
/// Returns an error if file I/O fails while extracting images to disk.
pub fn apply_image_mode(
    markdown: &str,
    mode: ImageMode,
    base_url: Option<&str>,
) -> crate::Result<ApplyResult> {
    let _ = base_url; // reserved for future relative-URL resolution
    match mode {
        ImageMode::Embed => Ok(ApplyResult {
            markdown: markdown.to_string(),
            extracted: 0,
            stripped: 0,
            pending_remote: Vec::new(),
        }),
        ImageMode::Default => {
            let result = strip_base64_images(markdown);
            if result.stripped > 0 {
                warn!(
                    "Stripped {} inline base64 image(s) for default markdown; \
                     use --embed-images to keep them inline or --extract-images to save files",
                    result.stripped
                );
            }
            Ok(ApplyResult {
                markdown: result.markdown,
                extracted: 0,
                stripped: result.stripped,
                pending_remote: Vec::new(),
            })
        }
        ImageMode::Extract { dir, subdir } => {
            // 1. Extract inline base64 images to files.
            let extracted = extract_and_save_images(markdown, &dir, &subdir)?;
            // 2. Plan localization of remote image references to the same folder.
            let mut pending_remote = Vec::new();
            let mut index = 0usize;
            let localized = remote_md_image_pattern()
                .replace_all(&extracted.markdown, |caps: &regex::Captures<'_>| {
                    let alt_text = &caps[1];
                    let url = caps[2].to_string();
                    index += 1;
                    let filename = format!("image-{index:02}.{}", remote_image_extension(&url));
                    let relative_path = format!("{subdir}/{filename}");
                    pending_remote.push(PendingRemoteImage { url, filename });
                    format!("![{alt_text}]({relative_path})")
                })
                .into_owned();
            Ok(ApplyResult {
                markdown: localized,
                extracted: extracted.extracted,
                stripped: 0,
                pending_remote,
            })
        }
    }
}
