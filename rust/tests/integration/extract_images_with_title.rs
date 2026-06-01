use std::fs;
use std::path::PathBuf;
use web_capture::extract_images::{extract_and_save_images, extract_base64_to_buffers};

// 1x1 red PNG pixel as base64
const TINY_PNG: &str = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8/5+hHgAHggJ/PchI7wAAAABJRU5ErkJggg==";

fn create_temp_dir() -> PathBuf {
    use std::sync::atomic::{AtomicU64, Ordering};
    static COUNTER: AtomicU64 = AtomicU64::new(0);
    let id = COUNTER.fetch_add(1, Ordering::Relaxed);
    let dir = std::env::temp_dir().join(format!(
        "extract-images-title-test-{}-{id}",
        std::process::id()
    ));
    let _ = fs::remove_dir_all(&dir);
    fs::create_dir_all(&dir).unwrap();
    dir
}

fn cleanup(dir: &PathBuf) {
    let _ = fs::remove_dir_all(dir);
}

fn md_with_empty_title() -> String {
    // What the html2md pipeline currently emits for `<img alt="" title="" src="...">`.
    format!("Hello.\n\n![](data:image/png;base64,{TINY_PNG} \"\")\n\nWorld.\n")
}

fn md_with_nonempty_title() -> String {
    format!("Hello.\n\n![alt](data:image/png;base64,{TINY_PNG} \"caption\")\n\nWorld.\n")
}

#[test]
fn extract_and_save_images_handles_image_with_empty_title() {
    let dir = create_temp_dir();
    let result = extract_and_save_images(&md_with_empty_title(), &dir, "images").unwrap();
    assert_eq!(result.extracted, 1, "markdown was: {}", result.markdown);
    assert!(result.markdown.contains("images/image-"));
    assert!(!result.markdown.contains("data:image"));
    assert_eq!(fs::read_dir(dir.join("images")).unwrap().count(), 1);
    cleanup(&dir);
}

#[test]
fn extract_base64_to_buffers_handles_image_with_empty_title() {
    let result = extract_base64_to_buffers(&md_with_empty_title(), "images").unwrap();
    assert_eq!(result.images.len(), 1, "markdown was: {}", result.markdown);
    assert!(!result.markdown.contains("data:image"));
}

#[test]
fn extract_and_save_images_handles_image_with_nonempty_title() {
    let dir = create_temp_dir();
    let result = extract_and_save_images(&md_with_nonempty_title(), &dir, "images").unwrap();
    assert_eq!(result.extracted, 1, "markdown was: {}", result.markdown);
    assert!(result.markdown.contains("images/image-"));
    assert!(!result.markdown.contains("data:image"));
    assert_eq!(fs::read_dir(dir.join("images")).unwrap().count(), 1);
    cleanup(&dir);
}
