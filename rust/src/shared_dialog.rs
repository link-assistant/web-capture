//! Shared AI dialog capture and normalization.
//!
//! `ChatGPT` shared pages embed a React Router stream with a devalue table that
//! contains `linear_conversation`. This module decodes that table into a
//! provider-neutral capture result and reports unsupported provider states as
//! structured diagnostics.

use serde::{Deserialize, Serialize};
use serde_json::{Map, Value};
use url::Url;

const ENQUEUE_MARKER: &str = "window.__reactRouterContext.streamController.enqueue(";
const USER_AGENT: &str = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";

#[derive(Debug, Default, Clone, PartialEq, Eq)]
pub struct SharedDialogParseOptions {
    pub source_url: Option<String>,
    pub capture_method: String,
    pub captured_at: Option<String>,
    pub http_status: Option<u16>,
    pub provider: Option<String>,
    pub warnings: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct SharedDialogCapture {
    pub provider: String,
    pub source_url: String,
    pub capture_method: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub captured_at: Option<String>,
    pub status: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub conversation_id: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub title: Option<String>,
    pub turns: Vec<SharedDialogTurn>,
    pub diagnostics: SharedDialogDiagnostics,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct SharedDialogTurn {
    pub id: String,
    pub role: String,
    pub content: String,
    pub visibility: String,
    pub source_evidence: Vec<SharedDialogEvidence>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct SharedDialogEvidence {
    pub kind: String,
    pub source_url: String,
    pub capture_method: String,
    pub pointer: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct SharedDialogDiagnostics {
    pub status: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub http_status: Option<u16>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub unsupported_reason: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub message: Option<String>,
    #[serde(default, skip_serializing_if = "Vec::is_empty")]
    pub warnings: Vec<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub error: Option<String>,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
struct UnsupportedDiagnostic {
    reason: &'static str,
    message: &'static str,
}

/// Parse captured HTML or a compact transcript into a normalized shared-dialog
/// result. Unsupported inputs return a structured diagnostic instead of an
/// error.
#[must_use]
pub fn parse_shared_dialog(input: &str, options: &SharedDialogParseOptions) -> SharedDialogCapture {
    let source_url = options.source_url.clone().unwrap_or_default();
    let capture_method = if options.capture_method.is_empty() {
        "static_http".to_string()
    } else {
        options.capture_method.clone()
    };
    let provider = options
        .provider
        .clone()
        .unwrap_or_else(|| detect_provider(input, &source_url));

    if provider == "chatgpt" {
        return match parse_chatgpt_share_html(input, options, &source_url, &capture_method) {
            Ok(capture) => capture,
            Err(error) => {
                let diagnostic = parse_unsupported(input, &provider);
                unsupported_capture(UnsupportedCaptureInput {
                    provider,
                    source_url,
                    capture_method,
                    captured_at: options.captured_at.clone(),
                    http_status: options.http_status,
                    unsupported_reason: diagnostic.reason,
                    message: if diagnostic.reason == "no_transcript_in_captured_dom" {
                        format!(
                            "ChatGPT share capture did not contain a parseable linear_conversation transcript: {error}"
                        )
                    } else {
                        diagnostic.message.to_string()
                    },
                    warnings: options.warnings.clone(),
                    error: None,
                })
            }
        };
    }

    let markdown =
        parse_markdown_transcript(input, options, &provider, &source_url, &capture_method);
    if markdown.status == "ok" {
        return markdown;
    }

    let diagnostic = parse_unsupported(input, &provider);
    unsupported_capture(UnsupportedCaptureInput {
        provider,
        source_url,
        capture_method,
        captured_at: options.captured_at.clone(),
        http_status: options.http_status,
        unsupported_reason: diagnostic.reason,
        message: diagnostic.message.to_string(),
        warnings: options.warnings.clone(),
        error: None,
    })
}

/// Fetch and normalize a shared dialog URL.
///
/// Browser mode first tries static HTTP, then falls back to rendered DOM when
/// the static capture is unsupported.
pub async fn capture_shared_dialog(
    url: &str,
    capture: &str,
    captured_at: Option<String>,
) -> Result<SharedDialogCapture, String> {
    let source_url = normalize_source_url(url)?;
    let mut http_status = None;
    let mut warnings = Vec::new();
    let mut static_html = String::new();

    match reqwest::Client::builder().user_agent(USER_AGENT).build() {
        Ok(client) => match client
            .get(&source_url)
            .header("Accept", "text/html,application/xhtml+xml")
            .header("Accept-Language", "en-US,en;q=0.9")
            .send()
            .await
        {
            Ok(response) => {
                http_status = Some(response.status().as_u16());
                match response.text().await {
                    Ok(body) => static_html = body,
                    Err(error) => warnings.push(format!("static_http_read_failed: {error}")),
                }
            }
            Err(error) => warnings.push(format!("static_http_failed: {error}")),
        },
        Err(error) => warnings.push(format!("static_http_client_failed: {error}")),
    }

    let static_capture = parse_shared_dialog(
        &static_html,
        &SharedDialogParseOptions {
            source_url: Some(source_url.clone()),
            capture_method: "static_http".to_string(),
            captured_at: captured_at.clone(),
            http_status,
            warnings,
            ..SharedDialogParseOptions::default()
        },
    );

    if static_capture.status == "ok" || capture.eq_ignore_ascii_case("api") {
        return Ok(static_capture);
    }
    if !capture.eq_ignore_ascii_case("browser") {
        return Ok(with_warning(
            static_capture,
            format!("unsupported_capture_method: {capture}; use browser or api"),
        ));
    }

    match crate::render_html(&source_url).await {
        Ok(rendered) => {
            let mut render_warnings = static_capture.diagnostics.warnings.clone();
            if let Some(reason) = static_capture.diagnostics.unsupported_reason.as_ref() {
                render_warnings.push(format!("static_http_unsupported: {reason}"));
            }
            Ok(parse_shared_dialog(
                &rendered,
                &SharedDialogParseOptions {
                    source_url: Some(source_url),
                    capture_method: "browser".to_string(),
                    captured_at,
                    warnings: render_warnings,
                    ..SharedDialogParseOptions::default()
                },
            ))
        }
        Err(error) => Ok(with_warning(
            static_capture,
            format!("browser_render_failed: {error}"),
        )),
    }
}

fn parse_chatgpt_share_html(
    input: &str,
    options: &SharedDialogParseOptions,
    source_url: &str,
    capture_method: &str,
) -> Result<SharedDialogCapture, String> {
    let table = extract_chatgpt_devalue_table(input)?;
    let resolved = resolve_devalue_root(&table)?;
    let data = find_object_with_array_key(&resolved, "linear_conversation")
        .ok_or_else(|| "linear_conversation data was not found".to_string())?;
    let linear = data
        .get("linear_conversation")
        .and_then(Value::as_array)
        .ok_or_else(|| "linear_conversation field was not an array".to_string())?;

    let mut turns = Vec::new();
    for (index, item) in linear.iter().enumerate() {
        if let Some(turn) = chatgpt_turn_from_item(item, index, source_url, capture_method) {
            turns.push(turn);
        }
    }
    if turns.is_empty() {
        return Err("no visible user or assistant turns were found".to_string());
    }

    let title = string_field(data, "title").or_else(|| title_from_html(input));
    let conversation_id =
        string_field(data, "conversation_id").or_else(|| chatgpt_share_id(source_url));

    Ok(ok_capture(OkCaptureInput {
        provider: "chatgpt".to_string(),
        source_url: source_url.to_string(),
        capture_method: capture_method.to_string(),
        captured_at: options.captured_at.clone(),
        http_status: options.http_status,
        title,
        conversation_id,
        turns,
        warnings: options.warnings.clone(),
    }))
}

fn chatgpt_turn_from_item(
    item: &Value,
    index: usize,
    source_url: &str,
    capture_method: &str,
) -> Option<SharedDialogTurn> {
    let message = item.get("message").unwrap_or(item);
    let role = message
        .get("author")
        .and_then(|author| author.get("role"))
        .and_then(Value::as_str)?;
    if role != "user" && role != "assistant" {
        return None;
    }
    if message_is_hidden(message) {
        return None;
    }
    let content = message
        .get("content")
        .map(message_content_text)
        .unwrap_or_default()
        .trim()
        .to_string();
    if content.is_empty() {
        return None;
    }
    let id = message
        .get("id")
        .and_then(Value::as_str)
        .map_or_else(|| format!("chatgpt-turn-{}", index + 1), ToOwned::to_owned);
    Some(SharedDialogTurn {
        id,
        role: role.to_string(),
        content,
        visibility: "visible".to_string(),
        source_evidence: vec![SharedDialogEvidence {
            kind: "chatgpt_linear_conversation".to_string(),
            source_url: source_url.to_string(),
            capture_method: capture_method.to_string(),
            pointer: format!("linear_conversation[{index}].message"),
        }],
    })
}

fn message_is_hidden(message: &Value) -> bool {
    message
        .get("metadata")
        .and_then(|metadata| metadata.get("is_visually_hidden_from_conversation"))
        .and_then(Value::as_bool)
        .unwrap_or(false)
}

fn message_content_text(content: &Value) -> String {
    if let Some(text) = content.as_str() {
        return text.to_string();
    }
    if let Some(parts) = content.get("parts").and_then(Value::as_array) {
        let mut texts = Vec::new();
        for part in parts {
            if let Some(text) = part.as_str() {
                if !text.is_empty() {
                    texts.push(text.to_string());
                }
            } else if let Some(text) = part.get("text").and_then(Value::as_str) {
                if !text.is_empty() {
                    texts.push(text.to_string());
                }
            }
        }
        return texts.join("\n\n");
    }
    content
        .get("text")
        .and_then(Value::as_str)
        .unwrap_or_default()
        .to_string()
}

fn extract_chatgpt_devalue_table(input: &str) -> Result<Vec<Value>, String> {
    for chunk in extract_react_router_stream_chunks(input)? {
        let trimmed = chunk.trim_start();
        if !trimmed.starts_with('[') {
            continue;
        }
        let value = serde_json::from_str::<Value>(trimmed)
            .map_err(|error| format!("failed to parse React Router payload JSON: {error}"))?;
        if let Value::Array(table) = value {
            return Ok(table);
        }
    }
    Err("ChatGPT share capture did not contain a JSON devalue table".to_string())
}

fn extract_react_router_stream_chunks(input: &str) -> Result<Vec<String>, String> {
    let mut chunks = Vec::new();
    let mut cursor = 0;
    let bytes = input.as_bytes();
    while let Some(relative) = input[cursor..].find(ENQUEUE_MARKER) {
        let mut literal_start = cursor + relative + ENQUEUE_MARKER.len();
        while matches!(bytes.get(literal_start), Some(b' ' | b'\n' | b'\r' | b'\t')) {
            literal_start += 1;
        }
        if bytes.get(literal_start) != Some(&b'"') {
            cursor = literal_start.saturating_add(1);
            continue;
        }
        let (literal, literal_len) = extract_json_string_literal(&input[literal_start..])?;
        let chunk = serde_json::from_str::<String>(literal)
            .map_err(|error| format!("failed to decode React Router stream string: {error}"))?;
        chunks.push(chunk);
        cursor = literal_start + literal_len;
    }
    if chunks.is_empty() {
        return Err("ChatGPT share capture did not contain React Router chunks".to_string());
    }
    Ok(chunks)
}

fn extract_json_string_literal(input: &str) -> Result<(&str, usize), String> {
    let bytes = input.as_bytes();
    if bytes.first() != Some(&b'"') {
        return Err("expected a JSON string literal".to_string());
    }
    let mut index = 1;
    while index < bytes.len() {
        match bytes[index] {
            b'\\' => index += 2,
            b'"' => return Ok((&input[..=index], index + 1)),
            _ => index += 1,
        }
    }
    Err("unterminated JSON string literal".to_string())
}

fn resolve_devalue_root(table: &[Value]) -> Result<Value, String> {
    if table.is_empty() {
        return Err("ChatGPT devalue table was empty".to_string());
    }
    Ok(resolve_table_index(table, 0, &mut Vec::new()))
}

fn resolve_table_index(table: &[Value], index: usize, stack: &mut Vec<usize>) -> Value {
    if index >= table.len() || stack.contains(&index) {
        return Value::Null;
    }
    stack.push(index);
    let value = resolve_table_value(table, &table[index], stack);
    stack.pop();
    value
}

fn resolve_table_value(table: &[Value], value: &Value, stack: &mut Vec<usize>) -> Value {
    match value {
        Value::Array(items) => Value::Array(
            items
                .iter()
                .map(|item| resolve_encoded_reference(table, item, stack))
                .collect(),
        ),
        Value::Object(map) => {
            let mut resolved = Map::new();
            for (encoded_key, encoded_value) in map {
                let key = resolve_object_key(table, encoded_key, stack);
                let value = resolve_encoded_reference(table, encoded_value, stack);
                resolved.insert(key, value);
            }
            Value::Object(resolved)
        }
        other => other.clone(),
    }
}

fn resolve_encoded_reference(table: &[Value], value: &Value, stack: &mut Vec<usize>) -> Value {
    if let Some(index) = value.as_i64() {
        if index < 0 {
            return Value::Null;
        }
        if let Ok(index) = usize::try_from(index) {
            return resolve_table_index(table, index, stack);
        }
        return Value::Null;
    }
    resolve_table_value(table, value, stack)
}

fn resolve_object_key(table: &[Value], encoded_key: &str, stack: &mut Vec<usize>) -> String {
    if let Some(raw_index) = encoded_key.strip_prefix('_') {
        if let Ok(index) = raw_index.parse::<usize>() {
            if let Value::String(key) = resolve_table_index(table, index, stack) {
                return key;
            }
        }
    }
    encoded_key.to_string()
}

fn find_object_with_array_key<'a>(value: &'a Value, key: &str) -> Option<&'a Map<String, Value>> {
    match value {
        Value::Object(map) => {
            if map.get(key).and_then(Value::as_array).is_some() {
                return Some(map);
            }
            map.values()
                .find_map(|child| find_object_with_array_key(child, key))
        }
        Value::Array(items) => items
            .iter()
            .find_map(|child| find_object_with_array_key(child, key)),
        _ => None,
    }
}

fn parse_markdown_transcript(
    input: &str,
    options: &SharedDialogParseOptions,
    provider: &str,
    source_url: &str,
    capture_method: &str,
) -> SharedDialogCapture {
    let mut turns = Vec::new();
    let mut current_role: Option<&'static str> = None;
    let mut current_lines = Vec::new();

    for line in input.lines() {
        if let Some((role, rest)) = markdown_turn_prefix(line) {
            push_markdown_turn(
                &mut turns,
                current_role.take(),
                &current_lines,
                source_url,
                capture_method,
            );
            current_role = Some(role);
            current_lines.clear();
            current_lines.push(rest.trim_start().to_string());
        } else if current_role.is_some() {
            current_lines.push(line.to_string());
        }
    }
    push_markdown_turn(
        &mut turns,
        current_role.take(),
        &current_lines,
        source_url,
        capture_method,
    );

    if turns.is_empty() {
        return unsupported_capture(UnsupportedCaptureInput {
            provider: provider.to_string(),
            source_url: source_url.to_string(),
            capture_method: capture_method.to_string(),
            captured_at: options.captured_at.clone(),
            http_status: options.http_status,
            unsupported_reason: "no_transcript_in_captured_dom",
            message: "No compact Markdown transcript turns were found.".to_string(),
            warnings: options.warnings.clone(),
            error: None,
        });
    }

    ok_capture(OkCaptureInput {
        provider: provider.to_string(),
        source_url: source_url.to_string(),
        capture_method: capture_method.to_string(),
        captured_at: options.captured_at.clone(),
        http_status: options.http_status,
        title: None,
        conversation_id: None,
        turns,
        warnings: options.warnings.clone(),
    })
}

fn markdown_turn_prefix(line: &str) -> Option<(&'static str, &str)> {
    let trimmed = line.trim_start();
    for (prefix, role) in [
        ("U:", "user"),
        ("User:", "user"),
        ("A:", "assistant"),
        ("Assistant:", "assistant"),
    ] {
        if trimmed.len() >= prefix.len() && trimmed[..prefix.len()].eq_ignore_ascii_case(prefix) {
            return Some((role, &trimmed[prefix.len()..]));
        }
    }
    None
}

fn push_markdown_turn(
    turns: &mut Vec<SharedDialogTurn>,
    role: Option<&'static str>,
    lines: &[String],
    source_url: &str,
    capture_method: &str,
) {
    let Some(role) = role else {
        return;
    };
    let content = trimmed_content_lines(lines);
    if content.is_empty() {
        return;
    }
    let index = turns.len();
    turns.push(SharedDialogTurn {
        id: format!("markdown-turn-{}", index + 1),
        role: role.to_string(),
        content,
        visibility: "visible".to_string(),
        source_evidence: vec![SharedDialogEvidence {
            kind: "markdown_transcript".to_string(),
            source_url: source_url.to_string(),
            capture_method: capture_method.to_string(),
            pointer: format!("turns[{index}]"),
        }],
    });
}

fn trimmed_content_lines(lines: &[String]) -> String {
    let Some(start) = lines.iter().position(|line| !line.trim().is_empty()) else {
        return String::new();
    };
    let end = lines
        .iter()
        .rposition(|line| !line.trim().is_empty())
        .unwrap_or(start);
    lines[start..=end].join("\n").trim().to_string()
}

fn detect_provider(input: &str, source_url: &str) -> String {
    if let Some(provider) = provider_from_url(source_url) {
        return provider;
    }
    if input.contains(ENQUEUE_MARKER) || input.contains("linear_conversation") {
        return "chatgpt".to_string();
    }
    if looks_like_google_ai_mode_interstitial(input) {
        return "google_ai_mode".to_string();
    }
    "unknown".to_string()
}

fn provider_from_url(source_url: &str) -> Option<String> {
    let parsed = Url::parse(source_url).ok()?;
    let host = parsed.host_str()?.to_ascii_lowercase();
    if host == "chatgpt.com" || host.ends_with(".chatgpt.com") {
        return Some("chatgpt".to_string());
    }
    if host == "share.google" && parsed.path().starts_with("/aimode/") {
        return Some("google_ai_mode".to_string());
    }
    None
}

fn parse_unsupported(input: &str, provider: &str) -> UnsupportedDiagnostic {
    if looks_like_google_ai_mode_interstitial(input) {
        return UnsupportedDiagnostic {
            reason: "provider_challenge_interstitial",
            message: "Google AI Mode capture returned a Google Search JavaScript/interstitial page instead of transcript data.",
        };
    }
    let lower = input.to_ascii_lowercase();
    if lower.contains("log in")
        || lower.contains("sign in")
        || lower.contains("login required")
        || lower.contains("authentication required")
    {
        return UnsupportedDiagnostic {
            reason: "login_required",
            message: "The shared dialog page requires login before transcript data is visible.",
        };
    }
    if lower.contains("deleted")
        || lower.contains("expired")
        || lower.contains("not found")
        || lower.contains("unavailable")
    {
        return UnsupportedDiagnostic {
            reason: "deleted_or_expired_share",
            message: "The shared dialog appears to be deleted, expired, or unavailable.",
        };
    }
    if provider == "unknown" {
        return UnsupportedDiagnostic {
            reason: "unsupported_provider_format",
            message: "The URL or captured DOM is not a supported shared-dialog provider format.",
        };
    }
    UnsupportedDiagnostic {
        reason: "no_transcript_in_captured_dom",
        message: "The captured DOM did not contain replayable transcript data.",
    }
}

fn looks_like_google_ai_mode_interstitial(input: &str) -> bool {
    input.contains("share.google/aimode")
        || (input.contains("Google Search")
            && input.contains("If you're having trouble accessing Google Search"))
        || (input.contains("/search?q=") && input.contains("enablejs"))
        || (input.contains("/httpservice/retry/enablejs") && input.contains("Google Search"))
}

fn title_from_html(input: &str) -> Option<String> {
    let start = input.find("<title>")? + "<title>".len();
    let end = input[start..].find("</title>")? + start;
    let title = html_escape::decode_html_entities(&input[start..end])
        .trim()
        .to_string();
    let stripped = title
        .strip_prefix("ChatGPT - ")
        .unwrap_or(&title)
        .trim()
        .to_string();
    if stripped.is_empty() {
        None
    } else {
        Some(stripped)
    }
}

fn string_field(map: &Map<String, Value>, key: &str) -> Option<String> {
    map.get(key).and_then(Value::as_str).map(ToOwned::to_owned)
}

fn chatgpt_share_id(source_url: &str) -> Option<String> {
    let parsed = Url::parse(source_url).ok()?;
    let parts: Vec<_> = parsed
        .path()
        .split('/')
        .filter(|part| !part.is_empty())
        .collect();
    let index = parts.iter().position(|part| *part == "share")?;
    parts.get(index + 1).map(|value| (*value).to_string())
}

struct OkCaptureInput {
    provider: String,
    source_url: String,
    capture_method: String,
    captured_at: Option<String>,
    http_status: Option<u16>,
    title: Option<String>,
    conversation_id: Option<String>,
    turns: Vec<SharedDialogTurn>,
    warnings: Vec<String>,
}

fn ok_capture(input: OkCaptureInput) -> SharedDialogCapture {
    SharedDialogCapture {
        provider: input.provider,
        source_url: input.source_url,
        capture_method: input.capture_method,
        captured_at: input.captured_at,
        status: "ok".to_string(),
        conversation_id: input.conversation_id,
        title: input.title,
        turns: input.turns,
        diagnostics: SharedDialogDiagnostics {
            status: "ok".to_string(),
            http_status: input.http_status,
            unsupported_reason: None,
            message: None,
            warnings: input.warnings,
            error: None,
        },
    }
}

struct UnsupportedCaptureInput {
    provider: String,
    source_url: String,
    capture_method: String,
    captured_at: Option<String>,
    http_status: Option<u16>,
    unsupported_reason: &'static str,
    message: String,
    warnings: Vec<String>,
    error: Option<String>,
}

fn unsupported_capture(input: UnsupportedCaptureInput) -> SharedDialogCapture {
    SharedDialogCapture {
        provider: input.provider,
        source_url: input.source_url,
        capture_method: input.capture_method,
        captured_at: input.captured_at,
        status: "unsupported".to_string(),
        conversation_id: None,
        title: None,
        turns: Vec::new(),
        diagnostics: SharedDialogDiagnostics {
            status: "unsupported".to_string(),
            http_status: input.http_status,
            unsupported_reason: Some(input.unsupported_reason.to_string()),
            message: Some(input.message),
            warnings: input.warnings,
            error: input.error,
        },
    }
}

fn with_warning(mut capture: SharedDialogCapture, warning: String) -> SharedDialogCapture {
    capture.diagnostics.warnings.push(warning);
    capture
}

fn normalize_source_url(url: &str) -> Result<String, String> {
    let source_url = if url.starts_with("http://") || url.starts_with("https://") {
        url.to_string()
    } else {
        format!("https://{url}")
    };
    Url::parse(&source_url)
        .map_err(|error| format!("Invalid shared-dialog URL \"{url}\": {error}"))?;
    Ok(source_url)
}

fn escape_lino(value: &str) -> String {
    value
        .replace('\\', "\\\\")
        .replace('"', "\\\"")
        .replace('\n', "\\n")
        .replace('\r', "\\r")
        .replace('\t', "\\t")
}

fn push_field(lines: &mut Vec<String>, indent: &str, name: &str, value: Option<&str>) {
    if let Some(value) = value {
        if !value.is_empty() {
            lines.push(format!("{indent}{name} \"{}\"", escape_lino(value)));
        }
    }
}

/// Format a capture as repository-local Links Notation style meta-language.
#[must_use]
pub fn format_shared_dialog_as_meta_language(capture: &SharedDialogCapture) -> String {
    let mut lines = vec!["shared_dialog_capture".to_string()];
    push_field(&mut lines, "  ", "provider", Some(&capture.provider));
    push_field(&mut lines, "  ", "sourceUrl", Some(&capture.source_url));
    push_field(
        &mut lines,
        "  ",
        "captureMethod",
        Some(&capture.capture_method),
    );
    push_field(
        &mut lines,
        "  ",
        "capturedAt",
        capture.captured_at.as_deref(),
    );
    push_field(&mut lines, "  ", "status", Some(&capture.status));
    push_field(
        &mut lines,
        "  ",
        "conversationId",
        capture.conversation_id.as_deref(),
    );
    push_field(&mut lines, "  ", "title", capture.title.as_deref());
    lines.push("  diagnostics".to_string());
    push_field(
        &mut lines,
        "    ",
        "status",
        Some(&capture.diagnostics.status),
    );
    if let Some(status) = capture.diagnostics.http_status {
        lines.push(format!("    httpStatus \"{status}\""));
    }
    push_field(
        &mut lines,
        "    ",
        "unsupportedReason",
        capture.diagnostics.unsupported_reason.as_deref(),
    );
    push_field(
        &mut lines,
        "    ",
        "message",
        capture.diagnostics.message.as_deref(),
    );
    for warning in &capture.diagnostics.warnings {
        push_field(&mut lines, "    ", "warning", Some(warning));
    }
    for turn in &capture.turns {
        lines.push(format!("  turn \"{}\"", escape_lino(&turn.id)));
        push_field(&mut lines, "    ", "role", Some(&turn.role));
        push_field(&mut lines, "    ", "visibility", Some(&turn.visibility));
        push_field(&mut lines, "    ", "content", Some(&turn.content));
        for evidence in &turn.source_evidence {
            lines.push("    evidence".to_string());
            push_field(&mut lines, "      ", "kind", Some(&evidence.kind));
            push_field(
                &mut lines,
                "      ",
                "sourceUrl",
                Some(&evidence.source_url),
            );
            push_field(
                &mut lines,
                "      ",
                "captureMethod",
                Some(&evidence.capture_method),
            );
            push_field(&mut lines, "      ", "pointer", Some(&evidence.pointer));
        }
    }
    format!("{}\n", lines.join("\n"))
}

/// Format a capture as formal-ai compatible `demo_memory` Links Notation.
#[must_use]
pub fn format_shared_dialog_as_demo_memory(
    capture: &SharedDialogCapture,
    demo_label: Option<&str>,
) -> String {
    let mut lines = vec!["demo_memory".to_string()];
    if capture.status != "ok" {
        lines.push("  diagnostic \"shared-dialog-unsupported\"".to_string());
        push_field(&mut lines, "    ", "provider", Some(&capture.provider));
        push_field(&mut lines, "    ", "sourceUrl", Some(&capture.source_url));
        push_field(
            &mut lines,
            "    ",
            "captureMethod",
            Some(&capture.capture_method),
        );
        push_field(
            &mut lines,
            "    ",
            "unsupportedReason",
            capture.diagnostics.unsupported_reason.as_deref(),
        );
        push_field(
            &mut lines,
            "    ",
            "message",
            capture.diagnostics.message.as_deref(),
        );
        return format!("{}\n", lines.join("\n"));
    }

    let label = demo_label.unwrap_or("web-capture-shared-dialog");
    for turn in &capture.turns {
        lines.push(format!("  event \"{}\"", escape_lino(&turn.id)));
        push_field(&mut lines, "    ", "role", Some(&turn.role));
        push_field(&mut lines, "    ", "content", Some(&turn.content));
        push_field(&mut lines, "    ", "demoLabel", Some(label));
        push_field(
            &mut lines,
            "    ",
            "conversationId",
            capture.conversation_id.as_deref(),
        );
        push_field(
            &mut lines,
            "    ",
            "conversationTitle",
            capture.title.as_deref(),
        );
        for evidence in &turn.source_evidence {
            push_field(&mut lines, "    ", "evidence", Some(&evidence.source_url));
        }
    }
    format!("{}\n", lines.join("\n"))
}

/// Format a capture as Markdown.
#[must_use]
pub fn format_shared_dialog_as_markdown(capture: &SharedDialogCapture) -> String {
    let mut lines = Vec::new();
    lines.push(format!(
        "# {}",
        capture.title.as_deref().unwrap_or("Shared Dialog Capture")
    ));
    lines.push(String::new());
    lines.push(format!("- Provider: `{}`", capture.provider));
    lines.push(format!("- Source: {}", capture.source_url));
    lines.push(format!("- Capture method: `{}`", capture.capture_method));
    lines.push(format!("- Status: `{}`", capture.status));
    if let Some(conversation_id) = capture.conversation_id.as_ref() {
        lines.push(format!("- Conversation ID: `{conversation_id}`"));
    }
    if capture.status != "ok" {
        if let Some(reason) = capture.diagnostics.unsupported_reason.as_ref() {
            lines.push(format!("- Unsupported reason: `{reason}`"));
        }
        if let Some(message) = capture.diagnostics.message.as_ref() {
            lines.push(String::new());
            lines.push(message.clone());
        }
        return format!("{}\n", lines.join("\n"));
    }
    lines.push(String::new());
    for turn in &capture.turns {
        let label = if turn.role == "user" {
            "User"
        } else {
            "Assistant"
        };
        lines.push(format!("**{label}**"));
        lines.push(String::new());
        lines.push(turn.content.clone());
        lines.push(String::new());
    }
    format!("{}\n", lines.join("\n").trim_end())
}

/// Format a capture as plain text.
#[must_use]
pub fn format_shared_dialog_as_text(capture: &SharedDialogCapture) -> String {
    if capture.status != "ok" {
        return format!(
            "Provider: {}\nSource: {}\nCapture method: {}\nStatus: {}\nUnsupported reason: {}\n{}\n",
            capture.provider,
            capture.source_url,
            capture.capture_method,
            capture.status,
            capture
                .diagnostics
                .unsupported_reason
                .as_deref()
                .unwrap_or_default(),
            capture.diagnostics.message.as_deref().unwrap_or_default()
        );
    }
    let mut lines = Vec::new();
    for turn in &capture.turns {
        let label = if turn.role == "user" {
            "User"
        } else {
            "Assistant"
        };
        lines.push(format!("{label}:"));
        lines.push(turn.content.clone());
        lines.push(String::new());
    }
    lines.join("\n")
}

/// Format a capture as simple HTML containing the Markdown representation.
#[must_use]
pub fn format_shared_dialog_as_html(capture: &SharedDialogCapture) -> String {
    let title =
        html_escape::encode_text(capture.title.as_deref().unwrap_or("Shared Dialog Capture"));
    let markdown = format_shared_dialog_as_markdown(capture);
    let body = html_escape::encode_text(&markdown);
    format!(
        "<!doctype html>\n<html>\n<head><meta charset=\"utf-8\"><title>{title}</title></head>\n<body><pre>{body}</pre></body>\n</html>\n"
    )
}

/// Format a capture according to a CLI/API format name.
///
/// # Errors
///
/// Returns a serialization error for JSON output if serde cannot serialize the
/// capture.
pub fn format_shared_dialog_result(
    capture: &SharedDialogCapture,
    format: &str,
) -> Result<String, serde_json::Error> {
    Ok(match format.to_ascii_lowercase().as_str() {
        "meta-language" | "meta_language" => format_shared_dialog_as_meta_language(capture),
        "demo-memory" | "demo_memory" => format_shared_dialog_as_demo_memory(capture, None),
        "markdown" | "md" => format_shared_dialog_as_markdown(capture),
        "txt" | "text" => format_shared_dialog_as_text(capture),
        "html" => format_shared_dialog_as_html(capture),
        _ => format!("{}\n", serde_json::to_string_pretty(capture)?),
    })
}

/// Return the conventional extension for a shared-dialog output format.
#[must_use]
pub fn shared_dialog_output_extension(format: &str) -> &'static str {
    match format.to_ascii_lowercase().as_str() {
        "meta-language" | "meta_language" | "demo-memory" | "demo_memory" => "lino",
        "markdown" | "md" => "md",
        "txt" | "text" => "txt",
        "html" => "html",
        _ => "json",
    }
}
