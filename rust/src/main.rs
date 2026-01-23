//! web-capture CLI and HTTP server
//!
//! A CLI tool and microservice to render web pages as HTML, Markdown, or PNG.
//!
//! ## Usage
//!
//! ### Server Mode
//! ```bash
//! web-capture --serve --port 3000
//! ```
//!
//! ### Capture Mode
//! ```bash
//! web-capture https://example.com --format html
//! web-capture https://example.com --format markdown --output page.md
//! web-capture https://example.com --format png --output screenshot.png
//! ```

use axum::{
    extract::Query,
    http::StatusCode,
    response::{IntoResponse, Response},
    routing::get,
    Router,
};
use clap::Parser;
use serde::Deserialize;
use std::net::SocketAddr;
use std::path::PathBuf;
use tokio::fs;
use tower_http::trace::TraceLayer;
use tracing::{error, info};
use tracing_subscriber::{layer::SubscriberExt, util::SubscriberInitExt};
use url::Url;

use web_capture::{
    capture_screenshot, convert_html_to_markdown, convert_relative_urls, convert_to_utf8,
    fetch_html, html, render_html,
};

/// CLI arguments
#[derive(Parser, Debug)]
#[command(
    name = "web-capture",
    about = "Capture web pages as HTML, Markdown, or PNG",
    version
)]
struct Args {
    /// URL to capture (required in capture mode)
    #[arg(index = 1)]
    url: Option<String>,

    /// Start as HTTP API server
    #[arg(short, long)]
    serve: bool,

    /// Port to listen on (server mode)
    #[arg(short, long, default_value = "3000", env = "PORT")]
    port: u16,

    /// Output format: html, markdown/md, image/png
    #[arg(short, long, default_value = "html")]
    format: String,

    /// Output file path (default: stdout for text, auto-generated for images)
    #[arg(short, long)]
    output: Option<PathBuf>,
}

/// Query parameters for API endpoints
#[derive(Debug, Deserialize)]
struct UrlQuery {
    url: String,
}

#[tokio::main]
async fn main() -> anyhow::Result<()> {
    // Initialize tracing
    tracing_subscriber::registry()
        .with(
            tracing_subscriber::EnvFilter::try_from_default_env()
                .unwrap_or_else(|_| "web_capture=info,tower_http=info".into()),
        )
        .with(tracing_subscriber::fmt::layer())
        .init();

    let args = Args::parse();

    if args.serve {
        // Server mode
        start_server(args.port).await?;
    } else if let Some(url) = args.url {
        // Capture mode
        capture_url(&url, &args.format, args.output.as_ref()).await?;
    } else {
        eprintln!("Error: Missing URL or --serve flag");
        eprintln!("Run with --help for usage information");
        std::process::exit(1);
    }

    Ok(())
}

/// Start the HTTP server
async fn start_server(port: u16) -> anyhow::Result<()> {
    let app = Router::new()
        .route("/html", get(html_handler))
        .route("/markdown", get(markdown_handler))
        .route("/image", get(image_handler))
        .route("/fetch", get(fetch_handler))
        .route("/stream", get(stream_handler))
        .layer(TraceLayer::new_for_http());

    let addr = SocketAddr::from(([0, 0, 0, 0], port));
    info!("web-capture server listening on http://{}", addr);
    info!("");
    info!("Available endpoints:");
    info!("  GET /html?url=<URL>       - Render page as HTML");
    info!("  GET /markdown?url=<URL>   - Convert page to Markdown");
    info!("  GET /image?url=<URL>      - Screenshot page as PNG");
    info!("  GET /fetch?url=<URL>      - Proxy fetch content");
    info!("  GET /stream?url=<URL>     - Stream content");
    info!("");
    info!("Press Ctrl+C to stop the server");

    let listener = tokio::net::TcpListener::bind(addr).await?;
    axum::serve(listener, app)
        .with_graceful_shutdown(shutdown_signal())
        .await?;

    Ok(())
}

