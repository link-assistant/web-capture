//! Capture once, then replay exact bytes without network access.
use std::collections::BTreeMap;
use web_capture::{
    CacheMode, CacheOptions, CachedTransport, CaptureStore, ReqwestTransport, TransportRequest,
};

#[tokio::main]
async fn main() -> Result<(), web_capture::TransportError> {
    let store = CaptureStore::new(".captures");
    let request = TransportRequest {
        url: "https://example.com".into(),
        method: "GET".into(),
        headers: BTreeMap::new(),
    };
    let online = CachedTransport::new(
        ReqwestTransport::default(),
        store.clone(),
        CacheOptions::default(),
    );
    let first = online.capture(request.clone()).await?;
    let offline = CachedTransport::new(
        ReqwestTransport::default(),
        store.clone(),
        CacheOptions {
            mode: CacheMode::Offline,
            ..CacheOptions::default()
        },
    );
    let replay = offline.capture(request.clone()).await?;
    assert_eq!(first.receipt, replay.receipt);
    println!(
        "sha256={} cached={} stale={}",
        replay.sha256, replay.cached, replay.stale
    );
    println!("{} captures", store.list()?.len());
    std::fs::write("capture-replay.json", store.export(&request)?).expect("write replay fixture");
    Ok(())
}
