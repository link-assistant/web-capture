use web_capture::BrowserEngine;

#[test]
fn test_browser_engine_display() {
    assert_eq!(BrowserEngine::Chromiumoxide.to_string(), "chromiumoxide");
}

#[test]
fn test_browser_engine_from_str() {
    assert_eq!(
        "chromiumoxide".parse::<BrowserEngine>().unwrap(),
        BrowserEngine::Chromiumoxide
    );
    assert_eq!(
        "chrome".parse::<BrowserEngine>().unwrap(),
        BrowserEngine::Chromiumoxide
    );
    assert!("invalid".parse::<BrowserEngine>().is_err());
}

#[test]
fn test_browser_engine_default() {
    assert_eq!(BrowserEngine::default(), BrowserEngine::Chromiumoxide);
}

#[tokio::test]
async fn test_render_html_executes_page_javascript() {
    if !chrome_available() {
        eprintln!("Skipping browser rendering test because Chrome/Chromium is not installed");
        return;
    }

    let server = TestServer::start(
        r#"<!doctype html>
<html>
  <head><title>Browser render fixture</title></head>
  <body>
    <main id="app">server html</main>
    <script>
      document.body.setAttribute('data-rendered', 'true');
      document.getElementById('app').textContent = 'browser-rendered content';
    </script>
  </body>
</html>"#,
    )
    .await;

    let rendered = web_capture::render_html(&server.url()).await.unwrap();

    assert!(rendered.contains(r#"data-rendered="true""#));
    assert!(rendered.contains(">browser-rendered content<"));

    server.shutdown().await;
}

#[tokio::test]
async fn test_cli_capture_browser_renders_markdown_with_javascript() {
    if !chrome_available() {
        eprintln!("Skipping CLI browser capture test because Chrome/Chromium is not installed");
        return;
    }

    let server = TestServer::start(
        r#"<!doctype html>
<html>
  <body>
    <main id="app">server html</main>
    <script>
      document.getElementById('app').textContent = 'browser-rendered content';
    </script>
  </body>
</html>"#,
    )
    .await;

    let output = tokio::process::Command::new(web_capture_binary())
        .arg(server.url())
        .arg("--capture")
        .arg("browser")
        .arg("--format")
        .arg("markdown")
        .arg("-o")
        .arg("-")
        .env("WEB_CAPTURE_BROWSER_WAIT_MS", "100")
        .output()
        .await
        .unwrap();

    let stderr = String::from_utf8_lossy(&output.stderr);
    assert!(
        output.status.success(),
        "CLI failed with status {:?}: {stderr}",
        output.status.code()
    );
    let stdout = String::from_utf8(output.stdout).unwrap();
    assert!(stdout.contains("browser-rendered content"));
    assert!(!stdout.contains("server html"));

    server.shutdown().await;
}

#[tokio::test]
async fn test_capture_screenshot_returns_png_bytes() {
    if !chrome_available() {
        eprintln!("Skipping browser screenshot test because Chrome/Chromium is not installed");
        return;
    }

    let server = TestServer::start(
        r#"<!doctype html>
<html>
  <body style="margin:0;background:#fff">
    <main style="width:240px;height:120px;background:#0b7">screenshot fixture</main>
  </body>
</html>"#,
    )
    .await;

    let screenshot = web_capture::capture_screenshot(&server.url())
        .await
        .unwrap();

    assert!(screenshot.len() > 8);
    assert_eq!(&screenshot[..8], b"\x89PNG\r\n\x1a\n");

    server.shutdown().await;
}

fn web_capture_binary() -> std::path::PathBuf {
    if let Some(path) = std::env::var_os("CARGO_BIN_EXE_web-capture") {
        return std::path::PathBuf::from(path);
    }

    let mut path = std::env::current_exe().unwrap();
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

struct TestServer {
    url: String,
    shutdown: tokio::sync::oneshot::Sender<()>,
    handle: tokio::task::JoinHandle<()>,
}

impl TestServer {
    async fn start(body: &'static str) -> Self {
        let listener = tokio::net::TcpListener::bind("127.0.0.1:0").await.unwrap();
        let addr = listener.local_addr().unwrap();
        let (shutdown, mut shutdown_rx) = tokio::sync::oneshot::channel::<()>();
        let handle = tokio::spawn(async move {
            loop {
                tokio::select! {
                    _ = &mut shutdown_rx => break,
                    accepted = listener.accept() => {
                        let Ok((mut stream, _)) = accepted else {
                            break;
                        };
                        tokio::spawn(async move {
                            use tokio::io::{AsyncReadExt, AsyncWriteExt};

                            let mut request = [0_u8; 1024];
                            let _ = stream.read(&mut request).await;
                            let response = format!(
                                "HTTP/1.1 200 OK\r\nContent-Type: text/html; charset=utf-8\r\nContent-Length: {}\r\nConnection: close\r\n\r\n{}",
                                body.len(),
                                body
                            );
                            let _ = stream.write_all(response.as_bytes()).await;
                        });
                    }
                }
            }
        });

        Self {
            url: format!("http://{addr}/"),
            shutdown,
            handle,
        }
    }

    fn url(&self) -> String {
        self.url.clone()
    }

    async fn shutdown(self) {
        let _ = self.shutdown.send(());
        let _ = self.handle.await;
    }
}
