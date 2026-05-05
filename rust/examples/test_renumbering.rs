fn main() {
    let html = r##"<!doctype html>
<html><body>
<ol>
  <li><h4><strong>13. Top-level numbered heading in source</strong></h4></li>
</ol>

<h5><strong>13.1 First subsection heading</strong></h5>
<p>Where it activates: ...</p>

<h5><strong>13.2 Second subsection heading</strong></h5>
<p>Where it activates: ...</p>

<h5><strong>13.3 Third subsection heading</strong></h5>
<p>Where it activates: ...</p>
</body></html>"##;
    println!("{}", html2md::parse_html(html));

    println!("--- multiple OL ---");
    let html2 = r#"<ol><li>A</li><li>B</li></ol><p>x</p><ol><li>C</li></ol>"#;
    println!("{}", html2md::parse_html(html2));

    println!("--- start=13 (single li) ---");
    let html3 = r#"<ol start="13"><li>Foo</li></ol>"#;
    println!("{}", html2md::parse_html(html3));
}
