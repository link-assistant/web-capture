//! Smoke tests for the FormalAI-facing Rust HTTP/CLI contract (issue #135).
//!
//! These tests assert the same public response shapes as the JavaScript
//! `FormalAI` contract tests, using the compiled Rust binary where practical.

use std::collections::HashMap;
use std::io::{Cursor, Read};
use std::net::TcpListener as StdTcpListener;
use std::path::PathBuf;
use std::process::Stdio;
use std::sync::Arc;

use reqwest::header::{CONTENT_DISPOSITION, CONTENT_TYPE};
use tokio::io::{AsyncReadExt, AsyncWriteExt};
use tokio::process::{Child, Command};
use tokio::sync::oneshot;
use tokio::task::JoinHandle;
use tokio::time::{sleep, Duration, Instant};
use web_capture::search::{
    parse_search_results, SearchDiagnostics, SearchResult, SEARCH_PROVIDERS,
};

const HTML: &str = "<!doctype html><html><head><title>FormalAI fixture</title></head><body><h1>FormalAI Fixture</h1><p>Stable Rust shape.</p></body></html>";
const WIKI_JSON: &str = r#"{"pages":[{"id":1,"key":"Formal_methods","title":"Formal methods","excerpt":"the study of <b>formal</b> methods","description":"rigorous techniques"}]}"#;

#[tokio::test]
async fn formalai_http_text_artifact_shapes() {
    let fixture = FixtureServer::start([
        FixtureResponse::new("/page", 200, "text/html; charset=utf-8", HTML),
        FixtureResponse::new(
            "/text",
            200,
            "text/plain; charset=utf-8",
            "FormalAI plain text",
        ),
        FixtureResponse::new("/markdown", 200, "text/html; charset=utf-8", HTML),
    ])
    .await;
    let web_capture = WebCaptureServer::start().await;
    let client = reqwest::Client::new();

    let html = client
        .get(web_capture.endpoint("/html"))
        .query(&[("url", fixture.url("/page"))])
        .send()
        .await
        .expect("request /html");
    assert_eq!(html.status(), 200);
    assert_header_contains(&html, CONTENT_TYPE.as_str(), "text/html");
    let html_body = html.text().await.expect("read /html body");
    assert!(html_body.contains("<h1>FormalAI Fixture</h1>"));

    let text = client
        .get(web_capture.endpoint("/txt"))
        .query(&[("url", fixture.url("/text"))])
        .send()
        .await
        .expect("request /txt");
    assert_eq!(text.status(), 200);
    assert_header_contains(&text, CONTENT_TYPE.as_str(), "text/plain");
    assert_header_contains(&text, CONTENT_DISPOSITION.as_str(), ".txt");
    assert_eq!(
        text.text().await.expect("read /txt body"),
        "FormalAI plain text"
    );

    let markdown = client
        .get(web_capture.endpoint("/markdown"))
        .query(&[("url", fixture.url("/markdown"))])
        .send()
        .await
        .expect("request /markdown");
    assert_eq!(markdown.status(), 200);
    assert_header_contains(&markdown, CONTENT_TYPE.as_str(), "text/markdown");
    let markdown_body = markdown.text().await.expect("read /markdown body");
    assert!(markdown_body.contains("FormalAI Fixture"));
    assert!(markdown_body.contains("Stable Rust shape."));

    web_capture.shutdown().await;
    fixture.shutdown().await;
}

#[tokio::test]
async fn formalai_http_proxy_and_archive_shapes() {
    let fixture = FixtureServer::start([
        FixtureResponse::new(
            "/fetch-source",
            203,
            "text/plain; charset=utf-8",
            "fetch body",
        ),
        FixtureResponse::new(
            "/stream-source",
            206,
            "text/plain; charset=utf-8",
            "stream body",
        ),
        FixtureResponse::new("/archive", 200, "text/html; charset=utf-8", HTML),
    ])
    .await;
    let web_capture = WebCaptureServer::start().await;
    let client = reqwest::Client::new();

    let fetched = client
        .get(web_capture.endpoint("/fetch"))
        .query(&[("url", fixture.url("/fetch-source"))])
        .send()
        .await
        .expect("request /fetch");
    assert_eq!(fetched.status(), 203);
    assert_header_contains(&fetched, CONTENT_TYPE.as_str(), "text/plain");
    assert_eq!(
        fetched.text().await.expect("read /fetch body"),
        "fetch body"
    );

    let streamed = client
        .get(web_capture.endpoint("/stream"))
        .query(&[("url", fixture.url("/stream-source"))])
        .send()
        .await
        .expect("request /stream");
    assert_eq!(streamed.status(), 206);
    assert_header_contains(&streamed, CONTENT_TYPE.as_str(), "text/plain");
    assert_eq!(
        streamed.text().await.expect("read /stream body"),
        "stream body"
    );

    let archive = client
        .get(web_capture.endpoint("/archive"))
        .query(&[("url", fixture.url("/archive"))])
        .send()
        .await
        .expect("request /archive");
    assert_eq!(archive.status(), 200);
    assert_header_contains(&archive, CONTENT_TYPE.as_str(), "application/zip");
    let bytes = archive.bytes().await.expect("read /archive body");
    assert_eq!(&bytes[..2], b"PK");
    assert_zip_entries(bytes.as_ref(), &["document.md", "document.html"]);

    web_capture.shutdown().await;
    fixture.shutdown().await;
}

