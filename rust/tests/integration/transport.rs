use std::{
    collections::BTreeMap,
    sync::{
        Arc,
        atomic::{AtomicBool, Ordering},
    },
};

use web_capture::{
    ResponseReceipt, TransportDiagnostics, TransportRequest, fetch_html_receipt_with_transport,
};

#[tokio::test]
async fn html_receipt_preserves_exact_bytes_and_metadata() {
    let transport = |request: TransportRequest| async move {
        assert_eq!(request.url, "https://example.com/bytes");
        Ok(ResponseReceipt {
            body: vec![0x00, 0xff, 0x41],
            final_url: "https://example.com/final".into(),
            status: 206,
            headers: BTreeMap::from([
                ("content-type".into(), "application/octet-stream".into()),
                ("etag".into(), "v1".into()),
            ]),
            diagnostics: TransportDiagnostics::response(),
        })
    };

    let receipt = fetch_html_receipt_with_transport("https://example.com/bytes", &transport)
        .await
        .unwrap();

    assert_eq!(receipt.body, [0x00, 0xff, 0x41]);
    assert_eq!(receipt.final_url, "https://example.com/final");
    assert_eq!(receipt.status, 206);
    assert_eq!(receipt.headers["etag"], "v1");
}

#[tokio::test]
async fn dropping_capture_future_cancels_injected_transport() {
    struct DropSignal(Arc<AtomicBool>);
    impl Drop for DropSignal {
        fn drop(&mut self) {
            self.0.store(true, Ordering::SeqCst);
        }
    }

    let cancelled = Arc::new(AtomicBool::new(false));
    let transport_cancelled = Arc::clone(&cancelled);
    let transport = move |_request: TransportRequest| {
        let signal = DropSignal(Arc::clone(&transport_cancelled));
        async move {
            let _signal = signal;
            std::future::pending::<Result<ResponseReceipt, web_capture::TransportError>>().await
        }
    };

    {
        let capture = fetch_html_receipt_with_transport("https://example.com/pending", &transport);
        tokio::pin!(capture);
        tokio::select! {
            result = &mut capture => panic!("pending transport unexpectedly completed: {result:?}"),
            () = tokio::task::yield_now() => {}
        }
    }

    assert!(cancelled.load(Ordering::SeqCst));
}

// reqwest's Display stops at "error sending request for url (...)"; the
// reason a caller can act on lives in the source chain (#177, matching the
// JS transport's "fetch failed: <cause>" message).
#[tokio::test]
async fn connect_failures_report_the_underlying_cause() {
    let port = std::net::TcpListener::bind("127.0.0.1:0")
        .unwrap()
        .local_addr()
        .unwrap()
        .port();
    let url = format!("http://127.0.0.1:{port}/");

    let error = web_capture::capture_response(TransportRequest {
        url: url.clone(),
        method: "GET".into(),
        headers: BTreeMap::new(),
    })
    .await
    .unwrap_err();

    assert_eq!(error.kind, "connect");
    assert_eq!(error.source_url, url);
    assert!(
        error.message.starts_with("error sending request for url"),
        "{}",
        error.message
    );
    assert!(
        error.message.contains("tcp connect error"),
        "message lost the cause: {}",
        error.message
    );
}
