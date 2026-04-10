//! Article metadata extraction module (R1).
//!
//! Extracts metadata from web pages including:
//! - Author information (name, URL, karma)
//! - Publication date and modification date
//! - Reading time and difficulty
//! - Views, votes, bookmarks, comments
//! - Hubs and tags (with URLs)
//! - Translation information
//! - LD+JSON structured data
//!
//! Based on reference implementation from:
//! <https://github.com/link-foundation/meta-theory/blob/main/scripts/download-article.mjs>

use scraper::{Html, Selector};
use serde::{Deserialize, Serialize};

/// Link with name and URL.
#[derive(Debug, Clone, Default, Serialize, Deserialize)]
pub struct NamedLink {
    pub name: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub url: Option<String>,
}

/// Extracted article metadata.
#[derive(Debug, Clone, Default, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ArticleMetadata {
    #[serde(skip_serializing_if = "Option::is_none")]
    pub author: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub author_url: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub author_full_name: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub author_karma: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub publish_date: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub publish_date_text: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub date_modified: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub reading_time: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub difficulty: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub views: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub votes: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub comments: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub bookmarks: Option<String>,
    #[serde(skip_serializing_if = "Vec::is_empty", default)]
    pub hubs: Vec<String>,
    #[serde(skip_serializing_if = "Vec::is_empty", default)]
    pub hub_urls: Vec<NamedLink>,
    #[serde(skip_serializing_if = "Vec::is_empty", default)]
    pub tags: Vec<String>,
    #[serde(skip_serializing_if = "Vec::is_empty", default)]
    pub tag_links: Vec<NamedLink>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub is_translation: Option<bool>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub translation_label: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub original_article_url: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub original_authors: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub original_author_text: Option<String>,
}

/// Helper to select first element and get its text content.
fn select_text(document: &Html, selector_str: &str) -> Option<String> {
    let sel = Selector::parse(selector_str).ok()?;
    let el = document.select(&sel).next()?;
    let text: String = el.text().collect::<String>().trim().to_string();
    if text.is_empty() { None } else { Some(text) }
}

/// Helper to select first element and get an attribute value.
fn select_attr(document: &Html, selector_str: &str, attr: &str) -> Option<String> {
    let sel = Selector::parse(selector_str).ok()?;
    let el = document.select(&sel).next()?;
    el.value().attr(attr).map(String::from)
}

/// Extract article metadata from HTML.
///
/// Works without a browser by parsing the HTML directly with scraper.
#[must_use]
pub fn extract_metadata(html: &str) -> ArticleMetadata {
    let document = Html::parse_document(html);
    let mut meta = ArticleMetadata::default();

    // Author
    if let Some(author_text) = select_text(&document, ".tm-user-info__username") {
        meta.author = Some(author_text);
    }
    if let Some(author_url) = select_attr(&document, ".tm-user-info__username", "href") {
        meta.author_url = Some(author_url);
    }

    // Publication date
    if let Some(datetime) = select_attr(&document, "time[datetime]", "datetime") {
        meta.publish_date = Some(datetime);
    }
    if let Some(date_text) = select_text(&document, "time[datetime]") {
        meta.publish_date_text = Some(date_text);
    }

    // Reading time
    meta.reading_time = select_text(&document, ".tm-article-reading-time__label");

    // Difficulty
    meta.difficulty = select_text(&document, ".tm-article-complexity__label");

    // Views
    if let Ok(sel) = Selector::parse(".tm-icon-counter__value") {
        if let Some(el) = document.select(&sel).next() {
            if let Some(title) = el.value().attr("title") {
                meta.views = Some(title.to_string());
            } else {
                let text: String = el.text().collect::<String>().trim().to_string();
                if !text.is_empty() {
                    meta.views = Some(text);
                }
            }
        }
    }

    // Hubs
    if let Ok(sel) = Selector::parse(".tm-publication-hub__link") {
        let mut hubs = Vec::new();
        let mut hub_urls = Vec::new();
        for el in document.select(&sel) {
            // Try to get name from first span child
            let name = if let Ok(span_sel) = Selector::parse("span:first-child") {
                el.select(&span_sel)
                    .next()
                    .map(|span| span.text().collect::<String>().trim().to_string())
                    .filter(|s| !s.is_empty())
            } else {
                None
            };
            let name = name.unwrap_or_else(|| {
                el.text()
                    .collect::<String>()
                    .trim()
                    .trim_end_matches('*')
                    .trim()
                    .to_string()
            });
            let url = el.value().attr("href").map(String::from);
            hubs.push(name.clone());
            hub_urls.push(NamedLink { name, url });
        }
        if !hubs.is_empty() {
            meta.hubs = hubs;
            meta.hub_urls = hub_urls;
        }
    }

    // Tags from meta keywords
    if let Some(content) = select_attr(&document, r#"meta[name="keywords"]"#, "content") {
        let tags: Vec<String> = content
            .split(',')
            .map(|t| t.trim().to_string())
            .filter(|t| !t.is_empty())
            .collect();
        if !tags.is_empty() {
            meta.tags = tags;
        }
    }

    // Tags with URLs
    if let Ok(sel) = Selector::parse(".tm-article-body__tags-item a, .tm-tags-list__link") {
        let mut tag_links = Vec::new();
        for el in document.select(&sel) {
            let name = el.text().collect::<String>().trim().to_string();
            let url = el.value().attr("href").map(String::from);
            if !name.is_empty() {
                tag_links.push(NamedLink { name, url });
            }
        }
        if !tag_links.is_empty() {
            meta.tag_links = tag_links;
        }
    }

    // Translation badge
    if let Some(text) = select_text(&document, ".tm-publication-label_variant-translation") {
        meta.is_translation = Some(true);
        meta.translation_label = Some(text);
    }

    // Original article link
    if let Ok(sel) = Selector::parse(".tm-article-presenter__origin-link") {
        if let Some(el) = document.select(&sel).next() {
            meta.original_article_url = el.value().attr("href").map(String::from);
            if let Ok(span_sel) = Selector::parse("span") {
                if let Some(span) = el.select(&span_sel).next() {
                    let text = span.text().collect::<String>().trim().to_string();
                    if !text.is_empty() {
                        meta.original_authors = Some(text);
                    }
                }
            }
            let full_text = el.text().collect::<String>().trim().to_string();
            if !full_text.is_empty() {
                meta.original_author_text = Some(full_text);
            }
        }
    }

    // LD+JSON structured data
    if let Ok(sel) = Selector::parse(r#"script[type="application/ld+json"]"#) {
        if let Some(el) = document.select(&sel).next() {
            let json_text: String = el.text().collect();
            if let Ok(value) = serde_json::from_str::<serde_json::Value>(&json_text) {
                if let Some(modified) = value.get("dateModified").and_then(|v| v.as_str()) {
                    meta.date_modified = Some(modified.to_string());
                }
                if let Some(author_name) = value
                    .get("author")
                    .and_then(|a| a.get("name"))
                    .and_then(|n| n.as_str())
                {
                    meta.author_full_name = Some(author_name.to_string());
                }
            }
        }
    }

    // Votes
    meta.votes = select_text(&document, ".tm-votes-meter__value");

    // Comments count
    meta.comments = select_text(&document, ".tm-article-comments-counter-link__value");

    // Bookmarks count
    meta.bookmarks = select_text(&document, ".bookmarks-button__counter");

    // Author karma
    meta.author_karma = select_text(&document, ".tm-karma__votes");

    meta
}

