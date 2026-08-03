//! Caller-owned HTTP transport and exact-byte response receipts.

use std::{collections::BTreeMap, future::Future, pin::Pin};

use serde::{Deserialize, Serialize};

/// Headers retained in portable response receipts.
pub const RECEIPT_HEADERS: [&str; 7] = [
    "cache-control",
    "content-encoding",
    "content-length",
    "content-type",
    "etag",
    "last-modified",
    "location",
];

/// Owned request passed to an injectable transport.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct TransportRequest {
    pub url: String,
    pub method: String,
    pub headers: BTreeMap<String, String>,
}

/// Structured transport outcome attached to a successful receipt.
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct TransportDiagnostics {
    pub outcome: String,
}

impl TransportDiagnostics {
    #[must_use]
    pub fn response() -> Self {
        Self {
            outcome: "response".to_string(),
        }
    }
}

/// Undecoded response bytes and provenance metadata.
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct ResponseReceipt {
    pub body: Vec<u8>,
    pub final_url: String,
    pub status: u16,
    pub headers: BTreeMap<String, String>,
    pub diagnostics: TransportDiagnostics,
}

/// Structured failure when no HTTP response receipt exists.
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq, thiserror::Error)]
#[error("{message}")]
#[serde(rename_all = "camelCase")]
pub struct TransportError {
    pub kind: String,
    pub message: String,
    pub source_url: String,
}

pub type TransportFuture<'a> =
    Pin<Box<dyn Future<Output = std::result::Result<ResponseReceipt, TransportError>> + Send + 'a>>;

/// Injectable asynchronous transport.
///
/// Cancellation is explicit through normal Rust future lifetime semantics:
/// dropping the future returned by [`Transport::execute`] cancels the request.
pub trait Transport: Send + Sync {
    fn execute(&self, request: TransportRequest) -> TransportFuture<'_>;
}

impl<F, Fut> Transport for F
where
    F: Fn(TransportRequest) -> Fut + Send + Sync,
    Fut: Future<Output = std::result::Result<ResponseReceipt, TransportError>> + Send + 'static,
{
    fn execute(&self, request: TransportRequest) -> TransportFuture<'_> {
        Box::pin(self(request))
    }
}

/// Default reqwest implementation. Callers may supply an already configured client.
#[cfg(feature = "runtime")]
#[derive(Debug, Clone)]
pub struct ReqwestTransport {
    client: reqwest::Client,
}

#[cfg(feature = "runtime")]
impl ReqwestTransport {
    #[must_use]
    pub const fn new(client: reqwest::Client) -> Self {
        Self { client }
    }
}

#[cfg(feature = "runtime")]
impl Default for ReqwestTransport {
    fn default() -> Self {
        Self::new(reqwest::Client::new())
    }
}

#[cfg(feature = "runtime")]
impl Transport for ReqwestTransport {
    fn execute(&self, request: TransportRequest) -> TransportFuture<'_> {
        Box::pin(async move {
            let method =
                reqwest::Method::from_bytes(request.method.as_bytes()).map_err(|error| {
                    TransportError {
                        kind: "invalid_request".to_string(),
                        message: error.to_string(),
                        source_url: request.url.clone(),
                    }
                })?;
            let mut builder = self.client.request(method, &request.url);
            for (name, value) in &request.headers {
                builder = builder.header(name, value);
            }
            let response = builder.send().await.map_err(|error| TransportError {
                kind: if error.is_timeout() {
                    "timeout"
                } else if error.is_connect() {
                    "connect"
                } else {
                    "transport"
                }
                .to_string(),
                message: error.to_string(),
                source_url: request.url.clone(),
            })?;
            let status = response.status().as_u16();
            let final_url = response.url().to_string();
            let headers = RECEIPT_HEADERS
                .iter()
                .filter_map(|name| {
                    response
                        .headers()
                        .get(*name)
                        .and_then(|value| value.to_str().ok())
                        .map(|value| ((*name).to_string(), value.to_string()))
                })
                .collect();
            let body = response
                .bytes()
                .await
                .map_err(|error| TransportError {
                    kind: "body".to_string(),
                    message: error.to_string(),
                    source_url: request.url,
                })?
                .to_vec();
            Ok(ResponseReceipt {
                body,
                final_url,
                status,
                headers,
                diagnostics: TransportDiagnostics::response(),
            })
        })
    }
}

/// Capture an HTTP response through caller-supplied transport without decoding it.
pub async fn capture_response_with_transport(
    request: TransportRequest,
    transport: &dyn Transport,
) -> std::result::Result<ResponseReceipt, TransportError> {
    transport.execute(request).await
}

/// Capture an HTTP response with the default reqwest transport.
#[cfg(feature = "runtime")]
pub async fn capture_response(
    request: TransportRequest,
) -> std::result::Result<ResponseReceipt, TransportError> {
    capture_response_with_transport(request, &ReqwestTransport::default()).await
}
