//! Batch processing and configuration module (R7).
//!
//! Supports processing multiple URLs from a configuration file.
//! Configuration format matches the `articles-config` pattern from meta-theory.
//!
//! Based on reference implementation from:
//! <https://github.com/link-foundation/meta-theory/blob/main/scripts/articles-config.mjs>

use serde::{Deserialize, Serialize};
use std::collections::BTreeMap;
use std::path::Path;
use url::Url;

/// Configuration for a single article.
#[derive(Debug, Clone, Default, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ArticleConfig {
    pub url: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub title: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub language: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub archive_path: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub markdown_file: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub screenshot_light_file: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub screenshot_dark_file: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub images_dir: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub has_local_images: Option<bool>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub expected_figures: Option<u32>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub format: Option<String>,
}

/// Batch configuration containing multiple articles and defaults.
#[derive(Debug, Clone, Default, Serialize, Deserialize)]
pub struct BatchConfig {
    pub articles: BTreeMap<String, ArticleConfig>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub defaults: Option<ArticleConfig>,
}

/// Validation result for batch configuration.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ValidationResult {
    pub valid: bool,
    pub errors: Vec<String>,
}

/// Load batch configuration from a JSON file.
///
/// # Errors
///
/// Returns an error if the file cannot be read or parsed.
pub fn load_config(config_path: &str) -> Result<BatchConfig, String> {
    let path = Path::new(config_path);
    let ext = path
        .extension()
        .and_then(|e| e.to_str())
        .unwrap_or("")
        .to_lowercase();

    match ext.as_str() {
        "json" => {
            let content =
                std::fs::read_to_string(config_path).map_err(|e| format!("Read error: {e}"))?;
            serde_json::from_str(&content).map_err(|e| format!("Parse error: {e}"))
        }
        _ => Err(format!(
            "Unsupported config format: .{ext}. Use .json (Rust does not support dynamic ESM imports)"
        )),
    }
}

/// Get article configuration by version/id.
///
/// Merges defaults with the specific article configuration.
///
/// # Errors
///
/// Returns an error if the version is not found.
pub fn get_article(config: &BatchConfig, version: &str) -> Result<ArticleConfig, String> {
    let article = config.articles.get(version).ok_or_else(|| {
        let available: Vec<&String> = config.articles.keys().collect();
        format!(
            "Unknown article version: {version}. Available: {}",
            available
                .iter()
                .map(|s| s.as_str())
                .collect::<Vec<_>>()
                .join(", ")
        )
    })?;

    // Merge defaults
    Ok(config.defaults.as_ref().map_or_else(
        || article.clone(),
        |defaults| merge_config(defaults, article),
    ))
}

/// Get all article versions from configuration.
#[must_use]
pub fn get_all_versions(config: &BatchConfig) -> Vec<String> {
    config.articles.keys().cloned().collect()
}

/// Get all article configurations with defaults merged.
#[must_use]
pub fn get_all_articles(config: &BatchConfig) -> Vec<ArticleConfig> {
    config
        .articles
        .values()
        .map(|article| {
            config.defaults.as_ref().map_or_else(
                || article.clone(),
                |defaults| merge_config(defaults, article),
            )
        })
        .collect()
}

/// Create a default batch configuration for a list of URLs.
#[must_use]
pub fn create_config_from_urls(urls: &[String], defaults: Option<ArticleConfig>) -> BatchConfig {
    let mut articles = BTreeMap::new();

    for (index, url) in urls.iter().enumerate() {
        let id = (index + 1).to_string();
        let hostname = Url::parse(url)
            .ok()
            .and_then(|u| u.host_str().map(String::from))
            .unwrap_or_else(|| "article".to_string());

        articles.insert(
            id.clone(),
            ArticleConfig {
                url: url.clone(),
                title: Some(format!("Article {id}")),
                archive_path: Some(format!("archive/{}/{id}", hostname.replace('.', "-"))),
                markdown_file: Some("article.md".to_string()),
                screenshot_light_file: Some("article-light.png".to_string()),
                screenshot_dark_file: Some("article-dark.png".to_string()),
                images_dir: Some("images".to_string()),
                has_local_images: Some(true),
                ..Default::default()
            },
        );
    }

    BatchConfig { articles, defaults }
}

/// Validate a batch configuration.
#[must_use]
pub fn validate_config(config: &BatchConfig) -> ValidationResult {
    let mut errors = Vec::new();

    if config.articles.is_empty() {
        errors.push("Configuration must have at least one article".to_string());
        return ValidationResult {
            valid: false,
            errors,
        };
    }

    for (id, article) in &config.articles {
        if article.url.is_empty() {
            errors.push(format!("Article \"{id}\" missing required \"url\" field"));
        } else if Url::parse(&article.url).is_err() {
            errors.push(format!("Article \"{id}\" has invalid URL: {}", article.url));
        }
    }

    ValidationResult {
        valid: errors.is_empty(),
        errors,
    }
}

/// Merge defaults into an article config (article values take precedence).
fn merge_config(defaults: &ArticleConfig, article: &ArticleConfig) -> ArticleConfig {
    ArticleConfig {
        url: if article.url.is_empty() {
            defaults.url.clone()
        } else {
            article.url.clone()
        },
        title: article.title.clone().or_else(|| defaults.title.clone()),
        language: article
            .language
            .clone()
            .or_else(|| defaults.language.clone()),
        archive_path: article
            .archive_path
            .clone()
            .or_else(|| defaults.archive_path.clone()),
        markdown_file: article
            .markdown_file
            .clone()
            .or_else(|| defaults.markdown_file.clone()),
        screenshot_light_file: article
            .screenshot_light_file
            .clone()
            .or_else(|| defaults.screenshot_light_file.clone()),
        screenshot_dark_file: article
            .screenshot_dark_file
            .clone()
            .or_else(|| defaults.screenshot_dark_file.clone()),
        images_dir: article
            .images_dir
            .clone()
            .or_else(|| defaults.images_dir.clone()),
        has_local_images: article.has_local_images.or(defaults.has_local_images),
        expected_figures: article.expected_figures.or(defaults.expected_figures),
        format: article.format.clone().or_else(|| defaults.format.clone()),
    }
}