#[tokio::test]
async fn formalai_http_image_shape_when_browser_is_available() {
    if !chrome_available() {
        eprintln!(
            "Skipping FormalAI /image contract test because Chrome/Chromium is not installed"
        );
        return;
    }

    let fixture = FixtureServer::start([FixtureResponse::new(
        "/image",
        200,
        "text/html; charset=utf-8",
        HTML,
    )])
    .await;
    let web_capture = WebCaptureServer::start().await;
    let client = reqwest::Client::new();

    let image = client
        .get(web_capture.endpoint("/image"))
        .query(&[("url", fixture.url("/image"))])
        .send()
        .await
        .expect("request /image");
    assert_eq!(image.status(), 200);
    assert_header_contains(&image, CONTENT_TYPE.as_str(), "image/png");
    let bytes = image.bytes().await.expect("read /image body");
    assert_eq!(&bytes[..8], b"\x89PNG\r\n\x1a\n");

    web_capture.shutdown().await;
    fixture.shutdown().await;
}

#[tokio::test]
async fn formalai_cli_text_and_archive_shapes() {
    let fixture = FixtureServer::start([FixtureResponse::new(
        "/capture",
        200,
        "text/html; charset=utf-8",
        HTML,
    )])
    .await;

    let html = run_cli(&[
        &fixture.url("/capture"),
        "--capture",
        "api",
        "--format",
        "html",
        "--output",
        "-",
    ])
    .await;
    assert!(html.status.success(), "HTML CLI failed: {}", html.stderr);
    assert!(html.stdout.contains("<h1>FormalAI Fixture</h1>"));

    let markdown = run_cli(&[
        &fixture.url("/capture"),
        "--capture",
        "api",
        "--format",
        "markdown",
        "--output",
        "-",
    ])
    .await;
    assert!(
        markdown.status.success(),
        "Markdown CLI failed: {}",
        markdown.stderr
    );
    assert!(markdown.stdout.contains("FormalAI Fixture"));
    assert!(markdown.stdout.contains("Stable Rust shape."));

    let text = run_cli(&[&fixture.url("/capture"), "--format", "txt", "--output", "-"]).await;
    assert!(text.status.success(), "text CLI failed: {}", text.stderr);
    assert!(text.stdout.contains("FormalAI Fixture"));

    let archive = run_cli_bytes(&[
        &fixture.url("/capture"),
        "--capture",
        "api",
        "--archive",
        "zip",
        "--output",
        "-",
    ])
    .await;
    assert!(
        archive.status.success(),
        "archive CLI failed: {}",
        archive.stderr
    );
    assert_eq!(&archive.stdout[..2], b"PK");
    assert_zip_entries(&archive.stdout, &["document.md", "document.html"]);

    fixture.shutdown().await;
}

#[test]
fn formalai_search_json_contract_shape() {
    assert_eq!(
        SEARCH_PROVIDERS,
        ["wikipedia", "duckduckgo", "google", "bing", "brave"]
    );

    let (results, blocked) = parse_search_results("wikipedia", WIKI_JSON, 1);
    assert!(!blocked);
    assert_eq!(results.len(), 1);

    let result = SearchResult {
        query: "formal-ai".to_string(),
        provider: "wikipedia".to_string(),
        capture_mode: "fetch".to_string(),
        captured_at: "2026-05-18T20:30:00Z".to_string(),
        results,
        diagnostics: SearchDiagnostics {
            status: 200,
            blocked_by_cors: false,
            blocked_by_captcha: false,
            source_url: "https://en.wikipedia.org/w/rest.php/v1/search/page?q=formal-ai&limit=1"
                .to_string(),
            error: None,
        },
    };

    let value = serde_json::to_value(result).expect("serialize search result");
    assert_eq!(value["query"], "formal-ai");
    assert_eq!(value["provider"], "wikipedia");
    assert_eq!(value["captureMode"], "fetch");
    assert_eq!(value["results"][0]["rank"], 1);
    assert_eq!(value["results"][0]["title"], "Formal methods");
    assert_eq!(
        value["results"][0]["url"],
        "https://en.wikipedia.org/wiki/Formal_methods"
    );
    assert_eq!(
        value["results"][0]["snippet"],
        "the study of formal methods"
    );
    assert_eq!(value["diagnostics"]["status"], 200);
    assert_eq!(value["diagnostics"]["blockedByCors"], false);
    assert_eq!(value["diagnostics"]["blockedByCaptcha"], false);
    assert!(value["diagnostics"]["sourceUrl"]
        .as_str()
        .expect("sourceUrl")
        .contains("en.wikipedia.org"));
}