/// Format metadata as a markdown header block.
///
/// Placed after the title in the output markdown.
#[must_use]
pub fn format_metadata_block(metadata: &ArticleMetadata) -> Vec<String> {
    let mut lines = Vec::new();

    // Author line
    if let Some(ref author) = metadata.author {
        let author_name = metadata
            .author_full_name
            .as_ref()
            .map_or_else(|| author.clone(), |full| format!("{full} ({author})"));
        let author_link = metadata
            .author_url
            .as_ref()
            .map_or_else(|| author_name.clone(), |url| format!("[{author_name}]({url})"));
        lines.push(format!("**Author:** {author_link}"));
    }

    // Translation
    if metadata.is_translation == Some(true) {
        let label = metadata
            .translation_label
            .as_deref()
            .unwrap_or("Translation");
        lines.push(format!("**Type:** {label}"));
    }

    // Original article
    if let Some(ref authors) = metadata.original_authors {
        if let Some(ref url) = metadata.original_article_url {
            lines.push(format!("**Original article:** [{authors}]({url})"));
        } else {
            lines.push(format!("**Original authors:** {authors}"));
        }
    }

    // Publication date
    if let Some(ref date) = metadata.publish_date {
        let mut date_line = format!("**Published:** {date}");
        if let Some(ref modified) = metadata.date_modified {
            if modified != date {
                date_line.push_str(&format!(" (updated {modified})"));
            }
        }
        lines.push(date_line);
    }

    // Info items
    let mut info_items = Vec::new();
    if let Some(ref rt) = metadata.reading_time {
        info_items.push(format!("Reading time: {rt}"));
    }
    if let Some(ref diff) = metadata.difficulty {
        info_items.push(format!("Difficulty: {diff}"));
    }
    if let Some(ref views) = metadata.views {
        info_items.push(format!("Views: {views}"));
    }
    if !info_items.is_empty() {
        lines.push(format!("**{}**", info_items.join(" | ")));
    }

    // Hubs
    if !metadata.hubs.is_empty() {
        lines.push(format!("**Hubs:** {}", metadata.hubs.join(", ")));
    }

    // Tags
    if !metadata.tags.is_empty() {
        lines.push(format!("**Tags:** {}", metadata.tags.join(", ")));
    }

    lines
}

