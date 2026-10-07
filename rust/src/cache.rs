//! Versioned SHA-256 capture storage and a cache decorator over any transport.
//!
//! Receipts are unchanged; cache provenance is returned separately by `capture`.
//! Disk operations are synchronous and serialized across processes. No HTTP
//! client or async runtime is selected by the opt-in `cache` feature.

use crate::transport::{
    ResponseReceipt, Transport, TransportError, TransportFuture, TransportRequest,
};
use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};
use std::{
    fs::{self, File, OpenOptions},
    io::Write,
    path::{Path, PathBuf},
    time::{Duration, SystemTime, UNIX_EPOCH},
};

const VERSION: u32 = 1;

#[derive(Debug, Clone, Copy, PartialEq, Eq, Default)]
pub enum CacheMode {
    #[default]
    Online,
    /// Never execute the underlying transport; expired captures remain available.
    Offline,
}

#[derive(Debug, Clone, Copy)]
pub struct CacheOptions {
    pub ttl: Duration,
    pub mode: CacheMode,
    /// Unix milliseconds. Injectable for deterministic TTL tests.
    pub now: fn() -> u64,
}
fn now() -> u64 {
    u64::try_from(
        SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .unwrap_or_default()
            .as_millis(),
    )
    .unwrap_or(u64::MAX)
}
impl Default for CacheOptions {
    fn default() -> Self {
        Self {
            ttl: Duration::from_hours(60 * 24),
            mode: CacheMode::Online,
            now,
        }
    }
}

