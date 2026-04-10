use web_capture::gdocs::{
    build_export_url, extract_bearer_token, extract_document_id, is_google_docs_url,
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
