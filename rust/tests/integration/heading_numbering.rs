use web_capture::markdown::convert_html_to_markdown;

const HTML: &str = include_str!("../fixtures/heading-numbering.html");

#[test]
fn preserves_hierarchical_heading_numbering() {
    let md = convert_html_to_markdown(HTML, None).unwrap();

    // Parent "13."
    assert!(
        md.lines().any(
            |l| l.trim_start_matches('#').trim_start().starts_with("13.")
                || l.trim_start().starts_with("13.")
        ),
        "expected parent number 13 to be preserved as heading or numbered item; got:\n{md}"
    );

    for sub in ["13.1", "13.2", "13.3"] {
        let found = md.lines().any(|l| {
            let t = l.trim().trim_start_matches(['#', '*', '>', ' ']);
            t.starts_with(sub)
        });
        assert!(found, "expected {sub} as a heading-like line; got:\n{md}");
    }

    // No phantom blockquotes around the subsections.
    let bad = md.lines().any(|l| {
        let t = l.trim_start();
        t.starts_with("> ") && (t.contains("13.1") || t.contains("13.2") || t.contains("13.3"))
    });
    assert!(
        !bad,
        "subsection lines must not be inside a blockquote; got:\n{md}"
    );
}