/// Graceful shutdown signal handler
async fn shutdown_signal() {
    tokio::signal::ctrl_c()
        .await
        .expect("Failed to install Ctrl+C handler");
    info!("Shutdown signal received, closing server...");
}

/// HTML endpoint handler
async fn html_handler(Query(params): Query<UrlQuery>) -> Response {
    let url = match normalize_url(&params.url) {
        Ok(url) => url,
        Err(e) => return (StatusCode::BAD_REQUEST, e).into_response(),
    };

    // First try to fetch HTML directly
    let html_result = match fetch_html(&url).await {
        Ok(html) => html,
        Err(e) => {
            error!("Failed to fetch HTML: {}", e);
            return (StatusCode::INTERNAL_SERVER_ERROR, "Error fetching HTML").into_response();
        }
    };

    // Check if it's valid HTML and contains JavaScript
    let needs_render = !html::is_html(&html_result) || html::has_javascript(&html_result);

    let final_html = if needs_render {
        // Use browser to get rendered HTML
        match render_html(&url).await {
            Ok(rendered) => {
                let utf8_html = convert_to_utf8(&rendered);
                convert_relative_urls(&utf8_html, &url)
            }
            Err(e) => {
                error!("Failed to render HTML: {}", e);
                return (StatusCode::INTERNAL_SERVER_ERROR, "Error rendering HTML").into_response();
            }
        }
    } else {
        let utf8_html = convert_to_utf8(&html_result);
        convert_relative_urls(&utf8_html, &url)
    };

    (
        StatusCode::OK,
        [("Content-Type", "text/html; charset=utf-8")],
        final_html,
    )
        .into_response()
}

/// Markdown endpoint handler
async fn markdown_handler(Query(params): Query<UrlQuery>) -> Response {
    let url = match normalize_url(&params.url) {
        Ok(url) => url,
        Err(e) => return (StatusCode::BAD_REQUEST, e).into_response(),
    };

    let html = match fetch_html(&url).await {
        Ok(html) => html,
        Err(e) => {
            error!("Failed to fetch HTML: {}", e);
            return (StatusCode::INTERNAL_SERVER_ERROR, "Error fetching HTML").into_response();
        }
    };

    let markdown = match convert_html_to_markdown(&html, Some(&url)) {
        Ok(md) => md,
        Err(e) => {
            error!("Failed to convert to Markdown: {}", e);
            return (
                StatusCode::INTERNAL_SERVER_ERROR,
                "Error converting to Markdown",
            )
                .into_response();
        }
    };

    (
        StatusCode::OK,
        [("Content-Type", "text/markdown")],
        markdown,
    )
        .into_response()
}

/// Image/screenshot endpoint handler
async fn image_handler(Query(params): Query<UrlQuery>) -> Response {
    let url = match normalize_url(&params.url) {
        Ok(url) => url,
        Err(e) => return (StatusCode::BAD_REQUEST, e).into_response(),
    };

    let screenshot = match capture_screenshot(&url).await {
        Ok(data) => data,
        Err(e) => {
            error!("Failed to capture screenshot: {}", e);
            return (
                StatusCode::INTERNAL_SERVER_ERROR,
                "Error capturing screenshot",
            )
                .into_response();
        }
    };

    (
        StatusCode::OK,
        [
            ("Content-Type", "image/png"),
            ("Content-Disposition", "inline; filename=\"screenshot.png\""),
        ],
        screenshot,
    )
        .into_response()
}

