use web_capture::markdown::convert_html_to_markdown;

const HTML: &str = include_str!("../fixtures/ol-continuous-numbering.html");

#[test]
fn numbers_consecutive_top_level_ordered_lists_continuously() {
    let md = convert_html_to_markdown(HTML, None).unwrap();
    assert!(md.contains("1. **First**"), "got:\n{md}");
    assert!(md.contains("2. **Second**"), "got:\n{md}");
    assert!(md.contains("3. **Third**"), "got:\n{md}");
    assert!(md.contains("4. **Fourth**"), "got:\n{md}");
    assert!(
        md.contains("13. **Top-level"),
        "must honour <ol start=13>; got:\n{md}"
    );
}