#[test]
fn formalai_search_failure_diagnostics_shape() {
    let result = SearchResult {
        query: "formal-ai".to_string(),
        provider: "wikipedia".to_string(),
        capture_mode: "fetch".to_string(),
        captured_at: "2026-05-18T20:30:00Z".to_string(),
        results: Vec::new(),
        diagnostics: SearchDiagnostics {
            status: 0,
            blocked_by_cors: false,
            blocked_by_captcha: false,
            source_url: "https://en.wikipedia.org/w/rest.php/v1/search/page?q=formal-ai&limit=1"
                .to_string(),
            error: Some("provider offline".to_string()),
        },
    };

    let value = serde_json::to_value(result).expect("serialize search result");
    assert_eq!(value["results"].as_array().expect("results").len(), 0);
    assert_eq!(value["diagnostics"]["status"], 0);
    assert_eq!(value["diagnostics"]["blockedByCors"], false);
    assert_eq!(value["diagnostics"]["blockedByCaptcha"], false);
    assert_eq!(value["diagnostics"]["error"], "provider offline");
}

struct CliTextOutput {
    status: std::process::ExitStatus,
    stdout: String,
    stderr: String,
}

struct CliBytesOutput {
    status: std::process::ExitStatus,
    stdout: Vec<u8>,
    stderr: String,
}

async fn run_cli(args: &[&str]) -> CliTextOutput {
    let output = Command::new(web_capture_binary())
        .args(args)
        .env_remove("RUST_LOG")
        .output()
        .await
        .expect("run web-capture CLI");

    CliTextOutput {
        status: output.status,
        stdout: String::from_utf8(output.stdout).expect("CLI stdout should be UTF-8"),
        stderr: String::from_utf8_lossy(&output.stderr).into_owned(),
    }
}

async fn run_cli_bytes(args: &[&str]) -> CliBytesOutput {
    let output = Command::new(web_capture_binary())
        .args(args)
        .env_remove("RUST_LOG")
        .output()
        .await
        .expect("run web-capture CLI");

    CliBytesOutput {
        status: output.status,
        stdout: output.stdout,
        stderr: String::from_utf8_lossy(&output.stderr).into_owned(),
    }
}

fn assert_header_contains(response: &reqwest::Response, name: &str, expected: &str) {
    let value = response
        .headers()
        .get(name)
        .unwrap_or_else(|| panic!("missing {name} header"))
        .to_str()
        .unwrap_or_else(|error| panic!("invalid {name} header: {error}"));
    assert!(
        value.contains(expected),
        "expected {name} header to contain {expected:?}, got {value:?}"
    );
}

fn assert_zip_entries(bytes: &[u8], expected_entries: &[&str]) {
    let mut zip = zip::ZipArchive::new(Cursor::new(bytes)).expect("open ZIP");
    let names = (0..zip.len())
        .map(|index| {
            zip.by_index(index)
                .expect("read ZIP entry")
                .name()
                .to_string()
        })
        .collect::<Vec<_>>();

    for expected in expected_entries {
        assert!(
            names.iter().any(|name| name == expected),
            "expected ZIP entry {expected:?}, got {names:?}"
        );
    }

    let mut markdown = String::new();
    zip.by_name("document.md")
        .expect("document.md entry")
        .read_to_string(&mut markdown)
        .expect("read document.md");
    assert!(markdown.contains("FormalAI Fixture"));
}

fn web_capture_binary() -> PathBuf {
    if let Some(path) = std::env::var_os("CARGO_BIN_EXE_web-capture") {
        return PathBuf::from(path);
    }

    let mut path = std::env::current_exe().expect("current test executable");
    path.pop();
    if path.file_name().is_some_and(|name| name == "deps") {
        path.pop();
    }
    path.push(if cfg!(windows) {
        "web-capture.exe"
    } else {
        "web-capture"
    });
    path
}

fn chrome_available() -> bool {
    std::env::var_os("WEB_CAPTURE_CHROME_PATH").is_some()
        || [
            "google-chrome",
            "google-chrome-stable",
            "chromium",
            "chromium-browser",
            "chrome",
        ]
        .iter()
        .any(|candidate| {
            std::process::Command::new(candidate)
                .arg("--version")
                .output()
                .is_ok()
        })
}

