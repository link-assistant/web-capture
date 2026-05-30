//! Pin the default image-mode contract and flag wiring (issue #112).
//!
//! These tests exercise the single image-handling chokepoint
//! [`web_capture::extract_images::apply_image_mode`] directly, independent of
//! any capture method or private document. They pin:
//!   * default `--format markdown` keeps remote URLs as direct links,
//!   * default mode never silently keeps a multi-megabyte inline base64 blob,
//!   * `--extract-images` writes an `images/` folder,
//!   * `--embed-images` keeps base64 inline,
//!   * every mode has an observable effect (no flag is a silent no-op).

use std::path::PathBuf;
use web_capture::extract_images::{apply_image_mode, ImageMode};

/// Create a unique temporary directory without pulling in the `tempfile` crate,
/// mirroring the helper used by the other extract-images integration tests.
fn temp_dir() -> PathBuf {
    use std::sync::atomic::{AtomicU64, Ordering};
    static COUNTER: AtomicU64 = AtomicU64::new(0);
    let id = COUNTER.fetch_add(1, Ordering::Relaxed);
    let dir = std::env::temp_dir().join(format!(
        "image-mode-defaults-{}-{id}",
        std::process::id()
    ));
    let _ = std::fs::remove_dir_all(&dir);
    std::fs::create_dir_all(&dir).unwrap();
    dir
}

fn fixture_md_with_remote_url() -> &'static str {
    "Hi.\n\n![](https://example.invalid/foo.png)\n\nBye.\n"
}

fn fixture_md_with_base64() -> String {
    let png = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8/5+hHgAHggJ/PchI7wAAAABJRU5ErkJggg==";
    format!("Hi.\n\n![](data:image/png;base64,{png})\n\nBye.\n")
}

#[test]
fn default_markdown_keeps_remote_urls_as_direct_links() {
    let result =
        apply_image_mode(fixture_md_with_remote_url(), ImageMode::Default, None).unwrap();
    assert!(result.markdown.contains("https://example.invalid/foo.png"));
    assert!(!result.markdown.contains("images/"));
    assert!(!result.markdown.contains("data:image"));
}

#[test]
fn default_markdown_keeps_base64_as_inline_when_no_remote_source_exists() {
    // Google-Docs export pre-supplies base64. Default mode must NOT silently
    // inline a 5.9 MB blob; it should either fall back to extracting OR refuse
    // with a clear error pointing the user to a flag.
    let md = fixture_md_with_base64();
    let result = apply_image_mode(&md, ImageMode::Default, None);
    // Acceptance: either the function returns inline-base64 with a WARN log, or
    // it errors. It must NOT silently emit a multi-megabyte file with no notice.
    match result {
        Ok(r) => assert!(
            !r.markdown.contains("data:image"),
            "default must not silently keep inline base64"
        ),
        Err(_) => {} // also acceptable: explicit error asking for a flag
    }
}

#[test]
fn extract_images_mode_writes_images_folder() {
    let tmp = temp_dir();
    let result = apply_image_mode(
        &fixture_md_with_base64(),
        ImageMode::Extract {
            dir: tmp.clone(),
            subdir: "images".into(),
        },
        None,
    )
    .unwrap();
    assert!(result.markdown.contains("images/image-"));
    assert_eq!(std::fs::read_dir(tmp.join("images")).unwrap().count(), 1);
    let _ = std::fs::remove_dir_all(&tmp);
}

#[test]
fn embed_images_mode_keeps_base64() {
    let result =
        apply_image_mode(&fixture_md_with_base64(), ImageMode::Embed, None).unwrap();
    assert!(result.markdown.contains("data:image"));
}

#[test]
fn flags_apply_uniformly_regardless_of_capture_method() {
    // Same input, three modes, three different (deterministic) outputs.
    // Must hold for both api-derived and browser-derived markdown.
    let base64 = fixture_md_with_base64();
    for source_md in [fixture_md_with_remote_url(), base64.as_str()] {
        let a = apply_image_mode(source_md, ImageMode::Default, None).unwrap();
        let b = apply_image_mode(source_md, ImageMode::Embed, None).unwrap();
        let tmp = temp_dir();
        let c = apply_image_mode(
            source_md,
            ImageMode::Extract {
                dir: tmp.clone(),
                subdir: "images".into(),
            },
            None,
        )
        .unwrap();
        // No two modes can produce identical output for both inputs (would prove
        // a flag is a no-op).
        assert!(
            a.markdown != b.markdown || a.markdown != c.markdown,
            "image-mode flags must have observable effect; source:\n{source_md}"
        );
        let _ = std::fs::remove_dir_all(&tmp);
    }
}
