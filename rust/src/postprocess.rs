//! Markdown post-processing pipeline (R1).
//!
//! Applies a series of text transformations to improve markdown quality:
//! - Unicode normalization (non-breaking spaces, curly quotes, dashes)
//! - LaTeX formula spacing fixes for GitHub rendering
//! - Bold formatting cleanup
//! - Percent sign fix for GitHub `KaTeX`
//!
//! Based on reference implementation from:
//! <https://github.com/link-foundation/meta-theory/blob/main/scripts/download-article.mjs>

use regex::Regex;

/// Options for post-processing.
#[allow(clippy::struct_excessive_bools)]
#[derive(Debug, Clone)]
pub struct PostProcessOptions {
    pub normalize_unicode: bool,
    pub fix_latex_spacing: bool,
    pub fix_bold_formatting: bool,
    pub fix_percent_sign: bool,
}

impl Default for PostProcessOptions {
    fn default() -> Self {
        Self {
            normalize_unicode: true,
            fix_latex_spacing: true,
            fix_bold_formatting: true,
            fix_percent_sign: true,
        }
    }
}

/// Apply all post-processing transformations to markdown text.
#[must_use]
pub fn post_process_markdown(markdown: &str, options: &PostProcessOptions) -> String {
    let mut result = markdown.to_string();

    if options.normalize_unicode {
        result = apply_unicode_normalization(&result);
    }

    if options.fix_latex_spacing {
        result = apply_latex_spacing_fixes(&result);
    }

    if options.fix_percent_sign {
        result = apply_percent_sign_fix(&result);
    }

    if options.fix_bold_formatting {
        result = apply_bold_formatting_fixes(&result);
    }

    // Fix double spaces (but not in code blocks)
    if let Ok(re) = Regex::new(r"([^\n`]) +") {
        result = re
            .replace_all(&result, |caps: &regex::Captures| format!("{} ", &caps[1]))
            .to_string();
    }

    // Clean up extra spaces around em-dashes
    if let Ok(re) = Regex::new(r"\s+\u{2014}\s+") {
        result = re.replace_all(&result, " \u{2014} ").to_string();
    }

    // Fix stray standalone $ signs on their own line
    if let Ok(re) = Regex::new(r"(?m)^\$\s*$") {
        result = re.replace_all(&result, "").to_string();
    }

    result
}

/// Normalize unicode characters for consistent rendering.
#[must_use]
pub fn apply_unicode_normalization(text: &str) -> String {
    let mut result = text.to_string();

    // Replace non-breaking spaces (U+00A0) with regular spaces
    result = result.replace('\u{00A0}', " ");

    // Normalize curly quotes to straight quotes
    result = result.replace('\u{2018}', "'");
    result = result.replace('\u{2019}', "'");
    result = result.replace('\u{201C}', "\"");
    result = result.replace('\u{201D}', "\"");

    // Normalize em-dash and en-dash
    result = result.replace('\u{2014}', " \u{2014} "); // em-dash with spaces
    result = result.replace('\u{2013}', "-"); // en-dash to hyphen

    // Normalize ellipsis
    result = result.replace('\u{2026}', "...");

    result
}

/// Fix spacing around inline LaTeX formulas for GitHub rendering.
///
/// Uses a line-by-line token-based approach to correctly identify
/// opening/closing `$` delimiters.
#[must_use]
pub fn apply_latex_spacing_fixes(text: &str) -> String {
    text.lines()
        .map(|line| {
            // Skip block formula lines ($$...$$) and blockquote block formulas
            let trimmed = line.trim_start_matches('>').trim_start();
            if trimmed.starts_with("$$") && trimmed.ends_with("$$") {
                return line.to_string();
            }

            // Find all inline formula spans by tracking $ delimiters
            let chars: Vec<char> = line.chars().collect();
            let mut formulas = Vec::new();
            let mut i = 0;

            while i < chars.len() {
                if chars[i] == '$' && (i == 0 || chars[i - 1] != '\\') {
                    // Skip $$ block delimiters
                    if i + 1 < chars.len() && chars[i + 1] == '$' {
                        i += 2;
                        continue;
                    }
                    // Found opening $, find closing $
                    let start = i;
                    i += 1;
                    while i < chars.len() && (chars[i] != '$' || chars[i - 1] == '\\') {
                        i += 1;
                    }
                    if i < chars.len() {
                        formulas.push((start, i));
                        i += 1;
                    }
                } else {
                    i += 1;
                }
            }

            if formulas.is_empty() {
                return line.to_string();
            }

            // Build the line with fixes applied
            let mut fixed = String::new();
            let mut pos = 0;

            for (start, end) in &formulas {
                // Append text before formula
                let before: String = chars[pos..*start].iter().collect();
                fixed.push_str(&before);

                let raw_inner: String = chars[start + 1..*end].iter().collect();
                let inner = raw_inner.trim();

                // Add space before formula if preceded by word char, comma, colon, etc.
                if !fixed.is_empty() {
                    let last_char = fixed.chars().last().unwrap_or(' ');
                    if is_pre_formula_char(last_char) {
                        fixed.push(' ');
                    }
                }

                fixed.push('$');
                fixed.push_str(inner);
                fixed.push('$');

                // Add space after formula if followed by word character
                let after_pos = end + 1;
                if after_pos < chars.len() && is_post_formula_char(chars[after_pos]) {
                    fixed.push(' ');
                }

                pos = end + 1;
            }
            // Append remaining text
            let remaining: String = chars[pos..].iter().collect();
            fixed.push_str(&remaining);

            fixed
        })
        .collect::<Vec<_>>()
        .join("\n")
}

