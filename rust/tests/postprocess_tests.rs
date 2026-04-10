use web_capture::postprocess::{
    apply_bold_formatting_fixes, apply_latex_spacing_fixes, apply_percent_sign_fix,
    apply_unicode_normalization, post_process_markdown, PostProcessOptions,
};

#[test]
fn test_unicode_normalization_nbsp() {
    let result = apply_unicode_normalization("hello\u{00A0}world");
    assert_eq!(result, "hello world");
}

#[test]
fn test_unicode_normalization_curly_quotes() {
    let result = apply_unicode_normalization("\u{201C}hello\u{201D}");
    assert_eq!(result, "\"hello\"");
}

#[test]
fn test_unicode_normalization_ellipsis() {
    let result = apply_unicode_normalization("wait\u{2026}");
    assert_eq!(result, "wait...");
}

#[test]
fn test_latex_spacing_adds_space_before() {
    let result = apply_latex_spacing_fixes("where$x$is");
    assert!(result.contains("where $x$ is"));
}

#[test]
fn test_latex_spacing_skips_block_formulas() {
    let input = "$$E = mc^2$$";
    let result = apply_latex_spacing_fixes(input);
    assert_eq!(result, input);
}

#[test]
fn test_latex_spacing_handles_no_formulas() {
    let input = "Just plain text";
    let result = apply_latex_spacing_fixes(input);
    assert_eq!(result, input);
}

#[test]
fn test_percent_sign_fix() {
    let result = apply_percent_sign_fix("$50\\%$");
    assert!(result.contains("\\\\%"));
}

#[test]
fn test_bold_formatting_empty_bold() {
    let result = apply_bold_formatting_fixes("before**  **after");
    assert!(!result.contains("****"));
}

#[test]
fn test_post_process_markdown_full() {
    let input = "hello\u{00A0}world\nwhere$x$is\nwait\u{2026}";
    let result = post_process_markdown(input, &PostProcessOptions::default());
    assert!(result.contains("hello world"));
    assert!(result.contains("wait..."));
}
