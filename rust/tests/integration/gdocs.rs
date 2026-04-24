use std::collections::HashMap;
use std::fs;
use std::path::PathBuf;

use web_capture::gdocs::{
    build_docs_api_url, build_edit_url, build_export_url, create_archive_zip,
    extract_base64_images, extract_bearer_token, extract_document_id, is_google_docs_url,
    localize_rendered_remote_images_for_archive, normalize_google_docs_export_markdown,
    parse_model_chunks, preprocess_google_docs_export_html, render_captured_document,
    render_docs_api_document, select_capture_method, CapturedBlock, CapturedDocument, ContentNode,
    ExtractedImage, GDocsArchiveResult, GDocsCaptureMethod, GDocsRenderedResult, RemoteImage,
};

fn issue_104_fixture_path(filename: &str) -> PathBuf {
    PathBuf::from(env!("CARGO_MANIFEST_DIR"))
        .join("..")
        .join("docs")
        .join("case-studies")
        .join("issue-104")
        .join("fixtures")
        .join(filename)
}

fn read_issue_104_fixture(filename: &str) -> String {
    let path = issue_104_fixture_path(filename);
    fs::read_to_string(&path)
        .unwrap_or_else(|error| panic!("failed to read {}: {error}", path.display()))
}

fn read_issue_104_fixture_normalized(filename: &str) -> String {
    read_issue_104_fixture(filename).replace("\r\n", "\n")
}

fn load_issue_104_model_fixture() -> (Vec<serde_json::Value>, HashMap<String, String>) {
    let fixture: serde_json::Value = serde_json::from_str(&read_issue_104_fixture(
        "multiline-marked-inline-image-model.json",
    ))
    .expect("issue 104 model fixture should be valid JSON");
    let chunks = fixture
        .get("chunks")
        .and_then(serde_json::Value::as_array)
        .expect("fixture should include chunks")
        .clone();
    let cid_urls = fixture
        .get("cidUrlMap")
        .and_then(serde_json::Value::as_object)
        .expect("fixture should include cidUrlMap")
        .iter()
        .filter_map(|(key, value)| value.as_str().map(|url| (key.clone(), url.to_string())))
        .collect();

    (chunks, cid_urls)
}

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
fn test_parse_model_chunks_renders_soft_breaks_and_image_dimensions_issue_104() {
    let (chunks, cid_urls) = load_issue_104_model_fixture();
    let capture = parse_model_chunks(&chunks, &cid_urls);

    let CapturedBlock::Paragraph { content, .. } = &capture.blocks[0] else {
        panic!("issue 104 fixture should produce one paragraph block");
    };
    assert_eq!(
        content[0],
        ContentNode::Text {
            text: "Line one of bold text.".to_string(),
            bold: true,
            italic: false,
            strike: false,
            link: None,
        }
    );
    assert_eq!(
        content[1],
        ContentNode::Text {
            text: "\n".to_string(),
            bold: false,
            italic: false,
            strike: false,
            link: None,
        }
    );
    assert_eq!(
        content[2],
        ContentNode::Text {
            text: "Line two of bold text.".to_string(),
            bold: true,
            italic: false,
            strike: false,
            link: None,
        }
    );
    assert!(
        matches!(&content[3], ContentNode::Image { alt, .. } if alt == "Inline diagram"),
        "expected inline image at content index 3, got {:?}",
        content[3]
    );
    assert_eq!(
        content[4],
        ContentNode::Text {
            text: "\n\n".to_string(),
            bold: false,
            italic: false,
            strike: false,
            link: None,
        }
    );
    assert_eq!(
        content[5],
        ContentNode::Text {
            text: "Line three of bold text.".to_string(),
            bold: true,
            italic: false,
            strike: false,
            link: None,
        }
    );

    assert_eq!(
        render_captured_document(&capture, "html"),
        read_issue_104_fixture("multiline-marked-inline-image.expected.html").trim_end()
    );
    assert_eq!(
        render_captured_document(&capture, "markdown"),
        read_issue_104_fixture_normalized("multiline-marked-inline-image.expected.md")
    );
}

