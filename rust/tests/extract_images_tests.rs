use std::fs;
use std::path::PathBuf;
use web_capture::extract_images::{extract_and_save_images, has_base64_images};

// 1x1 red PNG pixel as base64
const TINY_PNG: &str = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8/5+hHgAHggJ/PchI7wAAAABJRU5ErkJggg==";

fn create_temp_dir() -> PathBuf {
    use std::sync::atomic::{AtomicU64, Ordering};
    static COUNTER: AtomicU64 = AtomicU64::new(0);
    let id = COUNTER.fetch_add(1, Ordering::Relaxed);
    let dir = std::env::temp_dir().join(format!("extract-images-test-{}-{id}", std::process::id()));
    let _ = fs::remove_dir_all(&dir);
    fs::create_dir_all(&dir).unwrap();
    dir
}

fn cleanup(dir: &PathBuf) {
    let _ = fs::remove_dir_all(dir);
}

#[test]
fn test_extract_single_png() {
    let dir = create_temp_dir();
    let md = format!("# Hello\n\n![test](data:image/png;base64,{TINY_PNG})\n\nEnd.");

    let result = extract_and_save_images(&md, &dir, "images").unwrap();

    assert_eq!(result.extracted, 1);
    assert!(result.markdown.contains("![test](images/image-"));
    assert!(result.markdown.contains(".png)"));
    assert!(!result.markdown.contains("data:image"));

    // Find the extracted image file
    let images_dir = dir.join("images");
    assert!(images_dir.exists());
    let entries: Vec<_> = fs::read_dir(&images_dir).unwrap().collect();
    assert_eq!(entries.len(), 1);
    let img_path = entries[0].as_ref().unwrap().path();
    let filename = img_path.file_name().unwrap().to_str().unwrap();
    assert!(filename.starts_with("image-"));
    assert!(filename.ends_with(".png"));

    let buf = fs::read(&img_path).unwrap();
    assert!(!buf.is_empty());
    // PNG magic bytes
    assert_eq!(buf[0], 0x89);
    assert_eq!(buf[1], b'P');

    cleanup(&dir);
}

#[test]
fn test_extract_duplicate_images_same_hash() {
    let dir = create_temp_dir();
    let md =
        format!("![a](data:image/png;base64,{TINY_PNG})\n![b](data:image/png;base64,{TINY_PNG})");

    let result = extract_and_save_images(&md, &dir, "images").unwrap();

    assert_eq!(result.extracted, 2);
    // Both should use the same hash-based filename
    let re = regex::Regex::new(r"image-([0-9a-f]{8,})\.png").unwrap();
    let hashes: Vec<_> = re
        .captures_iter(&result.markdown)
        .map(|c| c[1].to_string())
        .collect();
    assert_eq!(hashes.len(), 2);
    assert_eq!(hashes[0], hashes[1]);

    cleanup(&dir);
}

#[test]
fn test_custom_images_dir() {
    let dir = create_temp_dir();
    let md = format!("![img](data:image/png;base64,{TINY_PNG})");

    let result = extract_and_save_images(&md, &dir, "my-images").unwrap();

    assert_eq!(result.extracted, 1);
    assert!(result.markdown.contains("my-images/image-"));
    assert!(dir.join("my-images").exists());
    let entries: Vec<_> = fs::read_dir(dir.join("my-images")).unwrap().collect();
    assert_eq!(entries.len(), 1);

    cleanup(&dir);
}

#[test]
fn test_no_base64_images() {
    let dir = create_temp_dir();
    let md = "# No images\n\nJust text.";

    let result = extract_and_save_images(md, &dir, "images").unwrap();

    assert_eq!(result.extracted, 0);
    assert_eq!(result.markdown, md);
    assert!(!dir.join("images").exists());

    cleanup(&dir);
}

#[test]
fn test_preserves_remote_urls() {
    let dir = create_temp_dir();
    let md = "![remote](https://example.com/img.png)\n![local](images/existing.png)";

    let result = extract_and_save_images(md, &dir, "images").unwrap();

    assert_eq!(result.extracted, 0);
    assert_eq!(result.markdown, md);

    cleanup(&dir);
}

#[test]
fn test_preserves_alt_text() {
    let dir = create_temp_dir();
    let md = format!("![A descriptive alt text](data:image/png;base64,{TINY_PNG})");

    let result = extract_and_save_images(&md, &dir, "images").unwrap();

    assert!(result
        .markdown
        .starts_with("![A descriptive alt text](images/image-"));
    assert!(result.markdown.ends_with(".png)"));

    cleanup(&dir);
}

#[test]
fn test_svg_data_uri() {
    let dir = create_temp_dir();
    let svg = r#"<svg xmlns="http://www.w3.org/2000/svg" width="1" height="1"><rect fill="red" width="1" height="1"/></svg>"#;
    let svg_b64 =
        base64::Engine::encode(&base64::engine::general_purpose::STANDARD, svg.as_bytes());
    let md = format!("![icon](data:image/svg+xml;base64,{svg_b64})");

    let result = extract_and_save_images(&md, &dir, "images").unwrap();

    assert_eq!(result.extracted, 1);
    assert!(result.markdown.contains(".svg)"));

    let images_dir = dir.join("images");
    let entries: Vec<_> = fs::read_dir(&images_dir).unwrap().collect();
    assert_eq!(entries.len(), 1);
    let content = fs::read_to_string(entries[0].as_ref().unwrap().path()).unwrap();
    assert!(content.contains("<svg"));

    cleanup(&dir);
}

#[test]
fn test_has_base64_images_true() {
    let md = format!("![x](data:image/png;base64,{TINY_PNG})");
    assert!(has_base64_images(&md));
}

#[test]
fn test_has_base64_images_false() {
    assert!(!has_base64_images("![x](https://example.com/img.png)"));
    assert!(!has_base64_images(""));
}