struct WebCaptureServer {
    base_url: String,
    child: Option<Child>,
}

impl WebCaptureServer {
    async fn start() -> Self {
        let port = unused_port();
        let mut child = Command::new(web_capture_binary())
            .arg("--serve")
            .arg("--port")
            .arg(port.to_string())
            .env("RUST_LOG", "error")
            .stdout(Stdio::null())
            .stderr(Stdio::null())
            .spawn()
            .expect("start web-capture server");
        let base_url = format!("http://127.0.0.1:{port}");
        let client = reqwest::Client::new();
        let deadline = Instant::now() + Duration::from_secs(10);

        loop {
            if let Some(status) = child.try_wait().expect("poll web-capture server") {
                panic!("web-capture server exited before becoming ready: {status}");
            }

            if client
                .get(format!("{base_url}/search"))
                .send()
                .await
                .is_ok()
            {
                break;
            }

            assert!(
                Instant::now() < deadline,
                "web-capture server did not become ready"
            );
            sleep(Duration::from_millis(50)).await;
        }

        Self {
            base_url,
            child: Some(child),
        }
    }

    fn endpoint(&self, path: &str) -> String {
        format!("{}{}", self.base_url, path)
    }

    async fn shutdown(mut self) {
        if let Some(mut child) = self.child.take() {
            let _ = child.start_kill();
            let _ = child.wait().await;
        }
    }
}

impl Drop for WebCaptureServer {
    fn drop(&mut self) {
        if let Some(child) = &mut self.child {
            let _ = child.start_kill();
        }
    }
}

fn unused_port() -> u16 {
    let listener = StdTcpListener::bind("127.0.0.1:0").expect("bind ephemeral port");
    listener.local_addr().expect("read local addr").port()
}

#[derive(Clone)]
struct FixtureResponse {
    path: String,
    status: u16,
    content_type: String,
    body: Vec<u8>,
}

impl FixtureResponse {
    fn new(path: &str, status: u16, content_type: &str, body: impl AsRef<[u8]>) -> Self {
        Self {
            path: path.to_string(),
            status,
            content_type: content_type.to_string(),
            body: body.as_ref().to_vec(),
        }
    }
}

struct FixtureServer {
    base_url: String,
    shutdown: Option<oneshot::Sender<()>>,
    handle: Option<JoinHandle<()>>,
}

impl FixtureServer {
    async fn start<const N: usize>(responses: [FixtureResponse; N]) -> Self {
        let responses = Arc::new(
            responses
                .into_iter()
                .map(|response| (response.path.clone(), response))
                .collect::<HashMap<_, _>>(),
        );
        let listener = tokio::net::TcpListener::bind("127.0.0.1:0")
            .await
            .expect("bind fixture server");
        let addr = listener.local_addr().expect("fixture local addr");
        let (shutdown, mut shutdown_rx) = oneshot::channel::<()>();
        let handle = tokio::spawn(async move {
            loop {
                tokio::select! {
                    _ = &mut shutdown_rx => break,
                    accepted = listener.accept() => {
                        let Ok((mut stream, _)) = accepted else {
                            break;
                        };
                        let responses = Arc::clone(&responses);
                        tokio::spawn(async move {
                            let mut request = [0_u8; 2048];
                            let Ok(size) = stream.read(&mut request).await else {
                                return;
                            };
                            let request = String::from_utf8_lossy(&request[..size]);
                            let target = request
                                .lines()
                                .next()
                                .and_then(|line| line.split_whitespace().nth(1))
                                .unwrap_or("/");
                            let path = target.split('?').next().unwrap_or(target);
                            let response = responses.get(path).cloned().unwrap_or_else(|| {
                                FixtureResponse::new(path, 404, "text/plain; charset=utf-8", "not found")
                            });
                            let header = format!(
                                "HTTP/1.1 {} OK\r\nContent-Type: {}\r\nContent-Length: {}\r\nConnection: close\r\n\r\n",
                                response.status,
                                response.content_type,
                                response.body.len()
                            );
                            let _ = stream.write_all(header.as_bytes()).await;
                            let _ = stream.write_all(&response.body).await;
                        });
                    }
                }
            }
        });

        Self {
            base_url: format!("http://{addr}"),
            shutdown: Some(shutdown),
            handle: Some(handle),
        }
    }

    fn url(&self, path: &str) -> String {
        format!("{}{}", self.base_url, path)
    }

    async fn shutdown(mut self) {
        if let Some(shutdown) = self.shutdown.take() {
            let _ = shutdown.send(());
        }
        if let Some(handle) = self.handle.take() {
            let _ = handle.await;
        }
    }
}

impl Drop for FixtureServer {
    fn drop(&mut self) {
        if let Some(shutdown) = self.shutdown.take() {
            let _ = shutdown.send(());
        }
    }
}
