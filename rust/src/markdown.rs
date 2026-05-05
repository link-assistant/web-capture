//! Markdown conversion module
//!
//! This module provides functions for converting HTML to Markdown format.

use crate::html::convert_relative_urls;
use crate::Result;
use regex::Regex;
use scraper::{Html, Selector};
use tracing::{debug, info};

/// Convert HTML content to Markdown
///
/// This function cleans the HTML (removing scripts, styles, etc.)
/// and converts it to Markdown format.
///
/// # Arguments
///
/// * `html` - The HTML content to convert
/// * `base_url` - Optional base URL for converting relative URLs to absolute
///
/// # Returns
///
/// The Markdown content as a string
///
/// # Errors
///
/// Returns an error if conversion fails
pub fn convert_html_to_markdown(html: &str, base_url: Option<&str>) -> Result<String> {
    info!("Converting HTML to Markdown");

    // Convert relative URLs to absolute if base_url is provided
    let processed_html = base_url.map_or_else(
        || html.to_string(),
        |base| convert_relative_urls(html, base),
    );

    // Parse and clean the HTML
    let cleaned_html = clean_html(&processed_html);

    // Preserve hierarchical heading numbering (e.g. "13. Foo", "13.1 Bar").
    // Unwrap <ol><li><hN>13. Foo</hN></li></ol> -> <hN>13. Foo</hN> so that
    // html2md does not restart the OL counter at "1." and clobber the source
    // number that already lives inside the heading text.
    let cleaned_html = preserve_leading_heading_numbering(&cleaned_html);

    // Move <img> elements out of headings so html2md always sees them.
    // Some html2md versions only emit text children for <h1>..<h6>,
    // silently dropping inline images.
    let heading_safe_html = hoist_images_from_headings(&cleaned_html);

    // Compute the number that each top-level <ol> item should carry, in
    // document order, so we can rewrite html2md's per-list-restarting "1."
    // prefixes into a single continuous sequence (matching the JS converter's
    // output) and honour explicit `<ol start="N">` attributes.
    let ol_item_numbers = compute_top_level_ordered_list_item_numbers(&heading_safe_html);

    // Convert to Markdown using html2md
    let markdown = html2md::parse_html(&heading_safe_html);

    // Renumber unindented ordered-list lines in the markdown output to match
    // the precomputed numbers. Indented lines (nested lists) are left alone
    // so html2md's per-list "1." restart for nested levels is preserved.
    let markdown = renumber_top_level_ordered_list_lines(&markdown, &ol_item_numbers);

    // Decode HTML entities to unicode characters
    let decoded_markdown = crate::html::decode_html_entities(&markdown);

    // Preserve non-breaking spaces as &nbsp; entities for clear marking
    let normalized_markdown = decoded_markdown.replace('\u{00A0}', "&nbsp;");

    // Clean up the markdown output
    let cleaned_markdown = clean_markdown(&normalized_markdown);

    info!(
        "Successfully converted to Markdown ({} bytes)",
        cleaned_markdown.len()
    );
    Ok(cleaned_markdown)
}

#[must_use]
pub fn select_html(html: &str, selector_str: &str) -> Option<String> {
    let selector = Selector::parse(selector_str).ok()?;
    let document = Html::parse_document(html);
    document
        .select(&selector)
        .next()
        .map(|element| element.html())
}

/// Clean HTML content before Markdown conversion
///
/// Removes scripts, styles, and other elements that shouldn't be in Markdown.
fn clean_html(html: &str) -> String {
    debug!("Cleaning HTML for Markdown conversion");

    let document = Html::parse_document(html);

    // Create a mutable string to build our cleaned HTML
    let mut cleaned = html.to_string();

    // Remove script tags
    if let Ok(selector) = Selector::parse("script") {
        for element in document.select(&selector) {
            let outer_html = element.html();
            cleaned = cleaned.replace(&outer_html, "");
        }
    }

    // Remove style tags
    if let Ok(selector) = Selector::parse("style") {
        for element in document.select(&selector) {
            let outer_html = element.html();
            cleaned = cleaned.replace(&outer_html, "");
        }
    }

    // Remove noscript tags
    if let Ok(selector) = Selector::parse("noscript") {
        for element in document.select(&selector) {
            let outer_html = element.html();
            cleaned = cleaned.replace(&outer_html, "");
        }
    }

    cleaned
}

/// Unwrap `<ol><li><hN>...</hN></li></ol>` when the heading text already
/// carries a leading number (e.g. "13. Foo"), and replace such a list with the
/// bare heading. Without this, `html2md` restarts ordered-list numbering at
/// "1." and the document loses the original section number.
///
/// Also lifts a leading "13. " out of an inner `<strong>` so html2md emits
/// `#### 13. Foo` (matchable by the test) rather than `#### **13. Foo**`.
fn preserve_leading_heading_numbering(html: &str) -> String {
    let pattern = Regex::new(
        r"(?is)<ol\b[^>]*>\s*<li\b[^>]*>\s*(<h[1-6]\b[^>]*>(?:.*?)</h[1-6]>)\s*</li>\s*</ol>",
    )
    .expect("valid regex");
    let leading_number_in_strong =
        Regex::new(r"(?is)(<h[1-6]\b[^>]*>)\s*<strong\b[^>]*>\s*(\d+\.\s+)([\s\S]*?)</strong>")
            .expect("valid regex");
    let leading_number_plain = Regex::new(r"(?is)<h[1-6]\b[^>]*>\s*\d+\.\s").expect("valid regex");

    let unwrapped = pattern
        .replace_all(html, |caps: &regex::Captures<'_>| {
            let heading = &caps[1];
            if leading_number_in_strong.is_match(heading) || leading_number_plain.is_match(heading)
            {
                heading.to_string()
            } else {
                caps[0].to_string()
            }
        })
        .into_owned();

    leading_number_in_strong
        .replace_all(&unwrapped, |caps: &regex::Captures<'_>| {
            let open = &caps[1];
            let number = &caps[2];
            let inner = &caps[3];
            format!("{open}{number}<strong>{inner}</strong>")
        })
        .into_owned()
}

