// Experiment: Verify that html2md drops <img> inside headings
// Run with: cargo test --test experiment_heading_img -- --nocapture
// Or as a standalone script via the web-capture crate tests

use web_capture::gdocs::extract_base64_images;
use web_capture::markdown::convert_html_to_markdown;

const PNG_B64: &str = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=";

fn main() {
    let html = format!(
        r#"<html><body>
<h1><img src="data:image/png;base64,{b}" alt=""> Title With Image</h1>
<p>Body <img src="data:image/png;base64,{b}" alt=""> paragraph.</p>
</body></html>"#,
        b = PNG_B64
    );

    let (local_html, images) = extract_base64_images(&html);
    println!("Extracted images: {}", images.len());
    println!("Local HTML:\n{}", local_html);

    let md = convert_html_to_markdown(&local_html, None).unwrap();
    println!("\nMarkdown output:\n{}", md);

    let md_refs = md.matches("](images/").count();
    println!("\nImage refs in markdown: {}", md_refs);
    println!("Images extracted: {}", images.len());

    if md_refs != images.len() {
        println!("BUG CONFIRMED: markdown refs ({}) != extracted images ({})", md_refs, images.len());
    } else {
        println!("OK: counts match");
    }
}