/// On-disk JSON record, also the portable replay format when `receipt.body` is populated.
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct CaptureRecord {
    pub version: u32,
    pub request_key: String,
    pub request: TransportRequest,
    pub fetched_at: u64,
    pub sha256: String,
    pub receipt: ResponseReceipt,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct CachedCapture {
    pub receipt: ResponseReceipt,
    pub request_key: String,
    pub fetched_at: u64,
    pub sha256: String,
    pub cached: bool,
    pub stale: bool,
}

fn hash(bytes: &[u8]) -> String {
    Sha256::digest(bytes)
        .iter()
        .fold(String::with_capacity(64), |mut output, byte| {
            use std::fmt::Write as _;
            write!(output, "{byte:02x}").expect("writing to a string cannot fail");
            output
        })
}
fn valid_hash(value: &str) -> bool {
    value.len() == 64
        && value
            .bytes()
            .all(|byte| byte.is_ascii_digit() || (b'a'..=b'f').contains(&byte))
}
fn error(message: impl std::fmt::Display, url: &str) -> TransportError {
    TransportError {
        kind: "cache".into(),
        message: message.to_string(),
        source_url: url.into(),
    }
}
fn expired(fetched_at: u64, current: u64, ttl: Duration) -> bool {
    u128::from(current.saturating_sub(fetched_at)) >= ttl.as_millis()
}

/// Request key includes the exact URL, method and all request headers in sorted order.
#[must_use]
pub fn request_key(request: &TransportRequest) -> String {
    let headers: Vec<_> = request.headers.iter().collect();
    hash(
        &serde_json::to_vec(&(VERSION, &request.url, &request.method, headers))
            .expect("request contains only strings"),
    )
}

#[derive(Debug, Clone)]
pub struct CaptureStore {
    directory: PathBuf,
}

impl CaptureStore {
    #[must_use]
    pub fn new(directory: impl Into<PathBuf>) -> Self {
        Self {
            directory: directory.into(),
        }
    }

    fn lock(&self) -> Result<File, TransportError> {
        let mut builder = fs::DirBuilder::new();
        builder.recursive(true);
        #[cfg(unix)]
        {
            use std::os::unix::fs::DirBuilderExt;
            builder.mode(0o700);
        }
        builder.create(&self.directory).map_err(|e| error(e, ""))?;
        let mut options = OpenOptions::new();
        options.read(true).write(true).create(true).truncate(false);
        #[cfg(unix)]
        {
            use std::os::unix::fs::OpenOptionsExt;
            options.mode(0o600);
        }
        let file = options
            .open(self.directory.join(".lock"))
            .map_err(|e| error(e, ""))?;
        file.lock().map_err(|e| error(e, ""))?;
        Ok(file)
    }
    fn record_path(&self, key: &str) -> PathBuf {
        self.directory.join("requests").join(format!("{key}.json"))
    }
    fn body_path(&self, sha256: &str) -> PathBuf {
        self.directory.join("bodies").join(sha256)
    }

    fn validate(record: &CaptureRecord) -> Result<(), TransportError> {
        if record.version != VERSION
            || !valid_hash(&record.sha256)
            || record.request_key != request_key(&record.request)
        {
            return Err(error(
                "Unsupported or invalid capture record",
                &record.request.url,
            ));
        }
        Ok(())
    }
    fn parse_record(bytes: &[u8]) -> Result<CaptureRecord, TransportError> {
        let record: CaptureRecord = serde_json::from_slice(bytes).map_err(|e| error(e, ""))?;
        Self::validate(&record)?;
        Ok(record)
    }
    fn read_record(path: &Path) -> Result<CaptureRecord, TransportError> {
        Self::parse_record(&fs::read(path).map_err(|e| error(e, ""))?)
    }
    fn read(&self, request: &TransportRequest) -> Result<Option<CaptureRecord>, TransportError> {
        let path = self.record_path(&request_key(request));
        let bytes = match fs::read(&path) {
            Ok(bytes) => bytes,
            Err(e) if e.kind() == std::io::ErrorKind::NotFound => return Ok(None),
            Err(e) => return Err(error(e, &request.url)),
        };
        let mut record = Self::parse_record(&bytes)?;
        if record.request != *request {
            return Err(error("Request does not match capture", &request.url));
        }
        record.receipt.body =
            fs::read(self.body_path(&record.sha256)).map_err(|e| error(e, &request.url))?;
        if hash(&record.receipt.body) != record.sha256 {
            return Err(error("Capture SHA-256 mismatch", &request.url));
        }
        Ok(Some(record))
    }
    fn capture(record: CaptureRecord) -> CachedCapture {
        CachedCapture {
            receipt: record.receipt,
            request_key: record.request_key,
            fetched_at: record.fetched_at,
            sha256: record.sha256,
            cached: true,
            stale: false,
        }
    }
    pub fn load(
        &self,
        request: &TransportRequest,
    ) -> Result<Option<CachedCapture>, TransportError> {
        let _lock = self.lock()?;
        Ok(self.read(request)?.map(Self::capture))
    }
    fn atomic_write(path: &Path, bytes: &[u8]) -> Result<(), TransportError> {
        let parent = path.parent().expect("cache paths have a parent");
        fs::create_dir_all(parent).map_err(|e| error(e, ""))?;
        let mut file = tempfile::NamedTempFile::new_in(parent).map_err(|e| error(e, ""))?;
        file.write_all(bytes).map_err(|e| error(e, ""))?;
        file.as_file().sync_all().map_err(|e| error(e, ""))?;
        file.persist(path).map_err(|e| error(e, ""))?;
        Ok(())
    }
    pub fn store(
        &self,
        request: &TransportRequest,
        receipt: &ResponseReceipt,
        fetched_at: u64,
    ) -> Result<CachedCapture, TransportError> {
        let _lock = self.lock()?;
        let sha256 = hash(&receipt.body);
        Self::atomic_write(&self.body_path(&sha256), &receipt.body)?;
        let mut record = CaptureRecord {
            version: VERSION,
            request_key: request_key(request),
            request: request.clone(),
            fetched_at,
            sha256,
            receipt: receipt.clone(),
        };
        record.receipt.body.clear();
        Self::atomic_write(
            &self.record_path(&record.request_key),
            &serde_json::to_vec_pretty(&record).map_err(|e| error(e, &request.url))?,
        )?;
        record.receipt = receipt.clone();
        let mut capture = Self::capture(record);
        capture.cached = false;
        Ok(capture)
    }
    pub fn export(&self, request: &TransportRequest) -> Result<String, TransportError> {
        let _lock = self.lock()?;
        let record = self
            .read(request)?
            .ok_or_else(|| error("No capture to export", &request.url))?;
        serde_json::to_string_pretty(&record).map_err(|e| error(e, &request.url))
    }
    pub fn import(&self, replay: &str) -> Result<CachedCapture, TransportError> {
        let record: CaptureRecord = serde_json::from_str(replay).map_err(|e| error(e, ""))?;
        Self::validate(&record)?;
        if hash(&record.receipt.body) != record.sha256 {
            return Err(error("Replay SHA-256 mismatch", &record.request.url));
        }
        self.store(&record.request, &record.receipt, record.fetched_at)
    }
    fn records(&self) -> Result<Vec<CaptureRecord>, TransportError> {
        let directory = self.directory.join("requests");
        if !directory.exists() {
            return Ok(Vec::new());
        }
        let mut result = Vec::new();
        for entry in fs::read_dir(directory).map_err(|e| error(e, ""))? {
            let path = entry.map_err(|e| error(e, ""))?.path();
            if path.extension().is_some_and(|ext| ext == "json") {
                let record = Self::read_record(&path)?;
                if path != self.record_path(&record.request_key) {
                    return Err(error("Capture filename mismatch", &record.request.url));
                }
                result.push(record);
            }
        }
        result.sort_by(|a, b| a.request_key.cmp(&b.request_key));
        Ok(result)
    }
    /// List metadata without reading body files. Sorted by request key.
    pub fn list(&self) -> Result<Vec<CaptureRecord>, TransportError> {
        let _lock = self.lock()?;
        self.records()
    }
    /// Remove expired request records, then bodies not referenced by remaining records.
    pub fn prune(&self, current: u64, ttl: Duration) -> Result<usize, TransportError> {
        let _lock = self.lock()?;
        let records = self.records()?;
        let mut live = std::collections::BTreeSet::new();
        let mut removed = 0;
        for record in records {
            if expired(record.fetched_at, current, ttl) {
                fs::remove_file(self.record_path(&record.request_key)).map_err(|e| error(e, ""))?;
                removed += 1;
            } else {
                live.insert(record.sha256);
            }
        }
        let bodies = self.directory.join("bodies");
        if bodies.exists() {
            for entry in fs::read_dir(bodies).map_err(|e| error(e, ""))? {
                let entry = entry.map_err(|e| error(e, ""))?;
                if !live.contains(&entry.file_name().to_string_lossy().into_owned()) {
                    fs::remove_file(entry.path()).map_err(|e| error(e, ""))?;
                }
            }
        }
        Ok(removed)
    }
}

pub struct CachedTransport<T> {
    inner: T,
    store: CaptureStore,
    options: CacheOptions,
}
impl<T: Transport> CachedTransport<T> {
    #[must_use]
    pub const fn new(inner: T, store: CaptureStore, options: CacheOptions) -> Self {
        Self {
            inner,
            store,
            options,
        }
    }
    pub async fn capture(
        &self,
        request: TransportRequest,
    ) -> Result<CachedCapture, TransportError> {
        if let Some(mut capture) = self.store.load(&request)? {
            capture.stale = expired(capture.fetched_at, (self.options.now)(), self.options.ttl);
            if !capture.stale || self.options.mode == CacheMode::Offline {
                return Ok(capture);
            }
        }
        if self.options.mode == CacheMode::Offline {
            return Err(TransportError {
                kind: "offline_cache_miss".into(),
                message: "No cached capture in offline mode".into(),
                source_url: request.url,
            });
        }
        let receipt = self.inner.execute(request.clone()).await?;
        self.store.store(&request, &receipt, (self.options.now)())
    }
}
impl<T: Transport> Transport for CachedTransport<T> {
    fn execute(&self, request: TransportRequest) -> TransportFuture<'_> {
        Box::pin(async move { self.capture(request).await.map(|capture| capture.receipt) })
    }
}
