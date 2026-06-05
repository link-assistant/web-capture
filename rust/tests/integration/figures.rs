use web_capture::figures::extract_figures;

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
    let html = r"<html><body>
        <figure><figcaption>Empty figure</figcaption></figure>
    </body></html>";
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
