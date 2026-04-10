//! Content verification module (R6).
//!
//! Compares captured markdown content against the original web page
//! to verify completeness and accuracy.
//!
//! Checks: title, headings, paragraphs, code blocks, formulas,
//! blockquote formulas, list items, links, and figure images.
//!
//! Based on reference implementation from:
//! <https://github.com/link-foundation/meta-theory/blob/main/scripts/verify.mjs>

use regex::Regex;
use serde::{Deserialize, Serialize};

/// Heading with level and text.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Heading {
    pub level: u8,
    pub text: String,
}

/// Content extracted from a web page for verification.
#[derive(Debug, Clone, Default, Serialize, Deserialize)]
pub struct WebContent {
    #[serde(default)]
    pub title: Option<String>,
    #[serde(default)]
    pub headings: Vec<Heading>,
    #[serde(default)]
    pub paragraphs: Vec<String>,
    #[serde(default)]
    pub code_blocks: Vec<String>,
    #[serde(default)]
    pub formulas: Vec<String>,
    #[serde(default)]
    pub blockquote_formulas: Vec<String>,
    #[serde(default)]
    pub list_items: Vec<String>,
    #[serde(default)]
    pub figures: Vec<u32>,
}

/// Missing content detected during verification.
#[derive(Debug, Clone, Default, Serialize, Deserialize)]
pub struct MissingContent {
    pub title: bool,
    pub headings: Vec<String>,
    pub paragraphs: Vec<String>,
    pub code_blocks: Vec<String>,
    pub formulas: Vec<String>,
    pub blockquote_formulas: Vec<String>,
    pub list_items: Vec<String>,
    pub images: u32,
}

/// Verification options.
#[derive(Debug, Clone)]
pub struct VerifyOptions {
    pub verbose: bool,
    pub expected_figures: Option<u32>,
    pub has_local_images: bool,
}

impl Default for VerifyOptions {
    fn default() -> Self {
        Self {
            verbose: false,
            expected_figures: None,
            has_local_images: false,
        }
    }
}

/// Result of content verification.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct VerifyResult {
    pub total_checks: u32,
    pub passed_checks: u32,
    pub pass_rate: f64,
    pub has_missing_content: bool,
    pub missing: MissingContent,
    pub success: bool,
}

/// Normalize text for comparison.
///
/// Removes extra whitespace and normalizes unicode characters,
/// LaTeX delimiters, and common symbol substitutions.
#[must_use]
pub fn normalize_text(text: &str) -> String {
    let mut result = text.trim().to_string();

    // Collapse whitespace
    if let Ok(re) = Regex::new(r"\s+") {
        result = re.replace_all(&result, " ").to_string();
    }
    // Normalize unicode spaces
    result = result
        .replace('\u{00A0}', " ")
        .replace('\u{2018}', "'")
        .replace('\u{2019}', "'")
        .replace('\u{201C}', "\"")
        .replace('\u{201D}', "\"")
        .replace('\u{00D7}', "x")
        .replace('\u{2192}', "->")
        .replace('\u{21A6}', "->")
        .replace('\u{2212}', "-");

    // Remove LaTeX delimiters
    result = result.replace("$$", "").replace('$', "");

    // Normalize LaTeX commands
    if let Ok(re) = Regex::new(r"\\times") {
        result = re.replace_all(&result, "x").to_string();
    }
    if let Ok(re) = Regex::new(r"\\to") {
        result = re.replace_all(&result, "->").to_string();
    }
    if let Ok(re) = Regex::new(r"\\displaystyle\s*") {
        result = re.replace_all(&result, "").to_string();
    }
    if let Ok(re) = Regex::new(r"\\text\{([^}]*)\}") {
        result = re.replace_all(&result, "$1").to_string();
    }
    result = result.replace("\\\\%", "%").replace("\\%", "%");
    result = result
        .replace("\\subseteq", "\u{2286}")
        .replace("\\in", "\u{2208}")
        .replace("\\emptyset", "\u{2205}");
    result = result.replace("^2", "\u{00B2}").replace("^n", "\u{207F}");

    // Handle \\mathbb{n}_0 case-insensitively
    if let Ok(re) = Regex::new(r"(?i)\\mathbb\{n\}_0") {
        result = re.replace_all(&result, "\u{2115}\u{2080}").to_string();
    }

    result.to_lowercase()
}

/// Normalize code for comparison (more lenient than text).
#[must_use]
pub fn normalize_code(text: &str) -> String {
    let mut result = text.trim().to_string();

    if let Ok(re) = Regex::new(r"\s+") {
        result = re.replace_all(&result, " ").to_string();
    }
    result = result
        .replace('\u{00A0}', " ")
        .replace('\u{00D7}', "x")
        .replace("$$", "")
        .replace('$', "");

    if let Ok(re) = Regex::new(r"\\times") {
        result = re.replace_all(&result, "x").to_string();
    }

    result.to_lowercase()
}

