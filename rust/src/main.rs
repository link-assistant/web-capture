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
use tracing::{debug, error, info};
use tracing_subscriber::{layer::SubscriberExt, util::SubscriberInitExt};
use url::Url;

use web_capture::{
    capture_screenshot, convert_html_to_markdown_enhanced, convert_relative_urls, convert_to_utf8,
    fetch_html, html, render_html, EnhancedOptions,
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
    /// URL to capture (required in capture mode)
    #[arg(index = 1)]
    url: Option<String>,

    /// Start as HTTP API server
    #[arg(short, long)]
    serve: bool,

    /// Port to listen on (server mode)
    #[arg(short, long, default_value = "3000", env = "PORT")]
    port: u16,

    /// Output format: markdown/md, html, image/png
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

    /// Keep images as inline base64 data URIs instead of extracting to files (default: false).
    /// Use --embed-images to keep base64 inline.
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

    /// Keep original remote image URLs instead of downloading or extracting.
    /// Base64 data URIs are stripped (no original URL to restore).
    #[arg(long, default_value_t = false, env = "WEB_CAPTURE_KEEP_ORIGINAL_LINKS")]
    keep_original_links: bool,

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
        .route("/image", get(image_handler))
        .route("/fetch", get(fetch_handler))
        .route("/stream", get(stream_handler))
        .route("/animation", get(animation_handler))
        .route("/figures", get(figures_handler))
        .route("/themed-image", get(themed_image_handler))
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
    info!("  GET /animation?url=<URL>  - Capture animation frames");
    info!("  GET /figures?url=<URL>    - Extract figure images");
    info!("  GET /themed-image?url=<URL> - Dual-theme screenshots");
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

    let html = match fetch_html(&url).await {
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
    let mut markdown = match convert_html_to_markdown_enhanced(&html, Some(&url), &options) {
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

    if !params.embed_images {
        let result = web_capture::extract_images::strip_base64_images(&markdown);
        markdown = result.markdown;
    }

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
                    let mut markdown = result.content;
                    if let Some(path) =
                        effective_output_path(&absolute_url, "md", output, &args.data_dir)
                    {
                        if args.embed_images {
                            // Keep base64 data URIs inline
                        } else if args.keep_original_links {
                            let result =
                                web_capture::extract_images::strip_base64_images(&markdown);
                            if result.stripped > 0 {
                                markdown = result.markdown;
                                eprintln!(
                                    "Stripped {} base64 images (keeping original links)",
                                    result.stripped
                                );
                            }
                        } else {
                            let output_dir = path.parent().unwrap_or(&path);
                            let result = web_capture::extract_images::extract_and_save_images(
                                &markdown,
                                output_dir,
                                &args.images_dir,
                            )?;
                            if result.extracted > 0 {
                                markdown = result.markdown;
                                eprintln!(
                                    "Extracted {} images to {}/",
                                    result.extracted, args.images_dir
                                );
                            }
                        }
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
            let mut markdown = result.markdown;

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
                if args.embed_images {
                    // Keep base64 data URIs inline
                } else if args.keep_original_links {
                    let result = web_capture::extract_images::strip_base64_images(&markdown);
                    if result.stripped > 0 {
                        markdown = result.markdown;
                        eprintln!(
                            "Stripped {} base64 images (keeping original links)",
                            result.stripped
                        );
                    }
                } else {
                    let output_dir = path.parent().unwrap_or(path);
                    let result = web_capture::extract_images::extract_and_save_images(
                        &markdown,
                        output_dir,
                        &args.images_dir,
                    )?;
                    if result.extracted > 0 {
                        markdown = result.markdown;
                        eprintln!(
                            "Extracted {} images to {}/",
                            result.extracted, args.images_dir
                        );
                    }
                }
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
        let archive = web_capture::gdocs::GDocsArchiveResult {
            html: rendered.html.clone(),
            markdown: rendered.markdown.clone(),
            images: Vec::new(),
            document_id: rendered.document_id.clone(),
            export_url: rendered.export_url.clone(),
        };
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
