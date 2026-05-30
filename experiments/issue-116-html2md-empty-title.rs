// Probe what html2md emits for <img alt="" src="data:...">.
// Run with: cargo run --example issue-116-html2md-empty-title (after wiring up examples)
// Or copy into src/bin/ to test as a binary.

fn main() {
    let html = r#"<p><img alt="" src="data:image/png;base64,iVBORw0KGgo="></p>"#;
    let md = html2md::parse_html(html);
    println!("MD output: {md:?}");
    println!("Has empty title: {}", md.contains(r#" "")"#));
}
