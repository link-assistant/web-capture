//! Helpers for capturing Stack Overflow question pages.
//!
//! Direct non-browser fetches of question pages can receive an anti-bot
//! challenge instead of the question content. For HTML-derived outputs we use
//! the public `StackPrinter` export for the same question, while screenshot
//! capture continues to use the original page URL.

use crate::{Result, WebCaptureError};
use std::time::Duration;
use tokio::time::sleep;
use url::Url;

const STACKPRINTER_RETRIES: usize = 3;
const STACKPRINTER_RETRY_BASE_DELAY_MS: u64 = 1_000;

/// Return true when `url` points at a Stack Overflow question page.
#[must_use]
pub fn is_stackoverflow_question_url(url: &str) -> bool {
    stackoverflow_question_id(url).is_some()
}

/// Build the public `StackPrinter` URL for a Stack Overflow question.
#[must_use]
pub fn stackprinter_url(url: &str) -> Option<String> {
    let question_id = stackoverflow_question_id(url)?;
    Some(format!(
        "https://stackprinter.appspot.com/export?question={question_id}&service=stackoverflow&language=en&hideAnswers=false&showAll=true&width=640"
    ))
}

/// Fetch a Stack Overflow question through `StackPrinter`.
///
/// # Errors
///
/// Returns an error if `url` is not a Stack Overflow question URL, or if the
/// network request fails.
pub async fn fetch_stackoverflow_html(url: &str) -> Result<String> {
    let stackprinter =
        stackprinter_url(url).ok_or_else(|| WebCaptureError::InvalidUrl(url.to_string()))?;
    let mut last_error = None;

    for attempt in 0..=STACKPRINTER_RETRIES {
        match fetch_stackprinter_html_once(&stackprinter).await {
            Ok(html) if !is_stackprinter_transient_error(&html) => return Ok(html),
            Ok(_) => {
                last_error = Some("StackPrinter returned a transient error page".to_string());
            }
            Err(error) => {
                last_error = Some(error.to_string());
            }
        }

        if attempt < STACKPRINTER_RETRIES {
            let delay_factor = 2_u64.pow(u32::try_from(attempt).expect("retry attempt fits u32"));
            sleep(Duration::from_millis(
                STACKPRINTER_RETRY_BASE_DELAY_MS * delay_factor,
            ))
            .await;
        }
    }

    Err(WebCaptureError::FetchError(last_error.unwrap_or_else(
        || "StackPrinter failed without an error message".to_string(),
    )))
}

async fn fetch_stackprinter_html_once(stackprinter: &str) -> Result<String> {
    let response = reqwest::get(stackprinter)
        .await
        .and_then(reqwest::Response::error_for_status)
        .map_err(|error| WebCaptureError::FetchError(error.to_string()))?;
    response
        .text()
        .await
        .map_err(|error| WebCaptureError::FetchError(error.to_string()))
}

#[must_use]
fn is_stackprinter_transient_error(html: &str) -> bool {
    html.contains("Ooooops") || html.contains("Please try again later")
}

fn stackoverflow_question_id(url: &str) -> Option<String> {
    let parsed = Url::parse(url).ok()?;
    let host = parsed.host_str()?.trim_start_matches("www.");
    if host != "stackoverflow.com" {
        return None;
    }

    let mut segments = parsed.path_segments()?;
    if segments.next()? != "questions" {
        return None;
    }

    let question_id = segments.next()?;
    if question_id
        .chars()
        .all(|character| character.is_ascii_digit())
    {
        Some(question_id.to_string())
    } else {
        None
    }
}
