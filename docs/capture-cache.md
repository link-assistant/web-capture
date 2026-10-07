# Exact-byte capture caching

The cache decorates any transport; HTTP fetching, search capture and downstream custom clients can pass it through existing transport injection APIs. It does not impose a client, a parser or browser automation.

## JavaScript

```js
import { CachedTransport, CaptureStore } from "@link-assistant/web-capture";
import { fetchTransport } from "@link-assistant/web-capture/src/transport.js";

const store = new CaptureStore("./captures");
const online = new CachedTransport(fetchTransport, store, { ttl: 86400000 });
const request = { url: "https://example.com", method: "GET", headers: {} };
const first = await online.capture(request);
const offline = new CachedTransport(fetchTransport, store, { offline: true });
const replay = await offline.capture(request);
console.log(replay.cached, replay.stale, replay.sha256);
// Existing capture/search functions accept { transport: online.execute }.
```

## Rust

```rust,no_run
use web_capture::{CacheMode, CacheOptions, CachedTransport, CaptureStore,
    ReqwestTransport, TransportRequest};
use std::collections::BTreeMap;

# async fn example() -> Result<(), web_capture::TransportError> {
let store = CaptureStore::new("./captures");
let online = CachedTransport::new(ReqwestTransport::default(), store.clone(), CacheOptions::default());
let request = TransportRequest { url: "https://example.com".into(), method: "GET".into(), headers: BTreeMap::new() };
let first = online.capture(request.clone()).await?;
let offline = CachedTransport::new(ReqwestTransport::default(), store,
    CacheOptions { mode: CacheMode::Offline, ..CacheOptions::default() });
let replay = offline.capture(request).await?;
assert_eq!(first.receipt, replay.receipt);
# Ok(())
# }
```

`web-capture = { version = "0.4", default-features = false, features = ["cache"] }` selects only transport/serialization types, SHA-256 and filesystem helpers. Supply your own transport and executor. It selects no HTML parser, HTTP client or browser. The existing `search` feature retains its dependency boundary. Default `runtime` includes search, the cache and the reqwest convenience transport.

## Version 1 format

```
captures/
  requests/<request SHA-256>.json
  bodies/<body SHA-256>
```

A record stores `version`, `requestKey`, `request`, `fetchedAt`, `sha256`, and `receipt`. On disk the receipt's body is empty and loaded from the body file. Exported replay JSON contains the exact body as an array of integers from 0 through 255. SHA-256 is verified on reads and imports. Request addressing hashes UTF-8 JSON `[1, url, method, sorted header pairs]`, sorting header names by their UTF-8 bytes, preserving exact strings and excluding cancellation signals. Headers must be string pairs. URL query strings, request methods, and authorization headers remain distinct; only header insertion order is ignored.

See the [shared binary fixture](../rust/tests/fixtures/capture-v1.json) and [Unicode header fixture](../rust/tests/fixtures/capture-v1-unicode.json), consumed by both implementations' automated tests. Fixtures may be committed for deterministic offline tests. A capture retains potentially private request headers and response bytes; use an application-owned directory. New files are created with restrictive permissions on Unix. Writes use temporary files and atomic replacement so readers do not observe partial records.

Rust serializes disk operations across processes using a file lock. JavaScript serializes operations within the process; run pruning while other processes using that directory are idle. Rust disk operations are synchronous and can be run on an application's blocking worker if needed. Online requests execute outside the disk lock, so simultaneous misses may each fetch; storage remains content addressed. The TTL is application policy rather than an HTTP `Cache-Control` implementation. No background eviction or network fallback occurs in offline mode.

A zero TTL makes every entry expired. Future timestamps are treated as age zero. Failed refetches return the transport error and leave the previous capture available for explicit offline replay. Pruning removes records and unused bodies; exported fixtures remain independent of a pruned cache directory.
