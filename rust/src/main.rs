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
    http::{header, HeaderValue, StatusCode},
    response::{IntoResponse, Response},
    routing::get,
    Router,
};
use clap::Parser;
use serde::Deserialize;
use std::net::SocketAddr;
use std::path::{Path, PathBuf};
use tokio::fs;
use tower_http::trace::TraceLayer;
use tracing::{debug, error, info};
use tracing_subscriber::{layer::SubscriberExt, util::SubscriberInitExt};
use url::Url;

use web_capture::extract_images::{apply_image_mode, ImageMode, PendingRemoteImage};
use web_capture::search::{format_search_as_markdown, DEFAULT_PROVIDER};
use web_capture::{
    capture_screenshot, convert_html_to_markdown_enhanced, convert_relative_urls, convert_to_utf8,
    convert_with_kreuzberg_enhanced, fetch_html, html, render_html, EnhancedOptions,
};

/// CLI arguments
#[derive(Parser, Debug)]
#[command(
    name = "web-capture",
    about = "Capture web pages as HTML, Markdown, or PNG",
    version
)]
#[allow(clippy::struct_excessive_bools)]
struct Args {
    /// URL to capture (required in capture mode). Use the literal `search`
    /// here to enter structured search mode: `web-capture search <query>`.
    #[arg(index = 1)]
    url: Option<String>,

    /// Search query (used only in `web-capture search <query>` mode)
    #[arg(index = 2)]
    query: Option<String>,

    /// Search provider: wikipedia, duckduckgo, google, bing, brave
    #[arg(long, default_value = "wikipedia")]
    provider: String,

    /// Maximum number of search results (search mode)
    #[arg(long, default_value_t = 10)]
    limit: usize,

    /// Start as HTTP API server
    #[arg(short, long)]
    serve: bool,

    /// Port to listen on (server mode)
    #[arg(short, long, default_value = "3000", env = "PORT")]
    port: u16,

    /// Output format: markdown/md, html, txt/text, image/png
    #[arg(short, long, default_value = "markdown")]
    format: String,

    /// Output file path (default: stdout for text, auto-generated for images)
    #[arg(short, long)]
    output: Option<PathBuf>,

    /// Extract LaTeX formulas from img.formula, `KaTeX`, `MathJax` (default: true).
    /// Use --no-extract-latex to disable.
    #[arg(long, default_value_t = true, env = "WEB_CAPTURE_EXTRACT_LATEX")]
    extract_latex: bool,

    /// Extract article metadata (author, date, hubs, tags) (default: true).
    /// Use --no-extract-metadata to disable.
    #[arg(long, default_value_t = true, env = "WEB_CAPTURE_EXTRACT_METADATA")]
    extract_metadata: bool,

    /// Apply post-processing (unicode normalization, LaTeX spacing) (default: true).
    /// Use --no-post-process to disable.
    #[arg(long, default_value_t = true, env = "WEB_CAPTURE_POST_PROCESS")]
    post_process: bool,

    /// Detect and correct code block languages (default: true).
    /// Use --no-detect-code-language to disable.
    #[arg(long, default_value_t = true, env = "WEB_CAPTURE_DETECT_CODE_LANGUAGE")]
    detect_code_language: bool,

    /// CSS selector used to scope markdown conversion while preserving full-page metadata extraction.
    #[arg(long, env = "WEB_CAPTURE_CONTENT_SELECTOR")]
    content_selector: Option<String>,

    /// CSS selector for article body markdown; prepends the selected article title when available.
    #[arg(long, env = "WEB_CAPTURE_BODY_SELECTOR")]
    body_selector: Option<String>,

    /// Keep images inline as base64 data URIs, producing a single self-contained
    /// file (default: false). By default markdown keeps remote images as direct
    /// links; use --extract-images to save them as local files instead.
    #[arg(long, default_value_t = false, env = "WEB_CAPTURE_EMBED_IMAGES")]
    embed_images: bool,

    /// Directory name for extracted images, relative to output file (default: images)
    #[arg(long, default_value = "images", env = "WEB_CAPTURE_IMAGES_DIR")]
    images_dir: String,

    /// Base directory for auto-derived output paths when -o is omitted (default: ./data/web-capture)
    #[arg(
        long,
        default_value = "./data/web-capture",
        env = "WEB_CAPTURE_DATA_DIR"
    )]
    data_dir: String,

    /// Create archive output. Formats: zip (default), 7z, tar.gz (alias gz), tar
    #[arg(long, num_args = 0..=1, default_missing_value = "zip")]
    archive: Option<String>,

    /// Disable HTML pretty-printing (output minified HTML instead of indented).
    #[arg(long, default_value_t = false, env = "WEB_CAPTURE_NO_PRETTY_HTML")]
    no_pretty_html: bool,

    /// Alias for --embed-images: keep images inline as base64
    #[arg(long, default_value_t = false)]
    no_extract_images: bool,

    /// Keep remote image URLs as direct links — this is the default markdown
    /// behavior, kept as an explicit alias for back-compat. Base64 data URIs are
    /// stripped (no original URL to restore).
    #[arg(long, default_value_t = false, env = "WEB_CAPTURE_KEEP_ORIGINAL_LINKS")]
    keep_original_links: bool,

    /// Extract images to local files: base64 data URIs and remote images are
    /// saved under <DIR>/<images-dir>/ and the markdown is rewritten to point at
    /// them. Without a value, the output file's directory is used. Default
    /// markdown keeps images as direct remote links instead.
    #[arg(long, num_args = 0..=1, default_missing_value = "", env = "WEB_CAPTURE_EXTRACT_IMAGES")]
    extract_images: Option<String>,

    /// Capture both light and dark theme screenshots
    #[arg(long, default_value_t = false)]
    dual_theme: bool,

    /// Path to batch configuration file (JSON)
    #[arg(long)]
    config_file: Option<PathBuf>,

    /// Process all articles in batch configuration
    #[arg(long, default_value_t = false)]
    all: bool,

    /// Show what would be done without making changes
    #[arg(long, default_value_t = false)]
    dry_run: bool,

    /// Show detailed output
    #[arg(long, default_value_t = false)]
    verbose: bool,

    /// API token for authenticated capture (e.g., Google Docs private documents).
    /// Can also be set via `API_TOKEN` env variable.
    #[arg(long, env = "API_TOKEN")]
    api_token: Option<String>,

    /// Capture method: browser (default) or api (direct HTTP fetch, for Google Docs etc.)
    #[arg(long, default_value = "browser")]
    capture: String,
}

