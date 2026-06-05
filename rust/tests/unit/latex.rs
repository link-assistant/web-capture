use scraper::{Html, Selector};
use web_capture::latex::{
    extract_formula, extract_habr_formula, extract_katex_formula, extract_mathjax_formula,
    is_formula_image, is_math_element,
};

fn select_first<'a>(html: &'a Html, selector_str: &str) -> Option<scraper::ElementRef<'a>> {
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
    let html = Html::parse_fragment(r#"<mjx-container data-tex="\sum_{i=0}^n"></mjx-container>"#);
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