#[test]
fn test_render_markdown_and_html_close_marks_around_embedded_newlines_issue_104() {
    let capture = CapturedDocument {
        blocks: vec![CapturedBlock::Paragraph {
            content: vec![ContentNode::Text {
                text: "Alpha\nBeta".to_string(),
                bold: true,
                italic: false,
                strike: false,
                link: None,
            }],
            style: None,
            list: None,
            quote: false,
            horizontal_rule: false,
        }],
        ..CapturedDocument::default()
    };

    assert_eq!(
        render_captured_document(&capture, "html"),
        "<!doctype html><html><body><p><strong>Alpha</strong><br><strong>Beta</strong></p></body></html>"
    );
    assert_eq!(
        render_captured_document(&capture, "markdown"),
        "**Alpha**\n**Beta**\n"
    );
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

#[tokio::test]
async fn test_localize_rendered_remote_images_for_archive_downloads_model_images_issue_100() {
    let png_bytes = vec![137, 80, 78, 71, 13, 10, 26, 10];
    let server = ImageServer::start(png_bytes.clone()).await;
    let image_url = format!("{}/image", server.url.trim_end_matches('/'));
    let rendered = GDocsRenderedResult {
        markdown: format!("![pic]({image_url})\n"),
        html: format!(r#"<img src="{image_url}" alt="pic">"#),
        text: "[pic]".to_string(),
        document_id: "doc".to_string(),
        export_url: "https://docs.google.com/document/d/doc/edit".to_string(),
        remote_images: vec![RemoteImage {
            url: image_url,
            alt: "pic".to_string(),
        }],
    };

    let archive = localize_rendered_remote_images_for_archive(&rendered)
        .await
        .unwrap();
    server.shutdown().await;

    assert_eq!(archive.images.len(), 1);
    assert_eq!(archive.images[0].filename, "image-01.png");
    assert_eq!(archive.images[0].data, png_bytes);
    assert!(archive.markdown.contains("images/image-01.png"));
    assert!(archive.html.contains("images/image-01.png"));
    assert!(!archive.markdown.contains("http://"));
}

#[test]
fn test_parse_model_chunks_multi_column_table_r2() {
    // Inside a table, a bare '\n' separates cells within the current row.
    // Rows are delimited by 0x12 (and the table itself by 0x10/0x11). This
    // mirrors the JS R2 fix so tables keep all columns instead of collapsing
    // to one column per row.
    let text = format!(
        "{open}{new_row}A\nB\nC\n{new_row}D\nE\nF\n{close}",
        open = '\u{10}',
        close = '\u{11}',
        new_row = '\u{12}',
    );
    let chunks = vec![serde_json::json!({
        "chunk": [
            { "ty": "is", "s": text }
        ]
    })];
    let cid_urls = std::collections::HashMap::<String, String>::new();

    let capture = parse_model_chunks(&chunks, &cid_urls);

    assert_eq!(capture.tables.len(), 1);
    let table = &capture.tables[0];
    assert_eq!(table.rows.len(), 2);
    assert_eq!(table.rows[0].cells.len(), 3);
    assert_eq!(table.rows[1].cells.len(), 3);

    let markdown = render_captured_document(&capture, "markdown");
    assert!(
        markdown.contains("| A | B | C |"),
        "markdown was: {markdown}"
    );
    assert!(
        markdown.contains("| D | E | F |"),
        "markdown was: {markdown}"
    );
}

#[test]
fn test_parse_model_chunks_drops_duplicate_table_separator_empty_cells_issue_96() {
    let text = format!(
        "{open}{new_row}A{cell}\nB{cell}\nC\n{close}",
        open = '\u{10}',
        close = '\u{11}',
        new_row = '\u{12}',
        cell = '\u{1c}',
    );
    let chunks = vec![serde_json::json!({
        "chunk": [
            { "ty": "is", "s": text }
        ]
    })];
    let cid_urls = std::collections::HashMap::<String, String>::new();

    let capture = parse_model_chunks(&chunks, &cid_urls);
    let table = &capture.tables[0];
    let markdown = render_captured_document(&capture, "markdown");

    assert_eq!(table.rows[0].cells.len(), 3);
    assert!(
        markdown.contains("| A | B | C |"),
        "markdown was: {markdown}"
    );
    assert!(
        !markdown.contains("| A |  | B |"),
        "markdown should not contain duplicate empty columns: {markdown}"
    );
}

#[test]
fn test_parse_model_chunks_drops_live_gdocs_table_ghost_columns_issue_100() {
    let text = format!(
        "{open}{new_row}{cell}Feature\n{cell}Supported\n{cell}Notes\n{new_row}{cell}Bold\n{cell}Yes\n{cell}Using double asterisks\n{close}",
        open = '\u{10}',
        close = '\u{11}',
        new_row = '\u{12}',
        cell = '\u{1c}',
    );
    let chunks = vec![serde_json::json!({
        "chunk": [
            { "ty": "is", "s": text }
        ]
    })];
    let cid_urls = std::collections::HashMap::<String, String>::new();

    let capture = parse_model_chunks(&chunks, &cid_urls);
    let markdown = render_captured_document(&capture, "markdown");

    assert_eq!(
        capture.tables[0]
            .rows
            .iter()
            .map(|row| row.cells.len())
            .collect::<Vec<_>>(),
        vec![3, 3]
    );
    assert!(
        markdown.contains("| Feature | Supported | Notes |"),
        "markdown was: {markdown}"
    );
    assert!(
        markdown.contains("| Bold | Yes | Using double asterisks |"),
        "markdown was: {markdown}"
    );
    assert!(
        !markdown.contains("| Feature |  | Supported |"),
        "markdown should not contain ghost columns: {markdown}"
    );
}

#[test]
fn test_parse_model_chunks_preserves_empty_table_cell_positions_issue_100() {
    let text = format!(
        "{open}{new_row}{cell}A\n{cell}B\n{cell}C\n{new_row}{cell}\n{cell}x\n{cell}\n{new_row}{cell}y\n{cell}\n{cell}z\n{close}",
        open = '\u{10}',
        close = '\u{11}',
        new_row = '\u{12}',
        cell = '\u{1c}',
    );
    let chunks = vec![serde_json::json!({
        "chunk": [
            { "ty": "is", "s": text }
        ]
    })];
    let cid_urls = std::collections::HashMap::<String, String>::new();

    let capture = parse_model_chunks(&chunks, &cid_urls);
    let markdown = render_captured_document(&capture, "markdown");

    assert_eq!(
        capture.tables[0]
            .rows
            .iter()
            .map(|row| row.cells.len())
            .collect::<Vec<_>>(),
        vec![3, 3, 3]
    );
    assert!(
        markdown.contains("| A | B | C |"),
        "markdown was: {markdown}"
    );
    assert!(markdown.contains("|  | x |  |"), "markdown was: {markdown}");
    assert!(
        markdown.contains("| y |  | z |"),
        "markdown was: {markdown}"
    );
}

#[test]
fn test_render_ordered_list_sequential_numbering_r3() {
    let text = "First item\nSecond item\nThird item\n";
    let line_end = |needle: &str| {
        let start = text.find(needle).expect("needle should exist");
        start + text[start..].find('\n').expect("line should end") + 1
    };
    let chunks = vec![serde_json::json!({
        "chunk": [
            { "ty": "is", "s": text },
            {
                "ty": "as",
                "st": "list",
                "si": line_end("First item"),
                "ei": line_end("First item"),
                "sm": { "ls_id": "kix.list.7" }
            },
            {
                "ty": "as",
                "st": "list",
                "si": line_end("Second item"),
                "ei": line_end("Second item"),
                "sm": { "ls_id": "kix.list.7" }
            },
            {
                "ty": "as",
                "st": "list",
                "si": line_end("Third item"),
                "ei": line_end("Third item"),
                "sm": { "ls_id": "kix.list.7" }
            }
        ]
    })];
    let cid_urls = std::collections::HashMap::<String, String>::new();

    let capture = parse_model_chunks(&chunks, &cid_urls);
    let markdown = render_captured_document(&capture, "markdown");

    assert!(
        markdown.contains("1. First item"),
        "markdown was: {markdown}"
    );
    assert!(
        markdown.contains("2. Second item"),
        "markdown was: {markdown}"
    );
    assert!(
        markdown.contains("3. Third item"),
        "markdown was: {markdown}"
    );
}

#[test]
fn test_render_list_items_joined_with_single_newline_r4() {
    let text = "Alpha\nBeta\nGamma\n";
    let line_end = |needle: &str| {
        let start = text.find(needle).expect("needle should exist");
        start + text[start..].find('\n').expect("line should end") + 1
    };
    let chunks = vec![serde_json::json!({
        "chunk": [
            { "ty": "is", "s": text },
            {
                "ty": "as",
                "st": "list",
                "si": line_end("Alpha"),
                "ei": line_end("Alpha"),
                "sm": { "ls_id": "kix.list.1" }
            },
            {
                "ty": "as",
                "st": "list",
                "si": line_end("Beta"),
                "ei": line_end("Beta"),
                "sm": { "ls_id": "kix.list.1" }
            },
            {
                "ty": "as",
                "st": "list",
                "si": line_end("Gamma"),
                "ei": line_end("Gamma"),
                "sm": { "ls_id": "kix.list.1" }
            }
        ]
    })];
    let cid_urls = std::collections::HashMap::<String, String>::new();

    let capture = parse_model_chunks(&chunks, &cid_urls);
    let markdown = render_captured_document(&capture, "markdown");

    assert!(
        markdown.contains("- Alpha\n- Beta\n- Gamma"),
        "list items should be joined with a single newline; markdown was: {markdown}"
    );
    assert!(
        !markdown.contains("- Alpha\n\n- Beta"),
        "list items should not have a blank line between them; markdown was: {markdown}"
    );
}

#[test]
fn test_render_nested_ordered_lists_keep_type_and_tight_spacing_issue_100() {
    let text = [
        "Parent item 1",
        "Child item 1.1",
        "Child item 1.2",
        "Grandchild item 1.2.1",
        "Grandchild item 1.2.2",
        "Child item 1.3",
        "Parent item 2",
        "",
    ]
    .join("\n");
    let line_end = |needle: &str| {
        let start = text.find(needle).expect("needle should exist");
        start + text[start..].find('\n').expect("line should end") + 1
    };
    let chunks = vec![serde_json::json!({
        "chunk": [
            { "ty": "is", "s": text },
            {
                "ty": "as",
                "st": "list",
                "si": line_end("Parent item 1"),
                "ei": line_end("Parent item 1"),
                "sm": { "ls_id": "kix.list.8" }
            },
            {
                "ty": "as",
                "st": "list",
                "si": line_end("Child item 1.1"),
                "ei": line_end("Child item 1.1"),
                "sm": { "ls_id": "kix.list.9", "ls_nest": 1 }
            },
            {
                "ty": "as",
                "st": "list",
                "si": line_end("Child item 1.2"),
                "ei": line_end("Child item 1.2"),
                "sm": { "ls_id": "kix.list.9", "ls_nest": 1 }
            },
            {
                "ty": "as",
                "st": "list",
                "si": line_end("Grandchild item 1.2.1"),
                "ei": line_end("Grandchild item 1.2.1"),
                "sm": { "ls_id": "kix.list.10", "ls_nest": 2 }
            },
            {
                "ty": "as",
                "st": "list",
                "si": line_end("Grandchild item 1.2.2"),
                "ei": line_end("Grandchild item 1.2.2"),
                "sm": { "ls_id": "kix.list.10", "ls_nest": 2 }
            },
            {
                "ty": "as",
                "st": "list",
                "si": line_end("Child item 1.3"),
                "ei": line_end("Child item 1.3"),
                "sm": { "ls_id": "kix.list.9", "ls_nest": 1 }
            },
            {
                "ty": "as",
                "st": "list",
                "si": line_end("Parent item 2"),
                "ei": line_end("Parent item 2"),
                "sm": { "ls_id": "kix.list.8" }
            }
        ]
    })];
    let cid_urls = std::collections::HashMap::<String, String>::new();

    let capture = parse_model_chunks(&chunks, &cid_urls);
    let markdown = render_captured_document(&capture, "markdown");

    assert!(
        markdown.contains(
            "1. Parent item 1\n    1. Child item 1.1\n    2. Child item 1.2\n        1. Grandchild item 1.2.1\n        2. Grandchild item 1.2.2\n    3. Child item 1.3\n2. Parent item 2"
        ),
        "markdown was: {markdown}"
    );
    assert!(
        !markdown.contains("Parent item 1\n\n"),
        "nested list should not contain blank lines: {markdown}"
    );
    assert!(
        !markdown.contains("- Child item 1.1"),
        "nested ordered children should not render as bullets: {markdown}"
    );
}

#[test]
fn test_render_nested_bold_italic_markers_balanced_issue_96() {
    let text = "Bold text with italic inside and back to bold\n";
    let start_of = |needle: &str| text.find(needle).expect("needle should exist") + 1;
    let end_of = |needle: &str| start_of(needle) + needle.len() - 1;
    let chunks = vec![serde_json::json!({
        "chunk": [
            { "ty": "is", "s": text },
            {
                "ty": "as",
                "st": "text",
                "si": 1,
                "ei": text.len() - 1,
                "sm": { "ts_bd": true }
            },
            {
                "ty": "as",
                "st": "text",
                "si": start_of("italic"),
                "ei": end_of("italic inside"),
                "sm": { "ts_it": true }
            }
        ]
    })];
    let cid_urls = std::collections::HashMap::<String, String>::new();

    let capture = parse_model_chunks(&chunks, &cid_urls);
    let markdown = render_captured_document(&capture, "markdown");

    assert_eq!(
        markdown,
        "**Bold text with *italic inside* and back to bold**\n"
    );
}

#[test]
fn test_render_styled_same_target_link_segments_as_one_label_issue_96() {
    let text = "Link with bold text\n";
    let start_of = |needle: &str| text.find(needle).expect("needle should exist") + 1;
    let end_of = |needle: &str| start_of(needle) + needle.len() - 1;
    let chunks = vec![serde_json::json!({
        "chunk": [
            { "ty": "is", "s": text },
            {
                "ty": "as",
                "st": "link",
                "si": 1,
                "ei": text.len() - 1,
                "sm": { "lnks_link": { "ulnk_url": "https://example.com" } }
            },
            {
                "ty": "as",
                "st": "text",
                "si": start_of("bold"),
                "ei": end_of("bold"),
                "sm": { "ts_bd": true }
            }
        ]
    })];
    let cid_urls = std::collections::HashMap::<String, String>::new();

    let capture = parse_model_chunks(&chunks, &cid_urls);
    let markdown = render_captured_document(&capture, "markdown");

    assert_eq!(markdown, "[Link with **bold** text](https://example.com)\n");
}

#[test]
fn test_render_consecutive_blockquote_paragraphs_stay_in_one_quote_issue_96() {
    let text = "Quote paragraph one\nQuote paragraph two\n";
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
                "si": line_end("Quote paragraph one"),
                "ei": line_end("Quote paragraph one"),
                "sm": { "ps_il": 24, "ps_ifl": 24 }
            },
            {
                "ty": "as",
                "st": "paragraph",
                "si": line_end("Quote paragraph two"),
                "ei": line_end("Quote paragraph two"),
                "sm": { "ps_il": 24, "ps_ifl": 24 }
            }
        ]
    })];
    let cid_urls = std::collections::HashMap::<String, String>::new();

    let capture = parse_model_chunks(&chunks, &cid_urls);
    let markdown = render_captured_document(&capture, "markdown");

    assert_eq!(
        markdown,
        "> Quote paragraph one\n>\n> Quote paragraph two\n"
    );
}