/// Query parameters for API endpoints
#[derive(Debug, Deserialize)]
struct UrlQuery {
    url: String,
}

/// Query parameters for /markdown endpoint
#[derive(Debug, Deserialize)]
#[allow(dead_code)]
struct MarkdownQuery {
    url: String,
    #[serde(default)]
    converter: Option<String>,
    #[serde(default)]
    format: Option<String>,
    #[serde(default, rename = "embedImages")]
    embed_images: bool,
    #[serde(default = "default_true", rename = "keepOriginalLinks")]
    keep_original_links: bool,
    #[serde(default, rename = "contentSelector")]
    content_selector: Option<String>,
    #[serde(default, rename = "bodySelector")]
    body_selector: Option<String>,
}

const fn default_true() -> bool {
    true
}

/// Query parameters for the /search endpoint
#[derive(Debug, Deserialize)]
struct SearchQuery {
    /// Search query (`q`, with `query` accepted as an alias)
    #[serde(alias = "query")]
    q: Option<String>,
    #[serde(default)]
    provider: Option<String>,
    #[serde(default)]
    limit: Option<usize>,
    #[serde(default)]
    format: Option<String>,
}

/// Current UTC time as an RFC 3339 timestamp (e.g. `2026-05-30T12:34:56Z`).
///
/// Implemented without a calendar dependency via Howard Hinnant's
/// days-from-civil algorithm so the crate keeps its lean dependency set.
fn now_rfc3339() -> String {
    let secs = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .map_or(0, |d| d.as_secs());
    let days = (secs / 86_400).cast_signed();
    let rem = secs % 86_400;
    let (hour, minute, second) = (rem / 3600, (rem % 3600) / 60, rem % 60);

    // days-from-civil (civil_from_days), epoch shifted to 0000-03-01.
    let z = days + 719_468;
    let era = if z >= 0 { z } else { z - 146_096 } / 146_097;
    let doe = z - era * 146_097; // [0, 146096]
    let yoe = (doe - doe / 1460 + doe / 36_524 - doe / 146_096) / 365; // [0, 399]
    let year = yoe + era * 400;
    let doy = doe - (365 * yoe + yoe / 4 - yoe / 100); // [0, 365]
    let mp = (5 * doy + 2) / 153; // [0, 11]
    let day = doy - (153 * mp + 2) / 5 + 1; // [1, 31]
    let month = if mp < 10 { mp + 3 } else { mp - 9 }; // [1, 12]
    let year = if month <= 2 { year + 1 } else { year };

    format!("{year:04}-{month:02}-{day:02}T{hour:02}:{minute:02}:{second:02}Z")
}

/// Resolve the image-handling [`ImageMode`] from CLI flags.
///
/// Precedence: `--embed-images` (and its `--no-extract-images` alias) >
/// `--extract-images` > the default contract (keep remote links, strip inline
/// base64). `--keep-original-links` falls through to the default, which is its
/// documented behaviour.
fn resolve_image_mode(args: &Args, output_dir: &Path) -> ImageMode {
    if args.embed_images {
        ImageMode::Embed
    } else if let Some(dir) = args.extract_images.as_ref() {
        let base = if dir.is_empty() {
            output_dir.to_path_buf()
        } else {
            PathBuf::from(dir)
        };
        ImageMode::Extract {
            dir: base,
            subdir: args.images_dir.clone(),
        }
    } else {
        ImageMode::Default
    }
}

/// Apply the resolved image mode to markdown destined for a file, downloading
/// any remote images that an Extract mode localized. Returns the rewritten
/// markdown.
async fn process_output_markdown(
    markdown: String,
    args: &Args,
    output_path: &Path,
    label: &str,
) -> anyhow::Result<String> {
    let output_dir = output_path.parent().unwrap_or_else(|| Path::new("."));
    let mode = resolve_image_mode(args, output_dir);
    let extract_dir = match &mode {
        ImageMode::Extract { dir, .. } => Some(dir.clone()),
        _ => None,
    };
    let result = apply_image_mode(&markdown, mode, None)?;
    let mut md = result.markdown;
    if result.extracted > 0 {
        eprintln!(
            "Extracted {} images to {}/ ({label})",
            result.extracted, args.images_dir
        );
    }
    if result.stripped > 0 {
        eprintln!(
            "Stripped {} inline base64 image(s) ({label}); \
             use --extract-images to save files or --embed-images to keep them inline",
            result.stripped
        );
    }
    if let Some(dir) = extract_dir {
        if !result.pending_remote.is_empty() {
            let images_path = dir.join(&args.images_dir);
            md =
                download_pending_remote(md, &result.pending_remote, &images_path, &args.images_dir)
                    .await;
        }
    }
    Ok(md)
}

