use std::fs;
use std::path::Path;

use web_capture::shared_dialog::{
    format_shared_dialog_as_demo_memory, format_shared_dialog_as_markdown,
    format_shared_dialog_as_meta_language, parse_shared_dialog, SharedDialogParseOptions,
};

const CHATGPT_SHARE_URL: &str = "https://chatgpt.com/share/6a3825b9-8de4-83ee-9c24-52fd1eb38d24";
const GOOGLE_AI_MODE_URL: &str = "https://share.google/aimode/VG0HhpnAXrBkC0QgP";

#[test]
fn chatgpt_share_html_extracts_visible_dialog_turns() {
    let html = read_case_study_fixture("chatgpt-share-6a3825b9.html");
    let capture = parse_shared_dialog(
        &html,
        &SharedDialogParseOptions {
            source_url: Some(CHATGPT_SHARE_URL.to_string()),
            capture_method: "static_http".to_string(),
            ..SharedDialogParseOptions::default()
        },
    );

    assert_eq!(capture.provider, "chatgpt");
    assert_eq!(capture.status, "ok");
    assert_eq!(capture.capture_method, "static_http");
    assert_eq!(capture.title.as_deref(), Some("Infinite loop script"));
    assert_eq!(
        capture.conversation_id.as_deref(),
        Some("6a3825b9-8de4-83ee-9c24-52fd1eb38d24")
    );
    assert_eq!(capture.turns.len(), 4);
    assert_eq!(capture.turns[0].role, "user");
    assert_eq!(capture.turns[1].role, "assistant");
    assert_eq!(capture.turns[2].role, "user");
    assert_eq!(capture.turns[3].role, "assistant");
    assert_eq!(capture.turns[0].visibility, "visible");
    assert_eq!(
        capture.turns[0].source_evidence[0].source_url,
        CHATGPT_SHARE_URL
    );
    assert!(capture.turns[0].content.contains("make a loop of that"));
    assert!(capture.turns[1]
        .content
        .contains("while true; do sleep 30m && hive-cleanup -f; done"));
    assert!(capture.turns[3]
        .content
        .contains("screen -dmS auto-cleanup bash -c"));
}

#[test]
fn chatgpt_share_formats_demo_memory_meta_language_and_markdown() {
    let html = read_case_study_fixture("chatgpt-share-6a3825b9.html");
    let capture = parse_shared_dialog(
        &html,
        &SharedDialogParseOptions {
            source_url: Some(CHATGPT_SHARE_URL.to_string()),
            capture_method: "static_http".to_string(),
            ..SharedDialogParseOptions::default()
        },
    );

    let memory = format_shared_dialog_as_demo_memory(&capture, Some("issue-552-chatgpt-share"));
    assert!(memory.contains("demo_memory"));
    assert_eq!(memory.matches("\n  event \"").count(), 4);
    assert!(memory.contains("conversationTitle \"Infinite loop script\""));
    assert!(memory
        .contains("evidence \"https://chatgpt.com/share/6a3825b9-8de4-83ee-9c24-52fd1eb38d24\""));

    let meta_language = format_shared_dialog_as_meta_language(&capture);
    assert!(meta_language.contains("shared_dialog_capture"));
    assert!(meta_language.contains("provider \"chatgpt\""));
    assert!(meta_language.contains("turn \"0c9f0151-b5a1-402f-afc3-6bd34a0d01d2\""));

    let markdown = format_shared_dialog_as_markdown(&capture);
    assert!(markdown.contains("# Infinite loop script"));
    assert!(markdown.contains("**User**"));
    assert!(markdown.contains("**Assistant**"));
}

#[test]
fn google_ai_mode_interstitial_returns_structured_diagnostic() {
    let html = read_case_study_fixture("google-ai-mode-VG0HhpnAXrBkC0QgP.html");
    let capture = parse_shared_dialog(
        &html,
        &SharedDialogParseOptions {
            source_url: Some(GOOGLE_AI_MODE_URL.to_string()),
            capture_method: "static_http".to_string(),
            ..SharedDialogParseOptions::default()
        },
    );

    assert_eq!(capture.provider, "google_ai_mode");
    assert_eq!(capture.status, "unsupported");
    assert!(capture.turns.is_empty());
    assert_eq!(
        capture.diagnostics.unsupported_reason.as_deref(),
        Some("provider_challenge_interstitial")
    );
}

fn read_case_study_fixture(name: &str) -> String {
    fs::read_to_string(
        Path::new(env!("CARGO_MANIFEST_DIR"))
            .join("../docs/case-studies/issue-141/raw-data")
            .join(name),
    )
    .expect("case-study fixture should be readable")
}
