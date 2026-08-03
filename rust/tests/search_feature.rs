//! Smoke test for the minimal, transport-independent search feature.

use std::collections::BTreeMap;

use web_capture::{
    build_search_url, parse_search_results, search_with_transport, ResponseReceipt,
    TransportDiagnostics, TransportRequest,
};

#[test]
fn pure_search_api_builds_urls_and_parses_caller_owned_responses() {
    let source_url = build_search_url("wikipedia", "formal methods", 1).unwrap();
    assert_eq!(
        source_url,
        "https://en.wikipedia.org/w/rest.php/v1/search/page?q=formal+methods&limit=1"
    );

    let receipt = ResponseReceipt {
        body: br#"{"pages":[{"id":1,"key":"Formal_methods","title":"Formal methods","excerpt":"rigorous techniques","description":null}]}"#.to_vec(),
        final_url: source_url,
        status: 200,
        headers: BTreeMap::new(),
        diagnostics: TransportDiagnostics::response(),
    };
    let body = String::from_utf8(receipt.body).unwrap();
    let (results, blocked) = parse_search_results("wikipedia", &body, 1);

    assert!(!blocked);
    assert_eq!(results.len(), 1);
    assert_eq!(results[0].title, "Formal methods");

    // Caller-owned transport types stay available without selecting a runtime.
    let request = TransportRequest {
        url: receipt.final_url,
        method: "GET".into(),
        headers: BTreeMap::new(),
    };
    assert_eq!(request.method, "GET");

    let transport_receipt = ResponseReceipt {
        body: br#"{"pages":[]}"#.to_vec(),
        final_url: request.url,
        status: 200,
        headers: BTreeMap::new(),
        diagnostics: TransportDiagnostics::response(),
    };
    let transport = move |_request: TransportRequest| {
        let response = transport_receipt.clone();
        async move { Ok(response) }
    };
    let search = search_with_transport(
        "formal methods",
        "wikipedia",
        1,
        "test",
        "2026-08-03T00:00:00Z",
        &transport,
    );
    drop(search);
}