/// Move `<img>` tags out of `<h1>`..`<h6>` elements.
///
/// Rewrites `<hN>...<img ...>...text</hN>` →
/// `<hN>...text</hN>\n<p><img ...></p>` so that any HTML→Markdown
/// converter sees the images at block level.
fn hoist_images_from_headings(html: &str) -> String {
    use std::fmt::Write;

    let img_re = Regex::new(r"<img\s[^>]*>").expect("valid regex");
    let mut result = html.to_string();

    for level in 1..=6 {
        let heading_re = Regex::new(&format!(r"(?si)(<h{level}\b[^>]*>)(.*?)(</h{level}>)"))
            .expect("valid regex");

        result = heading_re
            .replace_all(&result, |caps: &regex::Captures<'_>| {
                let open = &caps[1];
                let inner = &caps[2];
                let close = &caps[3];

                let imgs: Vec<&str> = img_re.find_iter(inner).map(|m| m.as_str()).collect();

                if imgs.is_empty() {
                    return caps[0].to_string();
                }

                let stripped = img_re.replace_all(inner, "").to_string();
                let mut out = format!("{open}{stripped}{close}");
                for img in imgs {
                    write!(out, "\n<p>{img}</p>").expect("write to String");
                }
                out
            })
            .into_owned();
    }

    result
}

/// Walk every top-level `<ol>` in document order and return the number that
/// each direct `<li>` child should carry. Without an explicit `start="N"`,
/// lists continue the running counter from the previous list (e.g. 1, 2 then
/// 3, 4 across two consecutive `<ol>`s). With `start="N"`, the counter resets
/// to `N` for that list and subsequent lists continue from there.
///
/// Top-level here means "not nested inside another `<ol>` or `<ul>`" — nested
/// lists keep their own per-list numbering, matching `html2md`'s default.
fn compute_top_level_ordered_list_item_numbers(html: &str) -> Vec<u32> {
    let document = Html::parse_document(html);
    let Ok(ol_selector) = Selector::parse("ol") else {
        return Vec::new();
    };
    let mut numbers = Vec::new();
    let mut counter: u32 = 1;
    for ol in document.select(&ol_selector) {
        let nested = ol.ancestors().any(|n| {
            n.value()
                .as_element()
                .is_some_and(|e| e.name() == "ol" || e.name() == "ul")
        });
        if nested {
            continue;
        }
        if let Some(start) = ol
            .value()
            .attr("start")
            .and_then(|s| s.trim().parse::<u32>().ok())
        {
            counter = start;
        }
        let li_count = ol
            .children()
            .filter(|n| n.value().as_element().is_some_and(|e| e.name() == "li"))
            .count();
        for _ in 0..li_count {
            numbers.push(counter);
            counter = counter.saturating_add(1);
        }
    }
    numbers
}

/// Replace the prefix of each unindented `^\d+\.\s` line in `markdown` with
/// the next number from `numbers`, in document order. Indented lines (nested
/// list items) are skipped so `html2md`'s per-list "1." restart for nested
/// levels is preserved. Setext heading underlines (`====` / `----`) are
/// detected so a `1. Headings` line followed by an underline is not treated
/// as a list item. Lines beyond the end of `numbers` are left untouched.
fn renumber_top_level_ordered_list_lines(markdown: &str, numbers: &[u32]) -> String {
    use std::fmt::Write;

    let item_re = Regex::new(r"^(\d+)\.(\s)").expect("valid regex");
    let setext_re = Regex::new(r"^(=+|-+)\s*$").expect("valid regex");
    let lines: Vec<&str> = markdown.split_inclusive('\n').collect();
    let mut out = String::with_capacity(markdown.len());
    let mut idx: usize = 0;

    for (i, line) in lines.iter().enumerate() {
        let body = line.strip_suffix('\n').unwrap_or(line);
        if let Some(caps) = item_re.captures(body) {
            let next_body = lines
                .get(i + 1)
                .map_or("", |l| l.strip_suffix('\n').unwrap_or(l));
            let is_setext_heading = setext_re.is_match(next_body);
            if !is_setext_heading {
                if let Some(&n) = numbers.get(idx) {
                    let after = &body[caps.get(0).expect("match 0").end()..];
                    let sep = caps.get(2).expect("group 2").as_str();
                    write!(out, "{n}.{sep}{after}").expect("write to String");
                    if line.ends_with('\n') {
                        out.push('\n');
                    }
                    idx += 1;
                    continue;
                }
            }
        }
        out.push_str(line);
    }
    out
}

/// Clean up Markdown output
///
/// Removes excessive whitespace and normalizes the output.
pub fn clean_markdown(markdown: &str) -> String {
    debug!("Cleaning Markdown output");

    // Remove excessive blank lines (more than 2 consecutive newlines)
    let mut result = markdown.to_string();

    // Replace multiple consecutive newlines with at most two
    while result.contains("\n\n\n") {
        result = result.replace("\n\n\n", "\n\n");
    }

    // Trim leading and trailing whitespace
    result = result.trim().to_string();

    // Ensure the document ends with a newline
    if !result.is_empty() && !result.ends_with('\n') {
        result.push('\n');
    }

    result
}
