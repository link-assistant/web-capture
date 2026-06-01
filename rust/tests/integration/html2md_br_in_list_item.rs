use regex::Regex;
use web_capture::markdown::convert_html_to_markdown;

const HTML: &str = include_str!("../fixtures/list-item-with-br.html");

#[test]
fn preserves_br_as_line_separator_inside_list_items() {
    let md = convert_html_to_markdown(HTML, None).unwrap();
    for tag in ["TAG1", "TAG2", "TAG3"] {
        let re = Regex::new(&format!(r"(?m)^\s*\*{{0,2}}{tag}\*{{0,2}}\s*–")).unwrap();
        assert!(
            re.is_match(&md),
            "expected `{tag} – …` on its own line; got:\n{md}"
        );
    }
    assert!(
        !md.contains("Definition one.**TAG2"),
        "TAG1/TAG2 must not be glued: {md}"
    );
    assert!(
        !md.contains("Definition two.**TAG3"),
        "TAG2/TAG3 must not be glued: {md}"
    );
}
