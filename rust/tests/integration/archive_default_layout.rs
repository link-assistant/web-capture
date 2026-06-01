//! Pin the default `--format archive` layout contract (issue #113):
//! the zip contains exactly `document.md` + `document.html` + `images/`.

use std::io::Read;
use zip::ZipArchive;

const FIXTURE_HTML: &str = r#"<!doctype html>
<html><head><title>T</title></head><body>
<h1>Hi</h1>
<p>Para 1.</p>
<p><img alt="" src="data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8/5+hHgAHggJ/PchI7wAAAABJRU5ErkJggg=="></p>
<p>Para 2.</p>
</body></html>"#;

#[test]
fn archive_default_contains_md_html_and_images_folder() {
    // Build the archive via the public API used by `--format archive`.
    let zip_bytes =
        web_capture::archive::build_zip_from_html(FIXTURE_HTML, "https://example.invalid/")
            .unwrap();
    let mut zip = ZipArchive::new(std::io::Cursor::new(zip_bytes)).unwrap();
    let names: Vec<String> = (0..zip.len())
        .map(|i| zip.by_index(i).unwrap().name().to_string())
        .collect();
    assert!(
        names.contains(&"document.md".to_string()),
        "must contain document.md, got: {names:?}"
    );
    assert!(
        names.contains(&"document.html".to_string()),
        "must contain document.html for reference, got: {names:?}"
    );
    assert!(
        names.iter().any(|n| n.starts_with("images/")),
        "must contain images/ folder, got: {names:?}"
    );

    // The markdown must reference the local image, not the original base64.
    let mut md = String::new();
    zip.by_name("document.md")
        .unwrap()
        .read_to_string(&mut md)
        .unwrap();
    assert!(
        md.contains("images/"),
        "document.md must reference relative images/ path, got:\n{md}"
    );
    assert!(
        !md.contains("data:image"),
        "document.md must NOT contain inline base64, got:\n{md}"
    );

    // Source HTML present and non-empty, so reviewers can verify the conversion.
    let mut html = String::new();
    zip.by_name("document.html")
        .unwrap()
        .read_to_string(&mut html)
        .unwrap();
    assert!(
        html.contains("<h1>"),
        "document.html should be the source for reference"
    );
}
