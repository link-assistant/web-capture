use web_capture::markdown::convert_html_to_markdown;

const HTML: &str = include_str!("../fixtures/paragraph-vs-line-break.html");

#[test]
fn double_br_becomes_paragraph_break_not_two_hard_breaks() {
    let md = convert_html_to_markdown(HTML, None).unwrap();
    let lines: Vec<&str> = md.lines().collect();
    let idx_a = lines
        .iter()
        .position(|l| l.contains("Caption A:"))
        .unwrap_or_else(|| panic!("Caption A: missing in output:\n{md}"));
    let idx_b = lines
        .iter()
        .position(|l| l.contains("Caption B:"))
        .unwrap_or_else(|| panic!("Caption B: missing in output:\n{md}"));
    let between = &lines[idx_a + 1..idx_b];
    assert!(
        between.iter().any(|l| l.is_empty()),
        "expected at least one truly empty line between Caption A and Caption B; got:\n{md}"
    );
}

#[test]
fn no_blank_looking_line_carries_trailing_whitespace() {
    let md = convert_html_to_markdown(HTML, None).unwrap();
    let bad: Vec<&str> = md
        .lines()
        .filter(|l| !l.is_empty() && l.trim().is_empty())
        .collect();
    assert!(
        bad.is_empty(),
        "lines that look blank must actually be blank; offenders: {bad:?}"
    );
}
