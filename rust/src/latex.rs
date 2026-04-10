//! LaTeX formula extraction module (R1).
//!
//! Extracts LaTeX formulas from HTML content, handling multiple sources:
//! - Habr: `img.formula` elements with `source` attribute
//! - KaTeX: `.katex` elements with `annotation[encoding="application/x-tex"]`
//! - MathJax: `mjx-container` elements with `data-tex`/`data-latex` attributes
//!
//! Based on reference implementation from:
//! <https://github.com/link-foundation/meta-theory/blob/main/scripts/download-article.mjs>

use scraper::{ElementRef, Selector};

/// Check if an element is a formula image (Habr-specific).
///
/// Habr renders formulas as SVG/PNG images with class `formula`.
#[must_use]
pub fn is_formula_image(element: &ElementRef) -> bool {
    let value = element.value();
    if value.name() != "img" {
        return false;
    }
    let classes = value.attr("class").unwrap_or("");
    classes.contains("formula") || value.attr("source").is_some()
}

/// Check if an element is a math element (KaTeX, MathJax, or generic math class).
#[must_use]
pub fn is_math_element(element: &ElementRef) -> bool {
    let value = element.value();
    let tag = value.name();
    let classes = value.attr("class").unwrap_or("");
    classes.contains("katex")
        || classes.contains("math")
        || classes.contains("MathJax")
        || tag == "mjx-container"
}

/// Extract LaTeX source from a formula image element (Habr-specific).
///
/// Habr renders formulas as SVG/PNG images with class `formula`.
/// The original LaTeX source is in the `source` attribute.
#[must_use]
pub fn extract_habr_formula(element: &ElementRef) -> Option<String> {
    let value = element.value();
    if let Some(source) = value.attr("source") {
        let trimmed = source.trim();
        if !trimmed.is_empty() {
            return Some(trimmed.to_string());
        }
    }
    if let Some(alt) = value.attr("alt") {
        let trimmed = alt.trim();
        if !trimmed.is_empty() {
            return Some(trimmed.to_string());
        }
    }
    None
}

/// Extract LaTeX from KaTeX elements.
///
/// KaTeX stores the TeX source in `annotation[encoding="application/x-tex"]`.
#[must_use]
pub fn extract_katex_formula(element: &ElementRef) -> Option<String> {
    // Look for annotation element
    if let Ok(sel) = Selector::parse(r#"annotation[encoding="application/x-tex"]"#) {
        if let Some(annotation) = element.select(&sel).next() {
            let text: String = annotation.text().collect();
            let trimmed = text.trim();
            if !trimmed.is_empty() {
                return Some(trimmed.to_string());
            }
        }
    }
    // Fallback to data-tex or data-latex attributes
    let value = element.value();
    if let Some(tex) = value.attr("data-tex").or_else(|| value.attr("data-latex")) {
        let trimmed = tex.trim();
        if !trimmed.is_empty() {
            return Some(trimmed.to_string());
        }
    }
    None
}

/// Extract LaTeX from MathJax elements.
///
/// MathJax stores TeX in `data-tex` attribute or annotation elements.
#[must_use]
pub fn extract_mathjax_formula(element: &ElementRef) -> Option<String> {
    let value = element.value();
    // First try data-tex/data-latex attributes
    if let Some(tex) = value.attr("data-tex").or_else(|| value.attr("data-latex")) {
        let trimmed = tex.trim();
        if !trimmed.is_empty() {
            return Some(trimmed.to_string());
        }
    }
    // Fallback to annotation element
    if let Ok(sel) = Selector::parse(r#"annotation[encoding="application/x-tex"]"#) {
        if let Some(annotation) = element.select(&sel).next() {
            let text: String = annotation.text().collect();
            let trimmed = text.trim();
            if !trimmed.is_empty() {
                return Some(trimmed.to_string());
            }
        }
    }
    None
}

/// Extract formula from any supported element type.
#[must_use]
pub fn extract_formula(element: &ElementRef) -> Option<String> {
    if is_formula_image(element) {
        return extract_habr_formula(element);
    }
    let tag = element.value().name();
    if tag == "mjx-container" {
        return extract_mathjax_formula(element);
    }
    if is_math_element(element) {
        return extract_katex_formula(element);
    }
    None
}

#[cfg(test)]
mod tests {
    use super::*;
    use scraper::Html;

    fn select_first<'a>(html: &'a Html, selector_str: &str) -> Option<ElementRef<'a>> {
        Selector::parse(selector_str)
            .ok()
            .and_then(|sel| html.select(&sel).next())
    }

    #[test]
    fn test_is_formula_image_with_class() {
        let html = Html::parse_fragment(r#"<img class="formula" source="x^2">"#);
        let el = select_first(&html, "img").unwrap();
        assert!(is_formula_image(&el));
    }

    #[test]
    fn test_is_formula_image_regular_img() {
        let html = Html::parse_fragment(r#"<img src="photo.png">"#);
        let el = select_first(&html, "img").unwrap();
        assert!(!is_formula_image(&el));
    }

    #[test]
    fn test_is_math_element_katex() {
        let html = Html::parse_fragment(r#"<span class="katex">...</span>"#);
        let el = select_first(&html, "span").unwrap();
        assert!(is_math_element(&el));
    }

    #[test]
    fn test_is_math_element_mathjax() {
        let html = Html::parse_fragment(r#"<span class="MathJax">...</span>"#);
        let el = select_first(&html, "span").unwrap();
        assert!(is_math_element(&el));
    }

    #[test]
    fn test_extract_habr_formula_source() {
        let html = Html::parse_fragment(r#"<img class="formula" source="E = mc^2">"#);
        let el = select_first(&html, "img").unwrap();
        assert_eq!(extract_habr_formula(&el), Some("E = mc^2".to_string()));
    }

    #[test]
    fn test_extract_habr_formula_alt() {
        let html = Html::parse_fragment(r#"<img class="formula" alt="x + y">"#);
        let el = select_first(&html, "img").unwrap();
        assert_eq!(extract_habr_formula(&el), Some("x + y".to_string()));
    }

    #[test]
    fn test_extract_katex_formula_annotation() {
        let html = Html::parse_fragment(
            r#"<span class="katex"><annotation encoding="application/x-tex">a^2 + b^2</annotation></span>"#,
        );
        let el = select_first(&html, ".katex").unwrap();
        assert_eq!(extract_katex_formula(&el), Some("a^2 + b^2".to_string()));
    }

    #[test]
    fn test_extract_katex_formula_data_tex() {
        let html = Html::parse_fragment(r#"<span class="katex" data-tex="\pi r^2"></span>"#);
        let el = select_first(&html, ".katex").unwrap();
        assert_eq!(extract_katex_formula(&el), Some(r"\pi r^2".to_string()));
    }

    #[test]
    fn test_extract_mathjax_formula_data_tex() {
        let html =
            Html::parse_fragment(r#"<mjx-container data-tex="\sum_{i=0}^n"></mjx-container>"#);
        let el = select_first(&html, "mjx-container").unwrap();
        assert_eq!(
            extract_mathjax_formula(&el),
            Some(r"\sum_{i=0}^n".to_string())
        );
    }

    #[test]
    fn test_extract_formula_dispatches_correctly() {
        let html = Html::parse_fragment(r#"<img class="formula" source="a+b">"#);
        let el = select_first(&html, "img").unwrap();
        assert_eq!(extract_formula(&el), Some("a+b".to_string()));
    }
}
