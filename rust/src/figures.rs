//! Figure image extraction and download module (R4).
//!
//! Extracts figure images from web pages and downloads them locally.
//! Supports multi-language figure detection (English/Russian).
//!
//! Based on reference implementation from:
//! <https://github.com/link-foundation/meta-theory/blob/main/scripts/download.mjs>

use regex::Regex;
use scraper::{Html, Selector};
use serde::{Deserialize, Serialize};
use url::Url;

/// A figure extracted from HTML.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Figure {
    pub figure_num: u32,
    pub src: String,
    pub alt: String,
    pub caption: String,
    pub sequential_index: u32,
}

/// Result of downloading a single figure.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FigureDownloadResult {
    pub figure_num: u32,
    pub filename: String,
    #[serde(skip)]
    pub buffer: Option<Vec<u8>>,
    pub caption: String,
    pub original_url: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub error: Option<String>,
}

/// Extract figure elements from HTML content.
///
/// Finds `<figure>` elements containing `<img>` tags and extracts
/// their source URLs, alt text, and captions with multi-language
/// figure number detection.
#[must_use]
pub fn extract_figures(html: &str, base_url: &str) -> Vec<Figure> {
    let document = Html::parse_document(html);
    let mut figures = Vec::new();
    let mut sequential_index: u32 = 0;

    let figure_sel = match Selector::parse("figure") {
        Ok(sel) => sel,
        Err(_) => return figures,
    };
    let img_sel = Selector::parse("img").unwrap();
    let caption_sel = Selector::parse("figcaption").unwrap();

    let figure_num_re = Regex::new(r"(?i)(?:Figure|Рис\.?|Рисунок)\s*(\d+)").unwrap();

    for figure_el in document.select(&figure_sel) {
        let Some(img) = figure_el.select(&img_sel).next() else {
            continue;
        };

        let src = match img.value().attr("src") {
            Some(s) if !s.starts_with("data:") && !s.contains(".svg") => s,
            _ => continue,
        };

        sequential_index += 1;

        let caption_text = figure_el
            .select(&caption_sel)
            .next()
            .map(|el| el.text().collect::<String>().trim().to_string())
            .unwrap_or_default();

        let figure_num = figure_num_re
            .captures(&caption_text)
            .and_then(|cap| cap[1].parse::<u32>().ok())
            .unwrap_or(sequential_index);

        let resolved_src = Url::parse(base_url)
            .ok()
            .and_then(|base| base.join(src).ok())
            .map_or_else(|| src.to_string(), |u| u.to_string());

        let alt = img.value().attr("alt").unwrap_or("").to_string();

        figures.push(Figure {
            figure_num,
            src: resolved_src,
            alt,
            caption: caption_text,
            sequential_index,
        });
    }

    figures
}

/// Download figure images.
///
/// Downloads each figure's image and returns results with the buffer
/// or error information.
pub async fn download_figures(figures: &[Figure]) -> Vec<FigureDownloadResult> {
    let mut results = Vec::new();
    let client = reqwest::Client::new();

    for figure in figures {
        let ext = if figure.src.contains(".jpeg") || figure.src.contains(".jpg") {
            "jpg"
        } else {
            "png"
        };
        let filename = format!("figure-{}.{ext}", figure.figure_num);

        let mut last_error = None;
        let mut buffer = None;

        for attempt in 0..3 {
            match client.get(&figure.src).send().await {
                Ok(resp) if resp.status().is_success() => match resp.bytes().await {
                    Ok(bytes) => {
                        buffer = Some(bytes.to_vec());
                        break;
                    }
                    Err(e) => last_error = Some(e.to_string()),
                },
                Ok(resp) => last_error = Some(format!("HTTP {}", resp.status())),
                Err(e) => last_error = Some(e.to_string()),
            }
            if attempt < 2 {
                tokio::time::sleep(std::time::Duration::from_secs(1)).await;
            }
        }

        let has_buffer = buffer.is_some();
        results.push(FigureDownloadResult {
            figure_num: figure.figure_num,
            filename,
            buffer,
            caption: figure.caption.clone(),
            original_url: figure.src.clone(),
            error: if has_buffer { None } else { last_error },
        });
    }

    results
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_extract_figures_basic() {
        let html = r#"<html><body>
            <figure>
                <img src="https://example.com/img1.png" alt="Test image">
                <figcaption>Figure 1: Test caption</figcaption>
            </figure>
        </body></html>"#;
        let figures = extract_figures(html, "https://example.com");
        assert_eq!(figures.len(), 1);
        assert_eq!(figures[0].figure_num, 1);
        assert_eq!(figures[0].caption, "Figure 1: Test caption");
    }

    #[test]
    fn test_extract_figures_russian_caption() {
        let html = r#"<html><body>
            <figure>
                <img src="/img.png" alt="Test">
                <figcaption>Рис. 3: Описание</figcaption>
            </figure>
        </body></html>"#;
        let figures = extract_figures(html, "https://example.com");
        assert_eq!(figures.len(), 1);
        assert_eq!(figures[0].figure_num, 3);
    }

    #[test]
    fn test_extract_figures_relative_url() {
        let html = r#"<html><body>
            <figure><img src="/images/test.png" alt="Test"></figure>
        </body></html>"#;
        let figures = extract_figures(html, "https://example.com");
        assert_eq!(figures.len(), 1);
        assert!(figures[0].src.starts_with("https://example.com"));
    }

    #[test]
    fn test_extract_figures_skips_svg() {
        let html = r#"<html><body>
            <figure><img src="diagram.svg" alt="SVG"></figure>
        </body></html>"#;
        let figures = extract_figures(html, "https://example.com");
        assert!(figures.is_empty());
    }

    #[test]
    fn test_extract_figures_skips_data_uri() {
        let html = r#"<html><body>
            <figure><img src="data:image/png;base64,abc" alt="Inline"></figure>
        </body></html>"#;
        let figures = extract_figures(html, "https://example.com");
        assert!(figures.is_empty());
    }

    #[test]
    fn test_extract_figures_no_img() {
        let html = r#"<html><body>
            <figure><figcaption>Empty figure</figcaption></figure>
        </body></html>"#;
        let figures = extract_figures(html, "https://example.com");
        assert!(figures.is_empty());
    }

    #[test]
    fn test_extract_figures_sequential_numbering() {
        let html = r#"<html><body>
            <figure><img src="a.png" alt="A"><figcaption>No number</figcaption></figure>
            <figure><img src="b.png" alt="B"><figcaption>Also no number</figcaption></figure>
        </body></html>"#;
        let figures = extract_figures(html, "https://example.com");
        assert_eq!(figures.len(), 2);
        assert_eq!(figures[0].figure_num, 1); // sequential
        assert_eq!(figures[1].figure_num, 2); // sequential
    }
}