/// Fetch/proxy endpoint handler
async fn fetch_handler(Query(params): Query<UrlQuery>) -> Response {
    let url = match normalize_url(&params.url) {
        Ok(url) => url,
        Err(e) => return (StatusCode::BAD_REQUEST, e).into_response(),
    };

    let client = match reqwest::Client::builder().build() {
        Ok(client) => client,
        Err(e) => {
            error!("Failed to create HTTP client: {}", e);
            return (StatusCode::INTERNAL_SERVER_ERROR, "Error creating client").into_response();
        }
    };

    let response = match client.get(&url).send().await {
        Ok(resp) => resp,
        Err(e) => {
            error!("Failed to fetch content: {}", e);
            return (StatusCode::INTERNAL_SERVER_ERROR, "Error fetching content").into_response();
        }
    };

    let status = StatusCode::from_u16(response.status().as_u16()).unwrap_or(StatusCode::OK);
    let content_type = response
        .headers()
        .get("content-type")
        .and_then(|v| v.to_str().ok())
        .unwrap_or("text/plain")
        .to_string();

    let body = match response.bytes().await {
        Ok(bytes) => bytes.to_vec(),
        Err(e) => {
            error!("Failed to read response body: {}", e);
            return (StatusCode::INTERNAL_SERVER_ERROR, "Error reading content").into_response();
        }
    };

    (status, [("Content-Type", content_type.as_str())], body).into_response()
}

/// Stream/proxy endpoint handler (same as fetch for now)
async fn stream_handler(query: Query<UrlQuery>) -> Response {
    // For simplicity, stream and fetch behave the same in this implementation
    fetch_handler(query).await
}

/// Capture a URL and save/output the result
async fn capture_url(url: &str, format: &str, output: Option<&PathBuf>) -> anyhow::Result<()> {
    let absolute_url = normalize_url(url).map_err(|e| anyhow::anyhow!(e))?;

    match format.to_lowercase().as_str() {
        "markdown" | "md" => {
            let html = fetch_html(&absolute_url).await?;
            let markdown = convert_html_to_markdown(&html, Some(&absolute_url))?;

            if let Some(path) = output {
                fs::write(path, &markdown).await?;
                eprintln!("Markdown saved to: {}", path.display());
            } else {
                print!("{markdown}");
            }
        }
        "image" | "png" | "screenshot" => {
            let screenshot = capture_screenshot(&absolute_url).await?;

            if let Some(path) = output {
                fs::write(path, &screenshot).await?;
                eprintln!("Screenshot saved to: {}", path.display());
            } else {
                // Generate default filename
                let parsed_url = Url::parse(&absolute_url)?;
                let hostname = parsed_url.host_str().unwrap_or("unknown");
                let default_filename = format!(
                    "{}_{}.png",
                    hostname.replace('.', "_"),
                    std::time::SystemTime::now()
                        .duration_since(std::time::UNIX_EPOCH)?
                        .as_millis()
                );
                fs::write(&default_filename, &screenshot).await?;
                eprintln!("Screenshot saved to: {default_filename}");
            }
        }
        _ => {
            let html_content = fetch_html(&absolute_url).await?;
            let needs_render = !html::is_html(&html_content) || html::has_javascript(&html_content);

            let result = if needs_render {
                let rendered = render_html(&absolute_url).await?;
                let utf8_html = convert_to_utf8(&rendered);
                convert_relative_urls(&utf8_html, &absolute_url)
            } else {
                let utf8_html = convert_to_utf8(&html_content);
                convert_relative_urls(&utf8_html, &absolute_url)
            };

            if let Some(path) = output {
                fs::write(path, &result).await?;
                eprintln!("HTML saved to: {}", path.display());
            } else {
                print!("{result}");
            }
        }
    }

    Ok(())
}

/// Normalize URL to ensure it's absolute
fn normalize_url(url: &str) -> Result<String, String> {
    if url.is_empty() {
        return Err("Missing url parameter".to_string());
    }

    let absolute_url = if url.starts_with("http://") || url.starts_with("https://") {
        url.to_string()
    } else {
        format!("https://{url}")
    };

    // Validate the URL
    Url::parse(&absolute_url).map_err(|e| format!("Invalid URL: {e}"))?;

    Ok(absolute_url)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_normalize_url_already_absolute() {
        assert_eq!(
            normalize_url("https://example.com").unwrap(),
            "https://example.com"
        );
    }

    #[test]
    fn test_normalize_url_relative() {
        assert_eq!(normalize_url("example.com").unwrap(), "https://example.com");
    }

    #[test]
    fn test_normalize_url_empty() {
        assert!(normalize_url("").is_err());
    }
}