#[test]
fn test_render_captured_markdown_ends_with_newline_issue_96() {
    let chunks = vec![serde_json::json!({ "ty": "is", "s": "Last line\n" })];
    let cid_urls = std::collections::HashMap::<String, String>::new();
    let capture = parse_model_chunks(&chunks, &cid_urls);

    assert_eq!(
        render_captured_document(&capture, "markdown"),
        "Last line\n"
    );
}

#[test]
fn test_preprocess_exports_hoists_font_weight_r6() {
    let html = r#"<p><span style="font-weight:700">Bold text</span></p>"#;
    let out = preprocess_google_docs_export_html(html);
    assert_eq!(out.hoisted, 1);
    assert!(out.html.contains("<strong>"));
    assert!(out.html.contains("Bold text"));
}

#[test]
fn test_preprocess_exports_hoists_font_style_italic_r6() {
    let html = r#"<p><span style="font-style:italic">Italic</span></p>"#;
    let out = preprocess_google_docs_export_html(html);
    assert_eq!(out.hoisted, 1);
    assert!(out.html.contains("<em>"));
}

#[test]
fn test_preprocess_exports_hoists_strikethrough_r6() {
    let html = r#"<p><span style="text-decoration:line-through">Strike</span></p>"#;
    let out = preprocess_google_docs_export_html(html);
    assert_eq!(out.hoisted, 1);
    assert!(out.html.contains("<del>"));
}

