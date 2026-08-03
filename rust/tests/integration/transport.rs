use std::{
    collections::BTreeMap,
    sync::{
        atomic::{AtomicBool, Ordering},
        Arc,
    },
};

use web_capture::{
    fetch_html_receipt_with_transport, ResponseReceipt, TransportDiagnostics, TransportRequest,
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