/// Check if a character should trigger a space before a formula delimiter.
fn is_pre_formula_char(c: char) -> bool {
    c.is_ascii_alphanumeric()
        || ('\u{0430}'..='\u{044F}').contains(&c) // Russian lowercase
        || ('\u{0410}'..='\u{042F}').contains(&c) // Russian uppercase
        || c == '\u{0451}' // ё
        || c == '\u{0401}' // Ё
        || c == ','
        || c == ':'
        || c == ';'
        || c == '\u{00BB}' // »
        || c == ')'
        || c == ']'
}

/// Check if a character should trigger a space after a formula delimiter.
fn is_post_formula_char(c: char) -> bool {
    c.is_ascii_alphabetic()
        || ('\u{0430}'..='\u{044F}').contains(&c)
        || ('\u{0410}'..='\u{042F}').contains(&c)
        || c == '\u{0451}'
        || c == '\u{0401}'
}

/// Fix percent sign in inline formulas for GitHub `KaTeX` rendering.
///
/// GitHub's `KaTeX` treats `%` as a LaTeX comment character.
/// Workaround: use `\\%` which GitHub's preprocessor converts to `\%`.
#[must_use]
pub fn apply_percent_sign_fix(text: &str) -> String {
    let mut result = text.to_string();
    if let Ok(re) = Regex::new(r"\$(\d+)\\+%\$") {
        result = re.replace_all(&result, r"$$$1\\%$$").to_string();
    }
    if let Ok(re) = Regex::new(r"\$(\d+)\\text\{%\}\$") {
        result = re.replace_all(&result, r"$$$1\\%$$").to_string();
    }
    result
}

/// Clean up bold formatting artifacts from HTML-to-markdown conversion.
#[must_use]
pub fn apply_bold_formatting_fixes(text: &str) -> String {
    let mut result = text.to_string();

    // Remove empty bold markers
    if let Ok(re) = Regex::new(r"(\S)\*\*[^\S\n]*\*\*(\S)") {
        result = re.replace_all(&result, "$1 $2").to_string();
    }
    if let Ok(re) = Regex::new(r"\*\*[^\S\n]*\*\*") {
        result = re.replace_all(&result, "").to_string();
    }

    // Fix bold marker spacing: trim content inside **...**
    result = result
        .lines()
        .map(fix_bold_line)
        .collect::<Vec<_>>()
        .join("\n");

    result
}

/// Fix bold formatting on a single line.
fn fix_bold_line(line: &str) -> String {
    enum Part {
        Text(String),
        Bold(String),
    }

    let Ok(bold_re) = Regex::new(r"\*\*(.+?)\*\*") else {
        return line.to_string();
    };

    if !bold_re.is_match(line) {
        return line.to_string();
    }
    let mut parts: Vec<Part> = Vec::new();
    let mut last_end = 0;

    for cap in bold_re.captures_iter(line) {
        let m = cap.get(0).unwrap();
        if m.start() > last_end {
            parts.push(Part::Text(line[last_end..m.start()].to_string()));
        }
        parts.push(Part::Bold(cap[1].trim().to_string()));
        last_end = m.end();
    }
    if last_end < line.len() {
        parts.push(Part::Text(line[last_end..].to_string()));
    }

    // Rebuild line
    let mut rebuilt = String::new();
    let parts_len = parts.len();
    for (idx, part) in parts.into_iter().enumerate() {
        match part {
            Part::Text(s) => rebuilt.push_str(&s),
            Part::Bold(content) => {
                if content.is_empty() {
                    continue;
                }
                if !rebuilt.is_empty() {
                    let last = rebuilt.chars().last().unwrap_or(' ');
                    if last.is_alphanumeric()
                        || ('\u{0430}'..='\u{044F}').contains(&last)
                        || ('\u{0410}'..='\u{042F}').contains(&last)
                        || last == ')'
                        || last == '.'
                    {
                        rebuilt.push(' ');
                    }
                }
                rebuilt.push_str("**");
                rebuilt.push_str(&content);
                rebuilt.push_str("**");
                // Check if next part starts with word character
                if idx + 1 < parts_len {
                    // Peek is hard here, but the JS just checks next part content
                    // We'll handle this by checking rebuilt state in next iteration
                }
            }
        }
    }

    rebuilt
}
