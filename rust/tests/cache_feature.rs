use std::{
    collections::BTreeMap,
    sync::atomic::{AtomicUsize, Ordering},
    time::Duration,
};
use web_capture::{
    CacheMode, CacheOptions, CachedTransport, CaptureStore, ResponseReceipt, Transport,
    TransportDiagnostics, TransportRequest,
};

fn request() -> TransportRequest {
    TransportRequest {
        url: "https://example.test/source".into(),
        method: "GET".into(),
        headers: BTreeMap::from([("accept".into(), "application/octet-stream".into())]),
    }
}
fn receipt() -> ResponseReceipt {
    ResponseReceipt {
        body: vec![0, 255, 65],
        final_url: "https://example.test/final".into(),
        status: 206,
        headers: BTreeMap::from([("etag".into(), "v1".into())]),
        diagnostics: TransportDiagnostics::response(),
    }
}
const fn now() -> u64 {
    1000
}

#[tokio::test]
async fn exact_receipts_offline_stale_refresh_and_prune() {
    let directory = tempfile::tempdir().unwrap();
    let calls = AtomicUsize::new(0);
    let inner = |_: TransportRequest| {
        calls.fetch_add(1, Ordering::SeqCst);
        async { Ok(receipt()) }
    };
    let options = CacheOptions {
        ttl: Duration::from_millis(100),
        mode: CacheMode::Online,
        now,
    };
    let store = CaptureStore::new(directory.path());
    let online = CachedTransport::new(inner, store.clone(), options);
    let first = online.capture(request()).await.unwrap();
    assert!(!first.cached);
    assert_eq!(first.receipt, receipt());
    assert_eq!(online.execute(request()).await.unwrap(), receipt());
    assert_eq!(calls.load(Ordering::SeqCst), 1);
    let offline = CachedTransport::new(
        |_: TransportRequest| async { panic!("offline network access") },
        store.clone(),
        CacheOptions {
            mode: CacheMode::Offline,
            ..options
        },
    );
    let replay = offline.capture(request()).await.unwrap();
    assert!(replay.cached);
    assert!(!replay.stale);
    assert_eq!(replay.receipt, first.receipt);
    store.store(&request(), &receipt(), 800).unwrap();
    assert!(offline.capture(request()).await.unwrap().stale);
    assert!(!online.capture(request()).await.unwrap().stale);
    assert_eq!(calls.load(Ordering::SeqCst), 2);
    assert_eq!(store.list().unwrap().len(), 1);
    let portable = store.export(&request()).unwrap();
    let other = tempfile::tempdir().unwrap();
    let other_store = CaptureStore::new(other.path());
    other_store.import(&portable).unwrap();
    assert_eq!(
        other_store.load(&request()).unwrap().unwrap().receipt,
        receipt()
    );
    assert_eq!(store.prune(1100, options.ttl).unwrap(), 1);
    assert_eq!(
        store.list().unwrap(),
        Vec::<web_capture::CaptureRecord>::new()
    );
    let error = offline.capture(request()).await.unwrap_err();
    assert_eq!(error.kind, "offline_cache_miss");
}

#[tokio::test]
async fn shared_fixture_integrity_request_isolation_and_errors() {
    let directory = tempfile::tempdir().unwrap();
    let store = CaptureStore::new(directory.path());
    let fixture = include_str!("fixtures/capture-v1.json");
    store.import(fixture).unwrap();
    assert_eq!(store.load(&request()).unwrap().unwrap().receipt, receipt());
    let mut different = request();
    different
        .headers
        .insert("authorization".into(), "different".into());
    assert!(store.load(&different).unwrap().is_none());
    different = request();
    different.method = "POST".into();
    assert!(store.load(&different).unwrap().is_none());
    different = request();
    different.url.push_str("?query=1");
    assert!(store.load(&different).unwrap().is_none());
    let corrupt = fixture.replace("255", "254");
    assert!(store.import(&corrupt).is_err());
    let wrong_version = fixture.replace("\"version\": 1", "\"version\": 999");
    assert!(store.import(&wrong_version).is_err());
    let entry = store.list().unwrap().remove(0);
    std::fs::write(
        directory.path().join("bodies").join(entry.sha256),
        b"corrupt",
    )
    .unwrap();
    assert!(store.load(&request()).is_err());
    let failing = CachedTransport::new(
        |req: TransportRequest| async move {
            Err(web_capture::TransportError {
                kind: "connect".into(),
                message: "failed".into(),
                source_url: req.url,
            })
        },
        store.clone(),
        CacheOptions {
            now,
            ..CacheOptions::default()
        },
    );
    assert_eq!(failing.capture(request()).await.unwrap_err().kind, "cache");
}

#[tokio::test]
async fn failed_refresh_retains_stale_capture_and_shared_bodies_survive_pruning() {
    let directory = tempfile::tempdir().unwrap();
    let store = CaptureStore::new(directory.path());
    store.store(&request(), &receipt(), 800).unwrap();
    let mut other = request();
    other.url.push_str("/other");
    store.store(&other, &receipt(), 2000).unwrap();
    assert_eq!(
        std::fs::read_dir(directory.path().join("bodies"))
            .unwrap()
            .count(),
        1
    );
    let options = CacheOptions {
        ttl: Duration::from_millis(100),
        now,
        ..CacheOptions::default()
    };
    let failing = CachedTransport::new(
        |req: TransportRequest| async move {
            Err(web_capture::TransportError {
                kind: "connect".into(),
                message: "failed".into(),
                source_url: req.url,
            })
        },
        store.clone(),
        options,
    );
    assert_eq!(
        failing.capture(request()).await.unwrap_err().kind,
        "connect"
    );
    let offline = CachedTransport::new(
        |_: TransportRequest| async { panic!("offline network access") },
        store.clone(),
        CacheOptions {
            mode: CacheMode::Offline,
            ..options
        },
    );
    assert!(offline.capture(request()).await.unwrap().stale);
    assert_eq!(store.prune(1000, options.ttl).unwrap(), 1);
    assert_eq!(store.load(&other).unwrap().unwrap().receipt, receipt());
}
