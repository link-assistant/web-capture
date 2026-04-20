use web_capture::gdocs::{
    build_docs_api_url, build_edit_url, build_export_url, create_archive_zip,
    extract_base64_images, extract_bearer_token, extract_document_id, is_google_docs_url,
    parse_model_chunks, render_captured_document, render_docs_api_document, select_capture_method,
    ExtractedImage, GDocsArchiveResult, GDocsCaptureMethod,
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
fn test_capture_method_selection_honors_browser_flag() {
    assert_eq!(
        select_capture_method("browser", None).unwrap(),
        GDocsCaptureMethod::BrowserModel
    );
    assert_eq!(
        select_capture_method("api", None).unwrap(),
        GDocsCaptureMethod::PublicExport
    );
    assert_eq!(
        select_capture_method("api", Some("token")).unwrap(),
        GDocsCaptureMethod::DocsApi
    );
}

#[test]
fn test_build_edit_url() {
    assert_eq!(
        build_edit_url("abc123"),
        "https://docs.google.com/document/d/abc123/edit"
    );
}

#[test]
fn test_build_docs_api_url() {
    assert_eq!(
        build_docs_api_url("abc123"),
        "https://docs.googleapis.com/v1/documents/abc123"
    );
}

#[test]
fn test_parse_model_chunks_includes_suggestions_and_images() {
    let chunks = vec![serde_json::json!({
        "chunk": [
            { "ty": "is", "s": "Stable " },
            { "ty": "iss", "s": "suggested*\n" },
            { "ty": "ase", "id": "suggested-image", "epm": { "ee_eo": { "i_cid": "cid_12345678901234567890" } } },
            { "ty": "ste", "id": "suggested-image", "spi": 17 }
        ]
    })];
    let cid_urls = std::collections::HashMap::from([(
        "cid_12345678901234567890".to_string(),
        "https://docs.google.com/docs-images-rt/image-id".to_string(),
    )]);

    let capture = parse_model_chunks(&chunks, &cid_urls);
    let markdown = render_captured_document(&capture, "markdown");

    assert!(capture.text.contains("Stable suggested"));
    assert!(markdown.contains("Stable suggested"));
    assert!(
        markdown.contains("![suggested image](https://docs.google.com/docs-images-rt/image-id)")
    );
}

#[test]
fn test_parse_model_chunks_accepts_individual_model_items() {
    let chunks = vec![serde_json::json!({ "ty": "is", "s": "Pushed item\n" })];
    let cid_urls = std::collections::HashMap::<String, String>::new();

    let capture = parse_model_chunks(&chunks, &cid_urls);
    let markdown = render_captured_document(&capture, "markdown");

    assert!(capture.text.contains("Pushed item"));
    assert!(markdown.contains("Pushed item"));
}

#[test]
#[allow(clippy::too_many_lines)]
fn test_parse_model_chunks_renders_style_records() {
    let text = [
        "Title",
        "This is bold, italic, strike, and link",
        "-",
        "Item",
        "Quote",
        "*",
        "",
    ]
    .join("\n");
    let start_of = |needle: &str| text.find(needle).expect("needle should exist") + 1;
    let end_of = |needle: &str| start_of(needle) + needle.len() - 1;
    let line_end = |needle: &str| {
        let start = text.find(needle).expect("needle should exist");
        start + text[start..].find('\n').expect("line should end") + 1
    };
    let chunks = vec![serde_json::json!({
        "chunk": [
            { "ty": "is", "s": text },
            {
                "ty": "as",
                "st": "paragraph",
                "si": line_end("Title"),
                "ei": line_end("Title"),
                "sm": { "ps_hd": 1 }
            },
            {
                "ty": "as",
                "st": "text",
                "si": start_of("bold"),
                "ei": end_of("bold"),
                "sm": { "ts_bd": true }
            },
            {
                "ty": "as",
                "st": "text",
                "si": start_of("italic"),
                "ei": end_of("italic"),
                "sm": { "ts_it": true }
            },
            {
                "ty": "as",
                "st": "text",
                "si": start_of("strike"),
                "ei": end_of("strike"),
                "sm": { "ts_st": true }
            },
            {
                "ty": "as",
                "st": "link",
                "si": start_of("link"),
                "ei": end_of("link"),
                "sm": { "lnks_link": { "ulnk_url": "https://example.com" } }
            },
            {
                "ty": "as",
                "st": "horizontal_rule",
                "si": start_of("-"),
                "ei": start_of("-"),
                "sm": {}
            },
            {
                "ty": "as",
                "st": "list",
                "si": line_end("Item"),
                "ei": line_end("Item"),
                "sm": { "ls_id": "kix.list.3" }
            },
            {
                "ty": "as",
                "st": "paragraph",
                "si": line_end("Quote"),
                "ei": line_end("Quote"),
                "sm": { "ps_il": 24, "ps_ifl": 24 }
            },
            {
                "ty": "ae",
                "et": "inline",
                "id": "image-1",
                "epm": {
                    "ee_eo": {
                        "i_cid": "cid_12345678901234567890",
                        "eo_ad": "Blue rectangle"
                    }
                }
            },
            { "ty": "te", "id": "image-1", "spi": start_of("*") }
        ]
    })];
    let cid_urls = std::collections::HashMap::from([(
        "cid_12345678901234567890".to_string(),
        "https://docs.google.com/docs-images-rt/image-id".to_string(),
    )]);

    let capture = parse_model_chunks(&chunks, &cid_urls);
    let markdown = render_captured_document(&capture, "markdown");

    assert!(markdown.contains("# Title"));
    assert!(markdown
        .contains("This is **bold**, *italic*, ~~strike~~, and [link](https://example.com)"));
    assert!(markdown.contains("---"));
    assert!(markdown.contains("- Item"));
    assert!(markdown.contains("> Quote"));
    assert!(markdown.contains("![Blue rectangle](https://docs.google.com/docs-images-rt/image-id)"));
}

#[test]
fn test_parse_model_chunks_translates_utf16_positions() {
    let text = "😀 bold*\n";
    let start_of = |needle: &str| {
        let byte_idx = text.find(needle).expect("needle should exist");
        text[..byte_idx].encode_utf16().count() + 1
    };
    let end_of = |needle: &str| start_of(needle) + needle.encode_utf16().count() - 1;
    let chunks = vec![serde_json::json!({
        "chunk": [
            { "ty": "is", "s": text },
            {
                "ty": "as",
                "st": "text",
                "si": start_of("bold"),
                "ei": end_of("bold"),
                "sm": { "ts_bd": true }
            },
            {
                "ty": "ae",
                "et": "inline",
                "id": "image-1",
                "epm": {
                    "ee_eo": {
                        "i_cid": "cid_12345678901234567890",
                        "eo_ad": "Blue rectangle"
                    }
                }
            },
            { "ty": "te", "id": "image-1", "spi": start_of("*") }
        ]
    })];
    let cid_urls = std::collections::HashMap::from([(
        "cid_12345678901234567890".to_string(),
        "https://docs.google.com/docs-images-rt/image-id".to_string(),
    )]);

    let capture = parse_model_chunks(&chunks, &cid_urls);
    let markdown = render_captured_document(&capture, "markdown");

    assert!(markdown
        .contains("😀 **bold**![Blue rectangle](https://docs.google.com/docs-images-rt/image-id)"));
}

#[test]
fn test_render_docs_api_document_paragraphs_tables_and_images() {
    let api_document = serde_json::json!({
        "title": "API Doc",
        "body": {
            "content": [
                {
                    "paragraph": {
                        "elements": [
                            { "textRun": { "content": "Intro paragraph\n" } }
                        ]
                    }
                },
                {
                    "table": {
                        "tableRows": [
                            {
                                "tableCells": [
                                    {
                                        "content": [
                                            {
                                                "paragraph": {
                                                    "elements": [
                                                        { "textRun": { "content": "Name\n" } }
                                                    ]
                                                }
                                            }
                                        ]
                                    },
                                    {
                                        "content": [
                                            {
                                                "paragraph": {
                                                    "elements": [
                                                        {
                                                            "inlineObjectElement": {
                                                                "inlineObjectId": "image-1"
                                                            }
                                                        }
                                                    ]
                                                }
                                            }
                                        ]
                                    }
                                ]
                            }
                        ]
                    }
                }
            ]
        },
        "inlineObjects": {
            "image-1": {
                "inlineObjectProperties": {
                    "embeddedObject": {
                        "title": "Diagram",
                        "imageProperties": {
                            "contentUri": "https://example.com/diagram.png"
                        }
                    }
                }
            }
        }
    });

    let rendered = render_docs_api_document(&api_document);

    assert!(rendered.markdown.contains("Intro paragraph"));
    assert!(rendered.markdown.contains("| Name | ![Diagram]"));
    assert!(rendered.html.contains("<table>"));
    assert!(rendered
        .html
        .contains("src=\"https://example.com/diagram.png\""));
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

    let zip_bytes = create_archive_zip(&archive, false).unwrap();

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
            "document.md" => {
                found_md = true;
                let content: Vec<u8> = std::io::Read::bytes(file).map(|b| b.unwrap()).collect();
                let text = String::from_utf8(content).unwrap();
                assert!(text.contains("# Hello"));
                assert!(text.contains("images/image-01.png"));
            }
            "document.html" => {
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

    assert!(found_md, "ZIP must contain document.md");
    assert!(found_html, "ZIP must contain document.html");
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

    let zip_bytes = create_archive_zip(&archive, false).unwrap();
    assert_eq!(&zip_bytes[0..4], b"PK\x03\x04");

    let reader = std::io::Cursor::new(&zip_bytes);
    let zip = zip::ZipArchive::new(reader).unwrap();
    assert_eq!(zip.len(), 2); // document.md + document.html only
}