/// Format footer metadata block.
///
/// Placed at the end of the article, matching Habr article footer.
#[must_use]
pub fn format_footer_block(metadata: &ArticleMetadata) -> Vec<String> {
    let mut lines = Vec::new();
    lines.push("---".to_string());
    lines.push(String::new());

    // Tags with links
    if !metadata.tag_links.is_empty() {
        let tag_strings: Vec<String> = metadata
            .tag_links
            .iter()
            .map(|t| {
                t.url
                    .as_ref()
                    .map_or_else(|| t.name.clone(), |url| format!("[{}]({})", t.name, url))
            })
            .collect();
        lines.push(format!("**Tags:** {}", tag_strings.join(", ")));
        lines.push(String::new());
    } else if !metadata.tags.is_empty() {
        lines.push(format!("**Tags:** {}", metadata.tags.join(", ")));
        lines.push(String::new());
    }

    // Hubs with links
    if !metadata.hub_urls.is_empty() {
        let hub_strings: Vec<String> = metadata
            .hub_urls
            .iter()
            .map(|h| {
                h.url
                    .as_ref()
                    .map_or_else(|| h.name.clone(), |url| format!("[{}]({})", h.name, url))
            })
            .collect();
        lines.push(format!("**Hubs:** {}", hub_strings.join(", ")));
        lines.push(String::new());
    } else if !metadata.hubs.is_empty() {
        lines.push(format!("**Hubs:** {}", metadata.hubs.join(", ")));
        lines.push(String::new());
    }

    // Stats
    let mut stats = Vec::new();
    if let Some(ref votes) = metadata.votes {
        stats.push(format!("Votes: {votes}"));
    }
    if let Some(ref views) = metadata.views {
        stats.push(format!("Views: {views}"));
    }
    if let Some(ref bookmarks) = metadata.bookmarks {
        stats.push(format!("Bookmarks: {bookmarks}"));
    }
    if let Some(ref comments) = metadata.comments {
        stats.push(format!("Comments: {comments}"));
    }
    if !stats.is_empty() {
        lines.push(format!("**{}**", stats.join(" | ")));
        lines.push(String::new());
    }

    // Author info
    if let Some(ref author) = metadata.author {
        let author_name = metadata
            .author_full_name
            .as_ref()
            .map_or_else(|| author.clone(), |full| format!("{full} ({author})"));
        let author_link = metadata
            .author_url
            .as_ref()
            .map_or_else(|| author_name.clone(), |url| format!("[{author_name}]({url})"));
        let mut author_line = format!("**Author:** {author_link}");
        if let Some(ref karma) = metadata.author_karma {
            author_line.push_str(&format!(" | Karma: {karma}"));
        }
        lines.push(author_line);
        lines.push(String::new());
    }

    lines
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_extract_metadata_author() {
        let html = r#"<html><body>
            <a class="tm-user-info__username" href="/users/testuser">TestUser</a>
        </body></html>"#;
        let meta = extract_metadata(html);
        assert_eq!(meta.author.as_deref(), Some("TestUser"));
        assert_eq!(meta.author_url.as_deref(), Some("/users/testuser"));
    }

    #[test]
    fn test_extract_metadata_date() {
        let html = r#"<html><body>
            <time datetime="2024-01-15T10:00:00Z">January 15, 2024</time>
        </body></html>"#;
        let meta = extract_metadata(html);
        assert_eq!(meta.publish_date.as_deref(), Some("2024-01-15T10:00:00Z"));
    }

    #[test]
    fn test_extract_metadata_tags() {
        let html = r#"<html><head>
            <meta name="keywords" content="rust, web, capture">
        </head><body></body></html>"#;
        let meta = extract_metadata(html);
        assert_eq!(meta.tags, vec!["rust", "web", "capture"]);
    }

    #[test]
    fn test_extract_metadata_ld_json() {
        let html = r#"<html><head>
            <script type="application/ld+json">{"dateModified":"2024-02-01","author":{"name":"John Doe"}}</script>
        </head><body></body></html>"#;
        let meta = extract_metadata(html);
        assert_eq!(meta.date_modified.as_deref(), Some("2024-02-01"));
        assert_eq!(meta.author_full_name.as_deref(), Some("John Doe"));
    }

    #[test]
    fn test_format_metadata_block_author() {
        let meta = ArticleMetadata {
            author: Some("user123".to_string()),
            author_url: Some("/users/user123".to_string()),
            ..Default::default()
        };
        let lines = format_metadata_block(&meta);
        assert!(!lines.is_empty());
        assert!(lines[0].contains("[user123](/users/user123)"));
    }

    #[test]
    fn test_format_footer_block_tags() {
        let meta = ArticleMetadata {
            tags: vec!["rust".to_string(), "web".to_string()],
            ..Default::default()
        };
        let lines = format_footer_block(&meta);
        assert!(lines.iter().any(|l| l.contains("rust") && l.contains("web")));
    }

    #[test]
    fn test_extract_metadata_empty_html() {
        let meta = extract_metadata("<html><body></body></html>");
        assert!(meta.author.is_none());
        assert!(meta.tags.is_empty());
    }
}
