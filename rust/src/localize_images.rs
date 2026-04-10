//! Markdown image localization module (R5).
//!
//! Post-processing tool that:
//! 1. Reads markdown text
//! 2. Extracts all external image URLs
//! 3. Downloads images to local directory
//! 4. Updates markdown to reference local paths
//!
//! Based on reference implementation from:
//! <https://github.com/link-foundation/meta-theory/blob/main/scripts/download-markdown-images.mjs>

use regex::Regex;
use serde::{Deserialize, Serialize};
use url::Url;

/// An image reference extracted from markdown.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ImageReference {
    pub full_match: String,
    pub alt_text: String,
    pub url: String,
}

/// Metadata about a localized image.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ImageMetadata {
    pub index: usize,
    pub original_url: String,
    pub alt_text: String,
    pub local_path: String,
}

/// A replacement to apply to markdown text.
#[derive(Debug, Clone)]
pub struct ImageReplacement {
    pub from: String,
    pub to: String,
    pub buffer: Option<Vec<u8>>,
    pub filename: String,
}

/// Result of localizing images.
#[derive(Debug, Clone)]
pub struct LocalizeResult {
    pub markdown: String,
    pub downloaded: usize,
    pub total: usize,
    pub replacements: Vec<ImageReplacement>,
    pub metadata: Vec<ImageMetadata>,
}

/// Options for localizing images.
#[derive(Debug, Clone)]
pub struct LocalizeOptions {
    pub images_dir: String,
    pub dry_run: bool,
    pub exclude_domains: Vec<String>,
}

impl Default for LocalizeOptions {
    fn default() -> Self {
        Self {
            images_dir: "images".to_string(),
            dry_run: false,
            exclude_domains: Vec::new(),
        }
    }
}

/// Extract image references from markdown text.
#[must_use]
pub fn extract_image_references(markdown_text: &str) -> Vec<ImageReference> {
    let re = Regex::new(r"!\[([^\]]*)\]\((https?://[^)]+)\)").unwrap();
    let mut images = Vec::new();

    for cap in re.captures_iter(markdown_text) {
        images.push(ImageReference {
            full_match: cap[0].to_string(),
            alt_text: cap[1].to_string(),
            url: cap[2].to_string(),
        });
    }

    images
}

/// Get file extension from URL.
#[must_use]
pub fn get_extension_from_url(url_str: &str) -> String {
    if let Ok(parsed) = Url::parse(url_str) {
        let path = parsed.path().split('?').next().unwrap_or("");
        if let Some(ext_match) = Regex::new(r"\.(\w+)$")
            .ok()
            .and_then(|re| re.captures(path))
        {
            let lower = ext_match[1].to_lowercase();
            if ["png", "jpg", "jpeg", "gif", "webp", "svg"].contains(&lower.as_str()) {
                return format!(".{lower}");
            }
        }
    }
    ".png".to_string()
}

/// Generate local filename for a downloaded image.
#[must_use]
pub fn generate_local_filename(url: &str, index: usize) -> String {
    let ext = get_extension_from_url(url);
    format!("image-{:02}{ext}", index + 1)
}

/// Localize images in markdown text by downloading external images
/// and replacing URLs with local paths.
///
/// Note: In the Rust implementation, actual downloading requires `reqwest`.
/// The `dry_run` mode works without network access.
pub async fn localize_images(
    markdown_text: &str,
    options: &LocalizeOptions,
) -> LocalizeResult {
    let all_images = extract_image_references(markdown_text);

    // Filter to only external images not already localized
    let external_images: Vec<&ImageReference> = all_images
        .iter()
        .filter(|img| {
            if !img.url.starts_with("http") {
                return false;
            }
            if img.url.contains(&format!("{}/", options.images_dir)) {
                return false;
            }
            for domain in &options.exclude_domains {
                if img.url.contains(domain) {
                    return false;
                }
            }
            true
        })
        .collect();

    if external_images.is_empty() {
        return LocalizeResult {
            markdown: markdown_text.to_string(),
            downloaded: 0,
            total: 0,
            replacements: Vec::new(),
            metadata: Vec::new(),
        };
    }

    let mut replacements = Vec::new();
    let mut metadata = Vec::new();
    let mut downloaded_count = 0;
    let mut updated_markdown = markdown_text.to_string();

    for (i, image) in external_images.iter().enumerate() {
        let local_filename = generate_local_filename(&image.url, i);
        let relative_path = format!("{}/{local_filename}", options.images_dir);

        if options.dry_run {
            replacements.push(ImageReplacement {
                from: image.full_match.clone(),
                to: format!("![{}]({relative_path})", image.alt_text),
                buffer: None,
                filename: local_filename,
            });
            metadata.push(ImageMetadata {
                index: i + 1,
                original_url: image.url.clone(),
                alt_text: image.alt_text.clone(),
                local_path: relative_path,
            });
            continue;
        }

        // Download the image
        match download_image(&image.url).await {
            Ok(buffer) => {
                downloaded_count += 1;
                replacements.push(ImageReplacement {
                    from: image.full_match.clone(),
                    to: format!("![{}]({relative_path})", image.alt_text),
                    buffer: Some(buffer),
                    filename: local_filename,
                });
                metadata.push(ImageMetadata {
                    index: i + 1,
                    original_url: image.url.clone(),
                    alt_text: image.alt_text.clone(),
                    local_path: relative_path,
                });
            }
            Err(_) => {
                // Keep original URL if download fails
            }
        }
    }

    // Apply replacements to markdown
    for replacement in &replacements {
        updated_markdown = updated_markdown.replace(&replacement.from, &replacement.to);
    }

    LocalizeResult {
        markdown: updated_markdown,
        downloaded: downloaded_count,
        total: external_images.len(),
        replacements,
        metadata,
    }
}

