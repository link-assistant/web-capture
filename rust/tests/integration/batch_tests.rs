use std::collections::BTreeMap;
use web_capture::batch::{
    create_config_from_urls, get_all_articles, get_all_versions, get_article, validate_config,
    ArticleConfig, BatchConfig,
};

fn sample_config() -> BatchConfig {
    let mut articles = BTreeMap::new();
    articles.insert(
        "1".to_string(),
        ArticleConfig {
            url: "https://example.com/article1".to_string(),
            title: Some("Article 1".to_string()),
            ..Default::default()
        },
    );
    articles.insert(
        "2".to_string(),
        ArticleConfig {
            url: "https://example.com/article2".to_string(),
            ..Default::default()
        },
    );
    BatchConfig {
        articles,
        defaults: Some(ArticleConfig {
            markdown_file: Some("document.md".to_string()),
            images_dir: Some("images".to_string()),
            ..Default::default()
        }),
    }
}

#[test]
fn test_get_article_merges_defaults() {
    let config = sample_config();
    let article = get_article(&config, "2").unwrap();
    assert_eq!(article.markdown_file, Some("document.md".to_string()));
    assert_eq!(article.images_dir, Some("images".to_string()));
}

#[test]
fn test_get_article_unknown_version() {
    let config = sample_config();
    assert!(get_article(&config, "99").is_err());
}

#[test]
fn test_get_all_versions() {
    let config = sample_config();
    let versions = get_all_versions(&config);
    assert_eq!(versions.len(), 2);
}

#[test]
fn test_get_all_articles() {
    let config = sample_config();
    let articles = get_all_articles(&config);
    assert_eq!(articles.len(), 2);
    // All should have defaults merged
    for article in &articles {
        assert_eq!(article.images_dir, Some("images".to_string()));
    }
}

#[test]
fn test_create_config_from_urls() {
    let urls = vec![
        "https://example.com/page1".to_string(),
        "https://example.com/page2".to_string(),
    ];
    let config = create_config_from_urls(&urls, None);
    assert_eq!(config.articles.len(), 2);
    assert!(config.articles.contains_key("1"));
    assert!(config.articles.contains_key("2"));
}

#[test]
fn test_validate_config_valid() {
    let config = sample_config();
    let result = validate_config(&config);
    assert!(result.valid);
    assert!(result.errors.is_empty());
}

#[test]
fn test_validate_config_missing_url() {
    let mut articles = BTreeMap::new();
    articles.insert(
        "1".to_string(),
        ArticleConfig {
            url: String::new(),
            ..Default::default()
        },
    );
    let config = BatchConfig {
        articles,
        defaults: None,
    };
    let result = validate_config(&config);
    assert!(!result.valid);
    assert!(!result.errors.is_empty());
}

#[test]
fn test_validate_config_invalid_url() {
    let mut articles = BTreeMap::new();
    articles.insert(
        "1".to_string(),
        ArticleConfig {
            url: "not a url".to_string(),
            ..Default::default()
        },
    );
    let config = BatchConfig {
        articles,
        defaults: None,
    };
    let result = validate_config(&config);
    assert!(!result.valid);
}