/// Download remote images that [`ImageMode::Extract`] localized, writing them to
/// `images_path`. On any failure the original remote URL is restored so the
/// markdown never points at a missing local file.
async fn download_pending_remote(
    mut markdown: String,
    pending: &[PendingRemoteImage],
    images_path: &Path,
    subdir: &str,
) -> String {
    let client = reqwest::Client::new();
    let mut downloaded = 0;
    for img in pending {
        let local_ref = format!("{subdir}/{}", img.filename);
        let bytes = match client.get(&img.url).send().await {
            Ok(resp) if resp.status().is_success() => resp.bytes().await.ok(),
            _ => None,
        };
        let saved = bytes.is_some_and(|data| {
            std::fs::create_dir_all(images_path).is_ok()
                && std::fs::write(images_path.join(&img.filename), &data).is_ok()
        });
        if saved {
            downloaded += 1;
        } else {
            // Restore the original URL so the reference is not broken.
            markdown = markdown.replace(&local_ref, &img.url);
        }
    }
    if downloaded > 0 {
        eprintln!("Downloaded {downloaded} remote image(s) to {subdir}/");
    }
    markdown
}

#[tokio::main]
async fn main() -> anyhow::Result<()> {
    let mut args = Args::parse();

    // Initialize tracing after parsing args so --verbose can enable detailed logs.
    let default_filter = if args.verbose {
        "web_capture=debug,tower_http=debug"
    } else {
        "web_capture=info,tower_http=info"
    };
    tracing_subscriber::registry()
        .with(
            tracing_subscriber::EnvFilter::try_from_default_env()
                .unwrap_or_else(|_| default_filter.into()),
        )
        .with(tracing_subscriber::fmt::layer())
        .init();

    // --no-extract-images is an alias for --embed-images
    if args.no_extract_images {
        args.embed_images = true;
    }

    // --archive flag validation and format override
    let effective_format = if let Some(ref archive_fmt) = args.archive {
        let fmt = if archive_fmt.is_empty() {
            "zip"
        } else {
            archive_fmt.as_str()
        };
        match fmt {
            "zip" | "7z" | "tar.gz" | "gz" | "tar" => {}
            other => {
                eprintln!("Error: Unsupported archive format \"{other}\". Supported: zip, 7z, tar.gz, gz, tar");
                std::process::exit(1);
            }
        }
        "archive".to_string()
    } else {
        args.format.clone()
    };

    if args.serve {
        // Server mode
        start_server(args.port).await?;
    } else if args.url.as_deref() == Some("search") {
        // Structured search mode: `web-capture search <query>`
        run_search(&args).await?;
    } else if let Some(ref url) = args.url {
        // Capture mode
        capture_url(url, &effective_format, args.output.as_ref(), &args).await?;
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
        .route("/txt", get(txt_handler))
        .route("/image", get(image_handler))
        .route("/fetch", get(fetch_handler))
        .route("/stream", get(stream_handler))
        .route("/animation", get(animation_handler))
        .route("/figures", get(figures_handler))
        .route("/themed-image", get(themed_image_handler))
        .route("/search", get(search_handler))
        .layer(TraceLayer::new_for_http());

    let addr = SocketAddr::from(([0, 0, 0, 0], port));
    info!("web-capture server listening on http://{}", addr);
    info!("");
    info!("Available endpoints:");
    info!("  GET /html?url=<URL>       - Render page as HTML");
    info!("  GET /markdown?url=<URL>   - Convert page to Markdown");
    info!("  GET /markdown?url=<URL>&converter=kreuzberg&format=json - Structured Markdown conversion");
    info!("  GET /txt?url=<URL>        - Fetch text content");
    info!("  GET /image?url=<URL>      - Screenshot page as PNG");
    info!("  GET /fetch?url=<URL>      - Proxy fetch content");
    info!("  GET /stream?url=<URL>     - Stream content");
    info!("  GET /animation?url=<URL>  - Capture animation frames");
    info!("  GET /figures?url=<URL>    - Extract figure images");
    info!("  GET /themed-image?url=<URL> - Dual-theme screenshots");
    info!("  GET /search?q=<QUERY>     - Structured search-provider capture");
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
async fn markdown_handler(Query(params): Query<MarkdownQuery>) -> Response {
    let url = match normalize_url(&params.url) {
        Ok(url) => url,
        Err(e) => return (StatusCode::BAD_REQUEST, e).into_response(),
    };

    let converter = params
        .converter
        .as_deref()
        .unwrap_or("html2md")
        .to_ascii_lowercase();
    let format = params
        .format
        .as_deref()
        .unwrap_or("text")
        .to_ascii_lowercase();
    if let Some(response) = validate_markdown_query(&converter, &format) {
        return response;
    }

    let page_url = web_capture::xpaste::normalize_url_for_text_page(&url);
    let has_selector = params.content_selector.is_some() || params.body_selector.is_some();
    if let Some(response) = maybe_github_repository_markdown_response(
        &page_url,
        &format,
        has_selector,
        params.embed_images,
    )
    .await
    {
        return response;
    }

    let html = match fetch_html(&page_url).await {
        Ok(html) => html,
        Err(e) => {
            error!("Failed to fetch HTML: {}", e);
            return (StatusCode::INTERNAL_SERVER_ERROR, "Error fetching HTML").into_response();
        }
    };

    let options = EnhancedOptions {
        content_selector: params.content_selector,
        body_selector: params.body_selector,
        ..EnhancedOptions::default()
    };

    if converter == "kreuzberg" {
        let mut result = match convert_with_kreuzberg_enhanced(&html, Some(&page_url), &options) {
            Ok(result) => result,
            Err(e) => {
                error!("Failed to convert to Markdown with kreuzberg: {}", e);
                return (
                    StatusCode::INTERNAL_SERVER_ERROR,
                    "Error converting to Markdown",
                )
                    .into_response();
            }
        };

        if let Ok(image_result) = apply_image_mode(
            &result.content,
            server_markdown_image_mode(params.embed_images),
            Some(&page_url),
        ) {
            result.content = image_result.markdown;
        }

        if format == "json" {
            return axum::Json(result).into_response();
        }
        if let Some(response) = maybe_text_paste_markdown_response(&url, &result.content).await {
            return response;
        }
        return markdown_response(result.content);
    }

    let mut markdown = match convert_html_to_markdown_enhanced(&html, Some(&page_url), &options) {
        Ok(result) => result.markdown,
        Err(e) => {
            error!("Failed to convert to Markdown: {}", e);
            return (
                StatusCode::INTERNAL_SERVER_ERROR,
                "Error converting to Markdown",
            )
                .into_response();
        }
    };

    // Route through the unified chokepoint. The server returns a single
    // response body, so only Default (strip base64) and Embed apply.
    if let Ok(result) = apply_image_mode(
        &markdown,
        server_markdown_image_mode(params.embed_images),
        Some(&page_url),
    ) {
        markdown = result.markdown;
    }

    if let Some(response) = maybe_text_paste_markdown_response(&url, &markdown).await {
        return response;
    }

    markdown_response(markdown)
}

fn validate_markdown_query(converter: &str, format: &str) -> Option<Response> {
    if converter != "html2md" && converter != "kreuzberg" {
        return Some(
            (StatusCode::BAD_REQUEST, "Unsupported `converter` parameter").into_response(),
        );
    }
    if format != "text" && format != "json" {
        return Some((StatusCode::BAD_REQUEST, "Unsupported `format` parameter").into_response());
    }
    if format == "json" && converter != "kreuzberg" {
        return Some(
            (
                StatusCode::BAD_REQUEST,
                "`format=json` is only supported with `converter=kreuzberg`",
            )
                .into_response(),
        );
    }
    None
}

async fn maybe_github_repository_markdown_response(
    page_url: &str,
    format: &str,
    has_selector: bool,
    embed_images: bool,
) -> Option<Response> {
    if format != "text" || has_selector || !web_capture::github::is_github_repository_url(page_url)
    {
        return None;
    }

    let snapshot = match web_capture::github::fetch_github_repository_snapshot(page_url).await {
        Ok(snapshot) => snapshot,
        Err(e) => {
            error!("Failed to fetch GitHub repository snapshot: {}", e);
            return Some(
                (
                    StatusCode::INTERNAL_SERVER_ERROR,
                    "Error fetching GitHub repository snapshot",
                )
                    .into_response(),
            );
        }
    };
    let mut markdown = web_capture::github::format_github_repository_markdown(&snapshot);
    if let Ok(result) = apply_image_mode(
        &markdown,
        server_markdown_image_mode(embed_images),
        Some(page_url),
    ) {
        markdown = result.markdown;
    }
    Some(markdown_response(markdown))
}

const fn server_markdown_image_mode(embed_images: bool) -> ImageMode {
    if embed_images {
        ImageMode::Embed
    } else {
        ImageMode::Default
    }
}

/// Text download endpoint handler
async fn txt_handler(Query(params): Query<UrlQuery>) -> Response {
    let url = match normalize_url(&params.url) {
        Ok(url) => url,
        Err(e) => return (StatusCode::BAD_REQUEST, e).into_response(),
    };

    let text = match fetch_text_content(&url).await {
        Ok(text) => text,
        Err(e) => {
            error!("Failed to fetch text content: {}", e);
            return (
                StatusCode::INTERNAL_SERVER_ERROR,
                "Error fetching text content",
            )
                .into_response();
        }
    };

    text_response(&url, text)
}

async fn fetch_text_content(url: &str) -> anyhow::Result<String> {
    if web_capture::github::is_github_repository_url(url) {
        let snapshot = web_capture::github::fetch_github_repository_snapshot(url).await?;
        return Ok(web_capture::github::format_github_repository_text(
            &snapshot,
        ));
    }

    let text_url = web_capture::xpaste::normalize_url_for_text_content(url);
    let response = reqwest::get(&text_url).await?;
    if !response.status().is_success() {
        anyhow::bail!("HTTP {} fetching {text_url}", response.status());
    }
    let content_type = response
        .headers()
        .get(header::CONTENT_TYPE)
        .and_then(|value| value.to_str().ok())
        .unwrap_or("text/plain");
    if !content_type.contains("text/") {
        anyhow::bail!("Expected text content, got {content_type}");
    }
    Ok(response.text().await?)
}

fn text_response(url: &str, text: String) -> Response {
    let filename = web_capture::github::github_repository_text_filename(url)
        .unwrap_or_else(|| web_capture::xpaste::filename_for_text_url(url));
    let mut response = (StatusCode::OK, text).into_response();
    response.headers_mut().insert(
        header::CONTENT_TYPE,
        HeaderValue::from_static("text/plain; charset=utf-8"),
    );
    if let Ok(value) = HeaderValue::from_str(&format!("attachment; filename=\"{filename}\"")) {
        response
            .headers_mut()
            .insert(header::CONTENT_DISPOSITION, value);
    }
    response
}

async fn maybe_text_paste_markdown_response(url: &str, markdown: &str) -> Option<Response> {
    if !web_capture::xpaste::is_text_paste_url(url) {
        return None;
    }

    let raw_text = match fetch_text_content(url).await {
        Ok(raw_text) => raw_text,
        Err(e) => {
            error!("Failed to fetch text paste raw content: {}", e);
            return Some(
                (
                    StatusCode::INTERNAL_SERVER_ERROR,
                    "Error fetching text content",
                )
                    .into_response(),
            );
        }
    };

    let markdown_with_text =
        web_capture::xpaste::append_text_attachment_markdown(markdown, url, &raw_text);
    if markdown_with_text.lines().count() < web_capture::xpaste::INLINE_MARKDOWN_LINE_LIMIT {
        return Some(markdown_response(markdown_with_text));
    }

    Some(
        match create_text_paste_markdown_archive(url, markdown, &raw_text) {
            Ok(bytes) => zip_response(url, bytes),
            Err(e) => {
                error!("Failed to create text paste markdown archive: {}", e);
                (
                    StatusCode::INTERNAL_SERVER_ERROR,
                    "Error creating Markdown archive",
                )
                    .into_response()
            }
        },
    )
}

fn markdown_response(markdown: String) -> Response {
    (
        StatusCode::OK,
        [("Content-Type", "text/markdown")],
        markdown,
    )
        .into_response()
}

fn create_text_paste_markdown_archive(
    url: &str,
    markdown: &str,
    raw_text: &str,
) -> anyhow::Result<Vec<u8>> {
    use std::io::{Cursor, Write};

    let paste_id = web_capture::xpaste::paste_id(url).unwrap_or_else(|| "paste".to_string());
    let markdown_filename = format!("xpaste-pro-{paste_id}.md");
    let text_filename = format!("xpaste-pro-{paste_id}.txt");
    let mut cursor = Cursor::new(Vec::new());
    let mut zip = zip::ZipWriter::new(&mut cursor);
    let options = zip::write::SimpleFileOptions::default()
        .compression_method(zip::CompressionMethod::Deflated);
    let line_count = markdown.lines().count();
    let index = format!(
        "# {url}\n\nContent from: {url}\n\nThe page markdown is available in [{markdown_filename}]({markdown_filename}) ({line_count} lines).\nThe raw text content is available in [{text_filename}]({text_filename}).\n"
    );

    zip.start_file("index.md", options)?;
    zip.write_all(index.as_bytes())?;
    zip.start_file(markdown_filename, options)?;
    zip.write_all(markdown.as_bytes())?;
    zip.start_file(text_filename, options)?;
    zip.write_all(raw_text.as_bytes())?;
    zip.finish()?;
    Ok(cursor.into_inner())
}

fn zip_response(url: &str, bytes: Vec<u8>) -> Response {
    let paste_id = web_capture::xpaste::paste_id(url).unwrap_or_else(|| "paste".to_string());
    let mut response = (StatusCode::OK, bytes).into_response();
    response.headers_mut().insert(
        header::CONTENT_TYPE,
        HeaderValue::from_static("application/zip"),
    );
    if let Ok(value) = HeaderValue::from_str(&format!("attachment; filename=\"{paste_id}.zip\"")) {
        response
            .headers_mut()
            .insert(header::CONTENT_DISPOSITION, value);
    }
    response
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

/// Animation endpoint handler
async fn animation_handler(Query(params): Query<UrlQuery>) -> Response {
    let url = match normalize_url(&params.url) {
        Ok(url) => url,
        Err(e) => return (StatusCode::BAD_REQUEST, e).into_response(),
    };

    let options = web_capture::animation::AnimationOptions::default();
    match web_capture::animation::capture_animation_frames(&url, &options).await {
        Ok(result) => {
            let json = serde_json::json!({
                "frameCount": result.frames.len(),
                "loopDetected": result.loop_detected,
                "loopFrame": result.loop_frame,
                "duration": result.duration,
                "totalFrames": result.total_frames,
            });
            axum::Json(json).into_response()
        }
        Err(e) => {
            error!("Animation capture error: {}", e);
            (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()).into_response()
        }
    }
}

/// Figures extraction endpoint handler
async fn figures_handler(Query(params): Query<UrlQuery>) -> Response {
    let url = match normalize_url(&params.url) {
        Ok(url) => url,
        Err(e) => return (StatusCode::BAD_REQUEST, e).into_response(),
    };

    // Fetch the HTML and extract figures
    let html_content = match fetch_html(&url).await {
        Ok(html) => html,
        Err(e) => {
            error!("Failed to fetch HTML for figures: {}", e);
            return (StatusCode::INTERNAL_SERVER_ERROR, "Error fetching HTML").into_response();
        }
    };

    let figures = web_capture::figures::extract_figures(&html_content, &url);
    let downloaded = web_capture::figures::download_figures(&figures).await;

    let json = serde_json::json!({
        "url": url,
        "totalFound": figures.len(),
        "totalDownloaded": downloaded.iter().filter(|d| d.buffer.is_some()).count(),
        "figures": downloaded.iter().map(|f| serde_json::json!({
            "figureNum": f.figure_num,
            "filename": f.filename,
            "caption": f.caption,
            "originalUrl": f.original_url,
            "downloaded": f.buffer.is_some(),
            "error": f.error,
        })).collect::<Vec<_>>(),
    });
    axum::Json(json).into_response()
}

/// Dual-themed screenshot endpoint handler
async fn themed_image_handler(Query(params): Query<UrlQuery>) -> Response {
    let url = match normalize_url(&params.url) {
        Ok(url) => url,
        Err(e) => return (StatusCode::BAD_REQUEST, e).into_response(),
    };

    let options = web_capture::themed_image::ThemedImageOptions::default();
    match web_capture::themed_image::capture_dual_theme_screenshots(&url, &options).await {
        Ok(result) => {
            let json = serde_json::json!({
                "url": result.url,
                "width": result.width,
                "height": result.height,
                "lightSize": result.light_size,
                "darkSize": result.dark_size,
            });
            axum::Json(json).into_response()
        }
        Err(e) => {
            error!("Themed image capture error: {}", e);
            (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()).into_response()
        }
    }
}

/// Structured search-provider capture endpoint handler
async fn search_handler(Query(params): Query<SearchQuery>) -> Response {
    let query = params.q.unwrap_or_default();
    if query.trim().is_empty() {
        return (StatusCode::BAD_REQUEST, "Missing `q` (query) parameter").into_response();
    }
    let provider = params
        .provider
        .unwrap_or_else(|| DEFAULT_PROVIDER.to_string());
    let limit = params.limit.unwrap_or(web_capture::search::DEFAULT_LIMIT);
    let format = params.format.unwrap_or_else(|| "json".to_string());

    let result = match web_capture::search::search(
        &query,
        &provider,
        limit,
        "fetch",
        &now_rfc3339(),
    )
    .await
    {
        Ok(result) => result,
        Err(e) => return (StatusCode::BAD_REQUEST, e).into_response(),
    };

    if format.eq_ignore_ascii_case("markdown") || format.eq_ignore_ascii_case("md") {
        (
            StatusCode::OK,
            [("Content-Type", "text/markdown")],
            format_search_as_markdown(&result),
        )
            .into_response()
    } else {
        axum::Json(result).into_response()
    }
}

/// Run structured search from the CLI (`web-capture search <query>`).
async fn run_search(args: &Args) -> anyhow::Result<()> {
    let Some(query) = args.query.as_deref() else {
        eprintln!("Error: Missing search query. Usage: web-capture search <query>");
        std::process::exit(1);
    };

    // Search defaults to JSON output unless --format/-f was passed explicitly.
    let format_explicit = std::env::args().any(|arg| {
        arg == "-f" || arg == "--format" || arg.starts_with("--format=") || arg.starts_with("-f=")
    });
    let format = if format_explicit {
        args.format.clone()
    } else {
        "json".to_string()
    };

    let result =
        web_capture::search::search(query, &args.provider, args.limit, "fetch", &now_rfc3339())
            .await
            .map_err(|e| anyhow::anyhow!(e))?;

    if format.eq_ignore_ascii_case("markdown") || format.eq_ignore_ascii_case("md") {
        println!("{}", format_search_as_markdown(&result));
    } else {
        println!("{}", serde_json::to_string_pretty(&result)?);
    }
    Ok(())
}

/// Capture a URL and save/output the result
#[allow(clippy::too_many_lines)]
async fn capture_url(
    url: &str,
    format: &str,
    output: Option<&PathBuf>,
    args: &Args,
) -> anyhow::Result<()> {
    let absolute_url = normalize_url(url).map_err(|e| anyhow::anyhow!(e))?;
    debug!(
        url = %absolute_url,
        format = %format,
        capture = %args.capture,
        has_api_token = args.api_token.is_some(),
        "starting capture"
    );

    // Google Docs capture honors --capture:
    // - browser: load /edit model data
    // - api without token: public export endpoint
    // - api with token: docs.googleapis.com REST API
    if web_capture::gdocs::is_google_docs_url(&absolute_url) {
        let api_token = args.api_token.as_deref();
        let method = web_capture::gdocs::select_capture_method(&args.capture, api_token)?;
        let format_lower = format.to_lowercase();
        let model_format = matches!(
            format_lower.as_str(),
            "archive" | "markdown" | "md" | "html" | "txt" | "text"
        );
        debug!(
            url = %absolute_url,
            method = ?method,
            format = %format_lower,
            model_format,
            has_api_token = api_token.is_some(),
            "selected Google Docs capture method"
        );

        if method == web_capture::gdocs::GDocsCaptureMethod::BrowserModel && !model_format {
            debug!(
                format = %format_lower,
                "Google Docs editor model does not support requested format; using regular browser pipeline"
            );
            // Screenshot-like formats should use the regular browser path below.
        } else if method == web_capture::gdocs::GDocsCaptureMethod::BrowserModel {
            let rendered =
                web_capture::gdocs::fetch_google_doc_from_model(&absolute_url, api_token).await?;
            write_rendered_gdoc(
                &rendered,
                &format_lower,
                &absolute_url,
                output,
                args,
                "Google Doc (browser-model)",
            )
            .await?;
            return Ok(());
        } else if method == web_capture::gdocs::GDocsCaptureMethod::DocsApi {
            let Some(token) = api_token else {
                unreachable!("Docs API capture is only selected when a token exists");
            };
            let rendered =
                web_capture::gdocs::fetch_google_doc_from_docs_api(&absolute_url, token).await?;
            write_rendered_gdoc(
                &rendered,
                &format_lower,
                &absolute_url,
                output,
                args,
                "Google Doc (docs-api)",
            )
            .await?;
            return Ok(());
        } else {
            match format_lower.as_str() {
                "archive" => {
                    let archive_result =
                        web_capture::gdocs::fetch_google_doc_as_archive(&absolute_url, api_token)
                            .await?;
                    let zip_bytes = web_capture::gdocs::create_archive_zip(
                        &archive_result,
                        !args.no_pretty_html,
                    )?;
                    write_archive_capture(
                        &zip_bytes,
                        &absolute_url,
                        output,
                        args.archive.as_deref().unwrap_or("zip"),
                        &args.data_dir,
                        "Google Doc (archive)",
                    )
                    .await?;
                }
                "markdown" | "md" => {
                    let result =
                        web_capture::gdocs::fetch_google_doc_as_markdown(&absolute_url, api_token)
                            .await?;
                    let markdown = result.content;
                    if let Some(path) =
                        effective_output_path(&absolute_url, "md", output, &args.data_dir)
                    {
                        let markdown =
                            process_output_markdown(markdown, args, &path, "Google Doc Markdown")
                                .await?;
                        write_text_capture_to_path(&markdown, &path, "Google Doc Markdown").await?;
                    } else {
                        print!("{markdown}");
                    }
                }
                _ => {
                    let gdocs_format = match format_lower.as_str() {
                        "png" | "image" | "screenshot" => "html",
                        other => other,
                    };
                    let result = web_capture::gdocs::fetch_google_doc(
                        &absolute_url,
                        gdocs_format,
                        api_token,
                    )
                    .await?;
                    write_text_capture(
                        &result.content,
                        &absolute_url,
                        gdocs_format,
                        output,
                        &args.data_dir,
                        &format!("Google Doc ({gdocs_format})"),
                    )
                    .await?;
                }
            }
            return Ok(());
        }
    }

    match format.to_lowercase().as_str() {
        "txt" | "text" => {
            let text = fetch_text_content(&absolute_url).await?;
            write_text_capture(&text, &absolute_url, "txt", output, &args.data_dir, "Text").await?;
        }
        "archive" => {
            let archive_fmt = args.archive.as_deref().unwrap_or("zip");
            let ext = match archive_fmt {
                "tar.gz" | "gz" => "tar.gz",
                "7z" => "7z",
                "tar" => "tar",
                _ => "zip",
            };

            let html = capture_html_content(&absolute_url, args).await?;
            let options = EnhancedOptions {
                extract_latex: args.extract_latex,
                extract_metadata: args.extract_metadata,
                post_process: args.post_process,
                detect_code_language: args.detect_code_language,
                content_selector: args.content_selector.clone(),
                body_selector: args.body_selector.clone(),
            };
            let enhanced = convert_html_to_markdown_enhanced(&html, Some(&absolute_url), &options)?;
            let markdown = enhanced.markdown;

            let buffers = web_capture::extract_images::extract_base64_to_buffers(
                &markdown,
                &args.images_dir,
            )?;

            let archive_result = web_capture::gdocs::GDocsArchiveResult {
                html: html.clone(),
                markdown: buffers.markdown,
                images: buffers
                    .images
                    .into_iter()
                    .map(|b| web_capture::gdocs::ExtractedImage {
                        filename: b.filename,
                        data: b.data,
                        mime_type: String::new(),
                    })
                    .collect(),
                document_id: String::new(),
                export_url: absolute_url.clone(),
            };
            let zip_bytes =
                web_capture::gdocs::create_archive_zip(&archive_result, !args.no_pretty_html)?;

            let is_stdout = output.is_some_and(|p| p.as_os_str() == "-");
            let derived;
            let effective_output = if is_stdout {
                None
            } else if let Some(path) = output {
                Some(path.clone())
            } else {
                derived = derive_output_path(&absolute_url, ext, &args.data_dir);
                Some(derived)
            };
            if let Some(ref path) = effective_output {
                if let Some(parent) = path.parent() {
                    std::fs::create_dir_all(parent).ok();
                }
                fs::write(path, &zip_bytes).await?;
                eprintln!("Archive saved to: {}", path.display());
            } else {
                use std::io::Write;
                std::io::stdout().write_all(&zip_bytes)?;
            }
        }
        "markdown" | "md" => {
            if args.content_selector.is_none()
                && args.body_selector.is_none()
                && web_capture::github::is_github_repository_url(&absolute_url)
            {
                let snapshot =
                    web_capture::github::fetch_github_repository_snapshot(&absolute_url).await?;
                let markdown = web_capture::github::format_github_repository_markdown(&snapshot);

                let is_stdout = output.is_some_and(|p| p.as_os_str() == "-");
                let derived;
                let effective_output = if is_stdout {
                    None
                } else if let Some(path) = output {
                    Some(path.clone())
                } else {
                    derived = derive_output_path(&absolute_url, "md", &args.data_dir);
                    Some(derived)
                };
                if let Some(ref path) = effective_output {
                    let markdown =
                        process_output_markdown(markdown, args, path, "GitHub repository Markdown")
                            .await?;
                    write_text_capture_to_path(&markdown, path, "GitHub repository Markdown")
                        .await?;
                } else {
                    print!("{markdown}");
                }
                return Ok(());
            }

            let html = capture_html_content(&absolute_url, args).await?;

            // Enhanced conversion is now the default
            let options = EnhancedOptions {
                extract_latex: args.extract_latex,
                extract_metadata: args.extract_metadata,
                post_process: args.post_process,
                detect_code_language: args.detect_code_language,
                content_selector: args.content_selector.clone(),
                body_selector: args.body_selector.clone(),
            };
            let result = convert_html_to_markdown_enhanced(&html, Some(&absolute_url), &options)?;
            let markdown = result.markdown;

            let is_stdout = output.is_some_and(|p| p.as_os_str() == "-");
            let derived;
            let effective_output = if is_stdout {
                None
            } else if let Some(path) = output {
                Some(path.clone())
            } else {
                derived = derive_output_path(&absolute_url, "md", &args.data_dir);
                Some(derived)
            };
            if let Some(ref path) = effective_output {
                let markdown = process_output_markdown(markdown, args, path, "Markdown").await?;
                if let Some(parent) = path.parent() {
                    std::fs::create_dir_all(parent).ok();
                }
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
            let html_content = capture_html_content(&absolute_url, args).await?;
            let utf8_html = convert_to_utf8(&html_content);
            let result = convert_relative_urls(&utf8_html, &absolute_url);

            let is_stdout = output.is_some_and(|p| p.as_os_str() == "-");
            let derived;
            let effective_output = if is_stdout {
                None
            } else if let Some(path) = output {
                Some(path.clone())
            } else {
                derived = derive_output_path(&absolute_url, "html", &args.data_dir);
                Some(derived)
            };
            if let Some(ref path) = effective_output {
                if let Some(parent) = path.parent() {
                    std::fs::create_dir_all(parent).ok();
                }
                fs::write(path, &result).await?;
                eprintln!("HTML saved to: {}", path.display());
            } else {
                print!("{result}");
            }
        }
    }

    Ok(())
}

async fn capture_html_content(absolute_url: &str, args: &Args) -> anyhow::Result<String> {
    if capture_uses_browser(&args.capture)? {
        Ok(render_html(absolute_url).await?)
    } else {
        Ok(fetch_html(absolute_url).await?)
    }
}

fn capture_uses_browser(capture: &str) -> anyhow::Result<bool> {
    match capture.to_lowercase().as_str() {
        "browser" => Ok(true),
        "api" => Ok(false),
        other => Err(anyhow::anyhow!(
            "Unsupported capture method \"{other}\". Use \"browser\" or \"api\"."
        )),
    }
}

async fn write_rendered_gdoc(
    rendered: &web_capture::gdocs::GDocsRenderedResult,
    format: &str,
    absolute_url: &str,
    output: Option<&PathBuf>,
    args: &Args,
    label: &str,
) -> anyhow::Result<()> {
    if format == "archive" || format == "zip" {
        let archive =
            web_capture::gdocs::localize_rendered_remote_images_for_archive(rendered).await?;
        let zip_bytes = web_capture::gdocs::create_archive_zip(&archive, !args.no_pretty_html)?;
        write_archive_capture(
            &zip_bytes,
            absolute_url,
            output,
            args.archive.as_deref().unwrap_or("zip"),
            &args.data_dir,
            "Google Doc (archive)",
        )
        .await?;
        return Ok(());
    }

    let (content, ext) = match format {
        "html" => (rendered.html.as_str(), "html"),
        "txt" | "text" => (rendered.text.as_str(), "txt"),
        _ => (rendered.markdown.as_str(), "md"),
    };
    write_text_capture(content, absolute_url, ext, output, &args.data_dir, label).await
}

fn effective_output_path(
    absolute_url: &str,
    ext: &str,
    output: Option<&PathBuf>,
    data_dir: &str,
) -> Option<PathBuf> {
    if output.is_some_and(|path| path.as_os_str() == "-") {
        None
    } else if let Some(path) = output {
        Some(path.clone())
    } else {
        Some(derive_output_path(absolute_url, ext, data_dir))
    }
}

async fn write_text_capture(
    content: &str,
    absolute_url: &str,
    ext: &str,
    output: Option<&PathBuf>,
    data_dir: &str,
    label: &str,
) -> anyhow::Result<()> {
    if let Some(path) = effective_output_path(absolute_url, ext, output, data_dir) {
        write_text_capture_to_path(content, &path, label).await?;
    } else {
        print!("{content}");
    }
    Ok(())
}

async fn write_text_capture_to_path(
    content: &str,
    path: &PathBuf,
    label: &str,
) -> anyhow::Result<()> {
    if let Some(parent) = path.parent() {
        std::fs::create_dir_all(parent).ok();
    }
    fs::write(path, content).await?;
    eprintln!("{label} saved to: {}", path.display());
    Ok(())
}

async fn write_archive_capture(
    bytes: &[u8],
    absolute_url: &str,
    output: Option<&PathBuf>,
    archive_fmt: &str,
    data_dir: &str,
    label: &str,
) -> anyhow::Result<()> {
    let ext = match archive_fmt {
        "tar.gz" | "gz" => "tar.gz",
        "7z" => "7z",
        "tar" => "tar",
        _ => "zip",
    };
    if let Some(path) = effective_output_path(absolute_url, ext, output, data_dir) {
        if let Some(parent) = path.parent() {
            std::fs::create_dir_all(parent).ok();
        }
        fs::write(&path, bytes).await?;
        eprintln!("{label} saved to: {}", path.display());
    } else {
        use std::io::Write;
        std::io::stdout().write_all(bytes)?;
    }
    Ok(())
}

/// Derive an output file path from a URL when -o is not provided.
fn derive_output_path(absolute_url: &str, ext: &str, data_dir: &str) -> PathBuf {
    let parsed =
        Url::parse(absolute_url).unwrap_or_else(|_| Url::parse("https://unknown").unwrap());
    let host = parsed.host_str().unwrap_or("unknown");
    let url_path = parsed.path().trim_start_matches('/').trim_end_matches('/');
    let dir = PathBuf::from(data_dir).join(host).join(url_path);
    std::fs::create_dir_all(&dir).ok();
    dir.join(format!("document.{ext}"))
}

/// Normalize URL to ensure it's absolute
fn normalize_url(url: &str) -> Result<String, String> {
    web_capture::html::normalize_url(url)
}