/// Download an image from a URL with retry.
async fn download_image(url: &str) -> Result<Vec<u8>, String> {
    let client = reqwest::Client::builder()
        .build()
        .map_err(|e| e.to_string())?;

    for attempt in 0..3 {
        match client.get(url).send().await {
            Ok(resp) => {
                if resp.status().is_success() {
                    match resp.bytes().await {
                        Ok(bytes) => return Ok(bytes.to_vec()),
                        Err(e) => {
                            if attempt == 2 {
                                return Err(e.to_string());
                            }
                        }
                    }
                } else if attempt == 2 {
                    return Err(format!("HTTP {}", resp.status()));
                }
            }
            Err(e) => {
                if attempt == 2 {
                    return Err(e.to_string());
                }
            }
        }
        tokio::time::sleep(std::time::Duration::from_secs(1)).await;
    }
    Err("Max retries exceeded".to_string())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_extract_image_references() {
        let md = "![Alt text](https://example.com/image.png) and ![Other](https://example.com/photo.jpg)";
        let images = extract_image_references(md);
        assert_eq!(images.len(), 2);
        assert_eq!(images[0].alt_text, "Alt text");
        assert_eq!(images[0].url, "https://example.com/image.png");
        assert_eq!(images[1].alt_text, "Other");
    }

    #[test]
    fn test_extract_image_references_no_match() {
        let md = "Just [a link](https://example.com) and no images";
        let images = extract_image_references(md);
        assert!(images.is_empty());
    }

    #[test]
    fn test_get_extension_from_url_png() {
        assert_eq!(
            get_extension_from_url("https://example.com/image.png"),
            ".png"
        );
    }

    #[test]
    fn test_get_extension_from_url_jpg() {
        assert_eq!(
            get_extension_from_url("https://example.com/photo.jpg"),
            ".jpg"
        );
    }

    #[test]
    fn test_get_extension_from_url_with_query() {
        assert_eq!(
            get_extension_from_url("https://example.com/photo.webp?v=2"),
            ".webp"
        );
    }

    #[test]
    fn test_get_extension_from_url_no_extension() {
        assert_eq!(
            get_extension_from_url("https://example.com/image"),
            ".png"
        );
    }

    #[test]
    fn test_generate_local_filename() {
        assert_eq!(
            generate_local_filename("https://example.com/photo.jpg", 0),
            "image-01.jpg"
        );
        assert_eq!(
            generate_local_filename("https://example.com/photo.jpg", 9),
            "image-10.jpg"
        );
    }

    #[tokio::test]
    async fn test_localize_images_dry_run() {
        let md = "![test](https://example.com/img.png)";
        let opts = LocalizeOptions {
            dry_run: true,
            ..Default::default()
        };
        let result = localize_images(md, &opts).await;
        assert_eq!(result.total, 1);
        assert!(result.markdown.contains("images/image-01.png"));
    }

    #[tokio::test]
    async fn test_localize_images_exclude_domain() {
        let md = "![test](https://excluded.com/img.png)";
        let opts = LocalizeOptions {
            dry_run: true,
            exclude_domains: vec!["excluded.com".to_string()],
            ..Default::default()
        };
        let result = localize_images(md, &opts).await;
        assert_eq!(result.total, 0);
        assert!(result.markdown.contains("https://excluded.com"));
    }

    #[tokio::test]
    async fn test_localize_images_already_local() {
        let md = "![test](images/image-01.png)";
        let opts = LocalizeOptions {
            dry_run: true,
            ..Default::default()
        };
        let result = localize_images(md, &opts).await;
        assert_eq!(result.total, 0);
    }
}