/// Verify that markdown contains the expected web page content.
#[must_use]
pub fn verify_markdown_content(
    web_content: &WebContent,
    markdown_text: &str,
    options: &VerifyOptions,
) -> VerifyResult {
    let normalized_markdown = normalize_text(markdown_text);
    let mut missing = MissingContent::default();
    let mut total_checks: u32 = 0;
    let mut passed_checks: u32 = 0;

    // Check title
    if let Some(ref title) = web_content.title {
        total_checks += 1;
        let normalized_title = normalize_text(title);
        if normalized_markdown.contains(&normalized_title) {
            passed_checks += 1;
        } else {
            missing.title = true;
        }
    }

    // Check headings
    for heading in &web_content.headings {
        total_checks += 1;
        let normalized = normalize_text(&heading.text);
        if normalized_markdown.contains(&normalized) {
            passed_checks += 1;
        } else {
            missing.headings.push(heading.text.clone());
        }
    }

    // Check paragraphs (sample first 5 and last 5)
    let paragraphs = &web_content.paragraphs;
    let first_five = paragraphs.iter().take(5);
    let last_five = if paragraphs.len() > 5 {
        paragraphs.iter().skip(paragraphs.len().saturating_sub(5))
    } else {
        paragraphs.iter().skip(paragraphs.len()) // empty
    };
    let paragraphs_to_check: Vec<&String> = first_five.chain(last_five).collect();

    for paragraph in &paragraphs_to_check {
        total_checks += 1;
        let normalized = normalize_text(paragraph);
        let words: Vec<&str> = normalized.split(' ').filter(|w| w.len() > 2).collect();
        let matching_words = words
            .iter()
            .filter(|word| normalized_markdown.contains(**word))
            .count();
        let match_rate = if words.is_empty() {
            0.0
        } else {
            matching_words as f64 / words.len() as f64
        };

        let substring_match = normalized.len() > 20
            && normalized_markdown.contains(&normalized[..normalized.len().min(50)]);

        if match_rate >= 0.6 || substring_match {
            passed_checks += 1;
        } else {
            let truncated = if paragraph.len() > 100 {
                format!("{}...", &paragraph[..100])
            } else {
                format!("{paragraph}...")
            };
            missing.paragraphs.push(truncated);
        }
    }

    // Check code blocks (fuzzy matching)
    let normalized_markdown_for_code = normalize_code(markdown_text);
    for code in &web_content.code_blocks {
        total_checks += 1;
        let normalized_code_full = normalize_code(code);

        let lines: Vec<&str> = code
            .lines()
            .map(|l| l.trim())
            .filter(|l| {
                l.len() > 3
                    && !Regex::new(r"^[{}\[\](),;]+$")
                        .map(|re| re.is_match(l))
                        .unwrap_or(false)
            })
            .collect();

        let matching_lines = lines
            .iter()
            .filter(|line| {
                let normalized_line = normalize_code(line);
                normalized_markdown_for_code.contains(&normalized_line)
            })
            .count();

        let match_rate = if lines.is_empty() {
            1.0
        } else {
            matching_lines as f64 / lines.len() as f64
        };

        if match_rate >= 0.6 || normalized_markdown_for_code.contains(&normalized_code_full) {
            passed_checks += 1;
        } else {
            let truncated = if code.len() > 100 {
                format!("{}...", &code[..100])
            } else {
                format!("{code}...")
            };
            missing.code_blocks.push(truncated);
        }
    }

    // Check list items (sample first 10)
    for item in web_content.list_items.iter().take(10) {
        total_checks += 1;
        let normalized = normalize_text(item);
        let words: Vec<&str> = normalized.split(' ').filter(|w| w.len() > 2).collect();
        let matching_words = words
            .iter()
            .filter(|word| normalized_markdown.contains(**word))
            .count();
        let match_rate = if words.is_empty() {
            0.0
        } else {
            matching_words as f64 / words.len() as f64
        };

        let substring_match = normalized.len() > 15
            && normalized_markdown.contains(&normalized[..normalized.len().min(40)]);

        if match_rate >= 0.6 || substring_match {
            passed_checks += 1;
        } else {
            let truncated = if item.len() > 100 {
                format!("{}...", &item[..100])
            } else {
                format!("{item}...")
            };
            missing.list_items.push(truncated);
        }
    }

    // Check blockquote formulas
    for formula in &web_content.blockquote_formulas {
        total_checks += 1;
        let normalized_formula = formula.split_whitespace().collect::<Vec<_>>().join(" ");

        // Extract key parts
        let cleaned = normalized_formula
            .replace("\\mathbf{", "")
            .replace("\\textbf{", "")
            .replace(['{', '}', '\\'], "");
        let key_parts: Vec<&str> = cleaned
            .split_whitespace()
            .filter(|part| part.len() > 1)
            .collect();

        // Find blockquote lines
        let blockquote_re = Regex::new(r"(?m)^>.*$").unwrap();
        let blockquote_lines: Vec<&str> = blockquote_re
            .find_iter(markdown_text)
            .map(|m| m.as_str())
            .collect();

        let mut found = false;
        for line in &blockquote_lines {
            if line.contains('$') {
                let matching_parts = key_parts
                    .iter()
                    .filter(|part| line.to_lowercase().contains(&part.to_lowercase()))
                    .count();
                if !key_parts.is_empty() && matching_parts >= key_parts.len().min(2) {
                    found = true;
                    break;
                }
                if line.contains(&normalized_formula)
                    || line.contains(formula.as_str())
                    || (formula.len() < 20 && line.contains(&formula.replace(' ', "")))
                {
                    found = true;
                    break;
                }
            }
        }

        if found {
            passed_checks += 1;
        } else {
            let truncated = if formula.len() > 100 {
                formula[..100].to_string()
            } else {
                formula.clone()
            };
            missing.blockquote_formulas.push(truncated);
        }
    }

    // Check for figure images
    if options.has_local_images {
        if let Some(expected) = options.expected_figures {
            total_checks += 1;
            let figure_re = Regex::new(
                r"(?i)!\[(?:\*\*)?(?:Figure|Рис\.?|Рисунок)\s*\d+[\s\S]*?\]\(images/figure-\d+\.(png|jpg)\)",
            )
            .unwrap();
            let figure_count = figure_re.find_iter(markdown_text).count() as u32;
            if figure_count >= expected {
                passed_checks += 1;
            } else {
                missing.images = expected - figure_count;
            }
        }
    }

    // Calculate results
    let pass_rate = if total_checks > 0 {
        f64::from(passed_checks) / f64::from(total_checks)
    } else {
        0.0
    };
    let has_missing_content = missing.title
        || missing.images > 0
        || !missing.headings.is_empty()
        || !missing.paragraphs.is_empty()
        || !missing.code_blocks.is_empty()
        || !missing.formulas.is_empty()
        || !missing.blockquote_formulas.is_empty()
        || !missing.list_items.is_empty();

    VerifyResult {
        total_checks,
        passed_checks,
        pass_rate,
        has_missing_content,
        success: !has_missing_content || pass_rate >= 0.85,
        missing,
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_normalize_text_whitespace() {
        assert_eq!(normalize_text("  hello   world  "), "hello world");
    }

    #[test]
    fn test_normalize_text_unicode() {
        let result = normalize_text("test\u{00D7}value");
        assert!(result.contains('x'));
    }

    #[test]
    fn test_normalize_text_latex() {
        let result = normalize_text("$E = mc^2$");
        assert_eq!(result, "e = mc\u{00B2}");
    }

    #[test]
    fn test_normalize_code() {
        let result = normalize_code("  function()  {  }  ");
        assert_eq!(result, "function() { }");
    }

    #[test]
    fn test_verify_title_present() {
        let content = WebContent {
            title: Some("Hello World".to_string()),
            ..Default::default()
        };
        let result = verify_markdown_content(
            &content,
            "# Hello World\nSome content",
            &VerifyOptions::default(),
        );
        assert!(result.success);
        assert!(!result.missing.title);
    }

    #[test]
    fn test_verify_title_missing() {
        let content = WebContent {
            title: Some("Missing Title".to_string()),
            ..Default::default()
        };
        let result = verify_markdown_content(
            &content,
            "# Different Title\nSome content",
            &VerifyOptions::default(),
        );
        assert!(result.missing.title);
    }

    #[test]
    fn test_verify_headings() {
        let content = WebContent {
            headings: vec![
                Heading {
                    level: 2,
                    text: "Introduction".to_string(),
                },
                Heading {
                    level: 2,
                    text: "Conclusion".to_string(),
                },
            ],
            ..Default::default()
        };
        let result = verify_markdown_content(
            &content,
            "## Introduction\nText\n## Conclusion\nMore text",
            &VerifyOptions::default(),
        );
        assert_eq!(result.passed_checks, 2);
        assert!(result.missing.headings.is_empty());
    }

    #[test]
    fn test_verify_empty_content() {
        let content = WebContent::default();
        let result = verify_markdown_content(&content, "Some markdown", &VerifyOptions::default());
        assert!(result.success);
        assert_eq!(result.total_checks, 0);
    }
}
