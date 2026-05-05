// Quick experiment: see how html2md handles ordered lists with start attribute
fn main() {
    let html_basic = r#"<ol><li>First</li><li>Second</li></ol>"#;
    let html_with_start = r#"<ol start="13"><li>Foo</li></ol>"#;
    let html_h4_in_ol = r#"<ol><li><h4>13. Top</h4></li></ol>"#;
    
    println!("--- basic ---");
    println!("{}", html2md::parse_html(html_basic));
    println!("--- start=13 ---");
    println!("{}", html2md::parse_html(html_with_start));
    println!("--- h4 inside ol ---");
    println!("{}", html2md::parse_html(html_h4_in_ol));
}
