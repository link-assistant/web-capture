// Quick experiment to verify html2md drops <img> inside headings
#[test]
fn html2md_drops_img_in_heading() {
    let html_heading = r#"<h1><img src="images/image-01.png" alt="icon"> Title</h1>"#;
    let md = html2md::parse_html(html_heading);
    println!("Heading img MD: {:?}", md);
    // This will show that the image is dropped

    let html_para = r#"<p>Text <img src="images/image-01.png" alt="icon"> more</p>"#;
    let md2 = html2md::parse_html(html_para);
    println!("Paragraph img MD: {:?}", md2);
    // This should preserve the image
}
