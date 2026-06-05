//! Integration tests for the public search API surface (issue #130).
//!
//! These exercise the crate's exported contract the way the server/CLI do,
//! without making network calls (parsers are pure; only error paths of the
//! async orchestrator are checked).

use web_capture::search::{
    build_search_url, format_search_as_markdown, parse_search_results, SearchDiagnostics,
    SearchResult, SearchResultItem,
};
use web_capture::{search, SEARCH_PROVIDERS};

const WIKI_JSON: &str = r#"{"pages":[
    {"id":1,"key":"Formal_methods","title":"Formal methods","excerpt":"the <b>study</b>","description":"x"}
]}"#;

#[test]
fn exposes_documented_provider_list() {
    assert_eq!(
        SEARCH_PROVIDERS,
        ["wikipedia", "duckduckgo", "google", "bing", "brave"]
    );
}

#[test]
fn builds_provider_urls() {
    assert!(build_search_url("wikipedia", "x", 10)
        .unwrap()
        .contains("en.wikipedia.org"));
    assert!(build_search_url("duckduckgo", "x", 10)
        .unwrap()
        .contains("duckduckgo.com"));
    assert!(build_search_url("nope", "x", 10).is_err());
}

#[test]
fn parses_and_serializes_contract() {
    let (results, blocked) = parse_search_results("wikipedia", WIKI_JSON, 10);
    assert!(!blocked);
    assert_eq!(results.len(), 1);
    assert_eq!(
        results[0].url,
        "https://en.wikipedia.org/wiki/Formal_methods"
    );

    let result = SearchResult {
        query: "q".into(),
        provider: "wikipedia".into(),
        capture_mode: "fetch".into(),
        captured_at: "t".into(),
        results: vec![results[0].clone()],
        diagnostics: SearchDiagnostics {
            status: 200,
            blocked_by_cors: false,
            blocked_by_captcha: false,
            source_url: "u".into(),
            error: None,
        },
    };
    let json = serde_json::to_string(&result).unwrap();
    assert!(json.contains("\"captureMode\""));
    assert!(json.contains("\"blockedByCaptcha\""));
}

#[test]
fn formats_markdown_document() {
    let result = SearchResult {
        query: "formal".into(),
        provider: "wikipedia".into(),
        capture_mode: "fetch".into(),
        captured_at: "t".into(),
        results: vec![SearchResultItem {
            rank: 1,
            title: "Formal methods".into(),
            url: "https://en.wikipedia.org/wiki/Formal_methods".into(),
            snippet: "study".into(),
        }],
        diagnostics: SearchDiagnostics {
            status: 200,
            blocked_by_cors: false,
            blocked_by_captcha: false,
            source_url: "u".into(),
            error: None,
        },
    };
    let md = format_search_as_markdown(&result);
    assert!(md.contains("# Search results for \"formal\""));
    assert!(md.contains("[Formal methods]"));
}

#[tokio::test]
async fn rejects_empty_query() {
    let err = search("   ", "wikipedia", 10, "fetch", "t").await;
    assert!(err.is_err());
}

#[tokio::test]
async fn rejects_unknown_provider() {
    let err = search("x", "yahoo", 10, "fetch", "t").await;
    assert!(err.unwrap_err().contains("Unknown search provider"));
}
