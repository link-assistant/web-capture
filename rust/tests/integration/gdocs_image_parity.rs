use web_capture::gdocs::extract_base64_images;
use web_capture::markdown::convert_html_to_markdown;

const PNG_B64: &str =
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=";

#[test]
fn img_inside_heading_is_kept_in_markdown() {
    let html = format!(
        r#"<html><body>
<h1><img src="data:image/png;base64,{PNG_B64}" alt=""> Title With Image</h1>
<p>Body <img src="data:image/png;base64,{PNG_B64}" alt=""> paragraph.</p>
</body></html>"#
    );

    let (local_html, images) = extract_base64_images(&html);
    assert_eq!(images.len(), 2, "two images should be extracted to files");

    let md = convert_html_to_markdown(&local_html, None).unwrap();
    let md_refs = md.matches("](images/").count();

    assert_eq!(
        md_refs,
        images.len(),
        "markdown image refs ({md_refs}) must match extracted image files ({}). MD:\n{md}",
        images.len(),
    );
}

#[test]
fn img_inside_all_heading_levels_is_kept() {
    for level in 1..=6 {
        let open = format!("<h{level}>");
        let close = format!("</h{level}>");
        let html = format!(
            r#"<html><body>{open}<img src="data:image/png;base64,{PNG_B64}" alt="icon"> Heading {level}{close}</body></html>"#
        );

        let (local_html, images) = extract_base64_images(&html);
        assert_eq!(images.len(), 1, "h{level}: one image extracted");

        let md = convert_html_to_markdown(&local_html, None).unwrap();
        let refs = md.matches("](images/").count();
        assert_eq!(
            refs, 1,
            "h{level}: image ref missing from markdown. MD:\n{md}"
        );
    }
}

#[test]
fn gdocs_style_heading_with_spans_keeps_img() {
    let html = format!(
        r#"<html><head><style>body{{margin:0}}</style></head><body>
<h1 id="h.abc" class="c12"><span class="c4"><img src="data:image/png;base64,{PNG_B64}" alt="" style="width:32px"></span><span class="c4"> Title</span></h1>
<p class="c5"><span><img src="data:image/png;base64,{PNG_B64}" alt=""></span><span> Body.</span></p>
</body></html>"#
    );

    let (local_html, images) = extract_base64_images(&html);
    assert_eq!(images.len(), 2);

    let md = convert_html_to_markdown(&local_html, None).unwrap();
    let refs = md.matches("](images/").count();
    assert_eq!(
        refs,
        images.len(),
        "GDocs-style heading lost image. MD:\n{md}"
    );
}

#[test]
fn image_count_parity_across_pipeline() {
    let html = format!(
        r#"<html><body>
<h1><img src="data:image/png;base64,{PNG_B64}" alt="h1"> Chapter</h1>
<p>Text <img src="data:image/png;base64,{PNG_B64}" alt="p1"> here.</p>
<h2><img src="data:image/png;base64,{PNG_B64}" alt="h2"> Section</h2>
<p><img src="data:image/png;base64,{PNG_B64}" alt="p2"></p>
<h3>No image heading</h3>
<p>Final <img src="data:image/png;base64,{PNG_B64}" alt="p3"> paragraph.</p>
</body></html>"#
    );

    let (local_html, images) = extract_base64_images(&html);
    let html_img_count = local_html.matches("<img ").count();
    let md = convert_html_to_markdown(&local_html, None).unwrap();
    let md_ref_count = md.matches("](images/").count();

    assert_eq!(
        html_img_count,
        images.len(),
        "HTML img tags ({html_img_count}) != extracted files ({})",
        images.len()
    );
    assert_eq!(
        md_ref_count,
        images.len(),
        "MD refs ({md_ref_count}) != extracted files ({}). MD:\n{md}",
        images.len()
    );
}