#[test]
fn test_preprocess_exports_hoists_google_docs_css_class_styles_issue_96() {
    let html = r#"<style>.c7{font-weight:700}.c19{font-style:italic}.c21{text-decoration:line-through}</style><p><span class="c7">Bold</span> <span class="c19">Italic</span> <span class="c21">Strike</span></p>"#;
    let out = preprocess_google_docs_export_html(html);
    assert_eq!(out.hoisted, 3);
    assert!(out.html.contains("<strong>Bold</strong>"));
    assert!(out.html.contains("<em>Italic</em>"));
    assert!(out.html.contains("<del>Strike</del>"));
}

#[test]
fn test_preprocess_exports_unwraps_redirect_links_r6() {
    let html = r#"<a href="https://www.google.com/url?q=https://example.com&sa=D&source=editors">Link</a>"#;
    let out = preprocess_google_docs_export_html(html);
    assert_eq!(out.unwrapped_links, 1);
    assert!(
        out.html.contains(r#"href="https://example.com""#),
        "html was: {}",
        out.html
    );
    assert!(!out.html.contains("google.com/url?q="));
}

#[test]
fn test_preprocess_exports_strips_heading_numbering_r6() {
    let html = r#"<h1><a id="h.abc"></a><span>1. </span>Headings</h1>"#;
    let out = preprocess_google_docs_export_html(html);
    assert!(
        out.html.contains("<h1>") && out.html.contains("Headings</h1>"),
        "html was: {}",
        out.html
    );
    assert!(!out.html.contains("1. "));
    assert!(!out.html.contains(r#"<a id="h.abc""#));
}

#[test]
fn test_preprocess_exports_strips_standalone_empty_anchors_issue_96() {
    let html = r#"<a id="anchor-1"></a><h2>Headings</h2>"#;
    let out = preprocess_google_docs_export_html(html);
    assert!(out.html.contains("<h2>Headings</h2>"));
    assert!(!out.html.contains(r#"<a id="anchor-1""#));
}

#[test]
fn test_preprocess_exports_converts_class_indented_paragraphs_to_blockquotes_issue_96() {
    let html = r#"<style>.c18{margin-left:24pt;margin-right:24pt}</style><p class="c18">Quote</p>"#;
    let out = preprocess_google_docs_export_html(html);
    assert!(out.html.contains("<blockquote><p>Quote</p></blockquote>"));
}

#[test]
fn test_preprocess_exports_replaces_nbsp_r6() {
    let html = "<p>A&nbsp;B\u{00A0}C</p>";
    let out = preprocess_google_docs_export_html(html);
    assert!(out.html.contains("A B"));
    assert!(!out.html.contains("&nbsp;"));
    assert!(!out.html.contains('\u{00A0}'));
}

#[test]
fn test_preprocess_exports_noop_for_regular_html_r6() {
    let html = "<p>Plain text with <strong>bold</strong>.</p>";
    let out = preprocess_google_docs_export_html(html);
    assert_eq!(out.hoisted, 0);
    assert_eq!(out.unwrapped_links, 0);
    assert!(out
        .html
        .contains("<p>Plain text with <strong>bold</strong>.</p>"));
}

#[test]
fn test_public_export_markdown_normalization_issue_102() {
    let html = r#"
        <style>
          .c5{margin-left:36pt}
          .c8{margin-left:72pt}
          .c19{margin-left:108pt}
          .q{margin-left:24pt;margin-right:24pt}
          .i{font-style:italic}
          .s{text-decoration:line-through}
        </style>
        <h2><span class="i">1. Headings</span></h2>
        <p class="q">Quote one.</p>
        <p class="q">Quote two.</p>
        <ol><li class="c5">Parent</li></ol>
        <ol><li class="c8">Child</li></ol>
        <ol><li class="c19">Grandchild</li></ol>
        <ol><li class="c5">Parent 2</li></ol>
        <table>
          <thead>
            <tr><td><p>Feature</p></td><td><p>Supported</p></td><tbody></tbody></tr>
            <tr><td><p><span class="s">Strike</span></p></td><td><p>Yes</p></td></tr>
          </thead>
        </table>
    "#;
    let preprocessed = preprocess_google_docs_export_html(html);
    let raw_markdown =
        web_capture::markdown::convert_html_to_markdown(&preprocessed.html, None).unwrap();
    let markdown = normalize_google_docs_export_markdown(&raw_markdown);

    assert!(
        markdown.contains("## 1. Headings"),
        "markdown was: {markdown}"
    );
    assert!(
        !markdown.contains("*1. Headings*"),
        "heading style should not leak as inline emphasis: {markdown}"
    );
    assert!(
        markdown.contains("> Quote one.\n>\n> Quote two."),
        "blockquote paragraphs should stay grouped: {markdown}"
    );
    assert!(
        markdown.contains("1. Parent\n   1. Child\n      1. Grandchild\n2. Parent 2"),
        "nested list indentation should be preserved: {markdown}"
    );
    assert!(
        markdown.contains("| Feature | Supported |"),
        "table should be compact: {markdown}"
    );
    assert!(
        markdown.contains("| ~~Strike~~ | Yes |"),
        "strikethrough should use double tildes in tables: {markdown}"
    );
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

struct ImageServer {
    url: String,
    shutdown: tokio::sync::oneshot::Sender<()>,
    handle: tokio::task::JoinHandle<()>,
}

impl ImageServer {
    async fn start(body: Vec<u8>) -> Self {
        let listener = tokio::net::TcpListener::bind("127.0.0.1:0").await.unwrap();
        let addr = listener.local_addr().unwrap();
        let (shutdown, mut shutdown_rx) = tokio::sync::oneshot::channel::<()>();
        let handle = tokio::spawn(async move {
            loop {
                tokio::select! {
                    _ = &mut shutdown_rx => break,
                    accepted = listener.accept() => {
                        let Ok((mut stream, _)) = accepted else {
                            break;
                        };
                        let body = body.clone();
                        tokio::spawn(async move {
                            use tokio::io::{AsyncReadExt, AsyncWriteExt};

                            let mut request = [0_u8; 1024];
                            let _ = stream.read(&mut request).await;
                            let headers = format!(
                                "HTTP/1.1 200 OK\r\nContent-Type: image/png\r\nContent-Length: {}\r\nConnection: close\r\n\r\n",
                                body.len()
                            );
                            let _ = stream.write_all(headers.as_bytes()).await;
                            let _ = stream.write_all(&body).await;
                        });
                    }
                }
            }
        });

        Self {
            url: format!("http://{addr}"),
            shutdown,
            handle,
        }
    }

    async fn shutdown(self) {
        let _ = self.shutdown.send(());
        let _ = self.handle.await;
    }
}
