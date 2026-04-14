use web_capture::gdocs::{
    build_export_url, create_archive_zip, extract_base64_images, extract_bearer_token,
    extract_document_id, is_google_docs_url, ExtractedImage, GDocsArchiveResult,
};

#[test]
fn test_is_google_docs_url_valid() {
    assert!(is_google_docs_url(
        "https://docs.google.com/document/d/1yn5AWdus0Rh5xRr6voNy-g2wNzdC4bM0CV7SQWch9H4/edit"
    ));
    assert!(is_google_docs_url(
        "https://docs.google.com/document/d/abc123/edit?tab=t.0"
    ));
    assert!(is_google_docs_url(
        "https://docs.google.com/document/d/abc-123_XYZ/"
    ));
}

#[test]
fn test_is_google_docs_url_invalid() {
    assert!(!is_google_docs_url("https://example.com"));
    assert!(!is_google_docs_url(
        "https://docs.google.com/spreadsheets/d/abc123"
    ));
    assert!(!is_google_docs_url(""));
}

#[test]
fn test_extract_document_id() {
    assert_eq!(
        extract_document_id(
            "https://docs.google.com/document/d/1yn5AWdus0Rh5xRr6voNy-g2wNzdC4bM0CV7SQWch9H4/edit"
        ),
        Some("1yn5AWdus0Rh5xRr6voNy-g2wNzdC4bM0CV7SQWch9H4".to_string())
    );
    assert_eq!(
        extract_document_id("https://docs.google.com/document/d/abc123/edit?tab=t.0"),
        Some("abc123".to_string())
    );
    assert_eq!(extract_document_id("https://example.com"), None);
}

#[test]
fn test_build_export_url() {
    assert_eq!(
        build_export_url("abc123", "html"),
        "https://docs.google.com/document/d/abc123/export?format=html"
    );
    assert_eq!(
        build_export_url("abc123", "md"),
        "https://docs.google.com/document/d/abc123/export?format=md"
    );
    assert_eq!(
        build_export_url("abc123", "invalid"),
        "https://docs.google.com/document/d/abc123/export?format=html"
    );
}

#[test]
fn test_extract_bearer_token() {
    assert_eq!(
        extract_bearer_token("Bearer my-token-123"),
        Some("my-token-123")
    );
    assert_eq!(
        extract_bearer_token("bearer my-token-123"),
        Some("my-token-123")
    );
    assert_eq!(extract_bearer_token("Bearer "), None);
    assert_eq!(extract_bearer_token("Basic abc123"), None);
    assert_eq!(extract_bearer_token(""), None);
}

#[test]
fn test_extract_base64_images_single() {
    let html = r#"<img src="data:image/png;base64,iVBORw0KGgo=" alt="test">"#;
    let (updated, images) = extract_base64_images(html);

    assert_eq!(images.len(), 1);
    assert_eq!(images[0].filename, "image-01.png");
    assert_eq!(images[0].mime_type, "image/png");
    assert!(updated.contains(r#"src="images/image-01.png""#));
    assert!(!updated.contains("data:image"));
}

#[test]
fn test_extract_base64_images_multiple() {
    let html = r#"<img src="data:image/png;base64,AAAA" alt="a"><img src="data:image/jpeg;base64,BBBB" alt="b">"#;
    let (updated, images) = extract_base64_images(html);

    assert_eq!(images.len(), 2);
    assert_eq!(images[0].filename, "image-01.png");
    assert_eq!(images[1].filename, "image-02.jpg");
    assert_eq!(images[1].mime_type, "image/jpeg");
    assert!(updated.contains("images/image-01.png"));
    assert!(updated.contains("images/image-02.jpg"));
}

#[test]
fn test_extract_base64_images_no_images() {
    let html = r"<p>No images here</p>";
    let (updated, images) = extract_base64_images(html);

    assert!(images.is_empty());
    assert_eq!(updated, html);
}

#[test]
fn test_extract_base64_images_preserves_non_data_images() {
    let html = r#"<img src="https://example.com/photo.png" alt="remote"><img src="data:image/gif;base64,R0lG" alt="local">"#;
    let (updated, images) = extract_base64_images(html);

    assert_eq!(images.len(), 1);
    assert_eq!(images[0].filename, "image-01.gif");
    assert!(updated.contains("https://example.com/photo.png"));
    assert!(updated.contains("images/image-01.gif"));
}

#[test]
fn test_create_archive_zip_produces_valid_zip() {
    let png_bytes = base64::Engine::decode(
        &base64::engine::general_purpose::STANDARD,
        "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8/5+hHgAHggJ/PchI7wAAAABJRU5ErkJggg==",
    )
    .unwrap();

    let archive = GDocsArchiveResult {
        html: "<html><body><img src=\"images/image-01.png\"><p>Hello</p></body></html>".to_string(),
        markdown: "# Hello\n\n![test](images/image-01.png)\n".to_string(),
        images: vec![ExtractedImage {
            filename: "image-01.png".to_string(),
            data: png_bytes.clone(),
            mime_type: "image/png".to_string(),
        }],
        document_id: "test-doc".to_string(),
        export_url: "https://docs.google.com/document/d/test-doc/export?format=html".to_string(),
    };

    let zip_bytes = create_archive_zip(&archive).unwrap();

    // Verify it's a real ZIP (magic bytes: PK\x03\x04)
    assert!(zip_bytes.len() > 4);
    assert_eq!(&zip_bytes[0..4], b"PK\x03\x04");

    // Verify contents using zip crate
    let reader = std::io::Cursor::new(&zip_bytes);
    let mut zip = zip::ZipArchive::new(reader).unwrap();

    let mut found_md = false;
    let mut found_html = false;
    let mut found_image = false;

    for i in 0..zip.len() {
        let file = zip.by_index(i).unwrap();
        match file.name() {
            "article.md" => {
                found_md = true;
                let content: Vec<u8> = std::io::Read::bytes(file).map(|b| b.unwrap()).collect();
                let text = String::from_utf8(content).unwrap();
                assert!(text.contains("# Hello"));
                assert!(text.contains("images/image-01.png"));
            }
            "article.html" => {
                found_html = true;
                let content: Vec<u8> = std::io::Read::bytes(file).map(|b| b.unwrap()).collect();
                let text = String::from_utf8(content).unwrap();
                assert!(text.contains("images/image-01.png"));
            }
            "images/image-01.png" => {
                found_image = true;
                let content: Vec<u8> = std::io::Read::bytes(file).map(|b| b.unwrap()).collect();
                assert_eq!(content, png_bytes);
            }
            _ => {}
        }
    }

    assert!(found_md, "ZIP must contain article.md");
    assert!(found_html, "ZIP must contain article.html");
    assert!(found_image, "ZIP must contain images/image-01.png");
}

#[test]
fn test_create_archive_zip_empty_images() {
    let archive = GDocsArchiveResult {
        html: "<html><body>No images</body></html>".to_string(),
        markdown: "# No images\n".to_string(),
        images: vec![],
        document_id: "empty-doc".to_string(),
        export_url: "https://docs.google.com/document/d/empty-doc/export?format=html".to_string(),
    };

    let zip_bytes = create_archive_zip(&archive).unwrap();
    assert_eq!(&zip_bytes[0..4], b"PK\x03\x04");

    let reader = std::io::Cursor::new(&zip_bytes);
    let zip = zip::ZipArchive::new(reader).unwrap();
    assert_eq!(zip.len(), 2); // article.md + article.html only
}
