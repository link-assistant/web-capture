//! xpaste.pro URL helpers shared by the CLI and HTTP server.

use url::Url;

pub const INLINE_MARKDOWN_LINE_LIMIT: usize = 1500;

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct TextPasteUrl {
    pub paste_id: String,
    path_prefix: String,
}

#[must_use]
pub fn is_text_paste_url(url: &str) -> bool {
    parse_text_paste_url(url).is_some()
}

#[must_use]
pub fn normalize_url_for_text_content(url: &str) -> String {
    parse_text_paste_url(url).map_or_else(
        || url.to_string(),
        |paste| {
            format!(
                "https://xpaste.pro{}/p/{}/raw",
                paste.path_prefix, paste.paste_id
            )
        },
    )
}

#[must_use]
pub fn normalize_url_for_text_page(url: &str) -> String {
    parse_text_paste_url(url).map_or_else(
        || url.to_string(),
        |paste| {
            format!(
                "https://xpaste.pro{}/p/{}",
                paste.path_prefix, paste.paste_id
            )
        },
    )
}

#[must_use]
pub fn paste_id(url: &str) -> Option<String> {
    parse_text_paste_url(url).map(|paste| paste.paste_id)
}

#[must_use]
pub fn filename_for_text_url(url: &str) -> String {
    if let Some(paste) = parse_text_paste_url(url) {
        return format!("xpaste-pro-{}.txt", paste.paste_id);
    }

    Url::parse(url).map_or_else(
        |_| "download.txt".to_string(),
        |parsed| {
            let host = parsed.host_str().unwrap_or("download").replace('.', "-");
            let path = parsed
                .path()
                .trim_matches('/')
                .replace('/', "-")
                .replace("-raw", "");
            if path.is_empty() {
                format!("{host}.txt")
            } else {
                format!("{host}-{path}.txt")
            }
        },
    )
}

#[must_use]
pub fn append_text_attachment_markdown(markdown: &str, url: &str, raw_text: &str) -> String {
    let filename = filename_for_text_url(url);
    let normalized_raw_text = normalize_attachment_text(raw_text);
    let fence = markdown_fence_for(&normalized_raw_text);
    let mut result = String::with_capacity(markdown.len() + normalized_raw_text.len() + 128);
    result.push_str(markdown.trim_end());
    result.push_str("\n\n## ");
    result.push_str(&filename);
    result.push_str("\n\n");
    result.push_str(&fence);
    result.push_str("text\n");
    result.push_str(&normalized_raw_text);
    if !normalized_raw_text.ends_with('\n') {
        result.push('\n');
    }
    result.push_str(&fence);
    result.push('\n');
    result
}

fn normalize_attachment_text(text: &str) -> String {
    text.replace("\r\n", "\n").replace('\r', "\n")
}

fn markdown_fence_for(text: &str) -> String {
    let mut longest_run = 0;
    let mut current_run = 0;
    for ch in text.chars() {
        if ch == '`' {
            current_run += 1;
            longest_run = longest_run.max(current_run);
        } else {
            current_run = 0;
        }
    }
    "`".repeat((longest_run + 1).max(3))
}

fn parse_text_paste_url(url: &str) -> Option<TextPasteUrl> {
    let parsed = Url::parse(url).ok()?;
    let host = parsed.host_str()?.to_ascii_lowercase();
    if host != "xpaste.pro" && host != "www.xpaste.pro" {
        return None;
    }

    let parts: Vec<&str> = parsed.path_segments()?.collect();
    let index = parts.iter().position(|part| *part == "p")?;
    let mut path_prefix = String::new();
    if index == 1 && matches!(parts.first(), Some(&("en" | "ru"))) {
        path_prefix = format!("/{}", parts[0]);
    } else if index != 0 {
        return None;
    }

    let paste_id = parts.get(index + 1)?.to_string();
    if paste_id.is_empty() {
        return None;
    }

    let tail = &parts[index + 2..];
    if tail.len() > 1 || tail.first().is_some_and(|part| *part != "raw") {
        return None;
    }

    Some(TextPasteUrl {
        paste_id,
        path_prefix,
    })
}

#[cfg(test)]
mod tests {
    use super::{
        append_text_attachment_markdown, filename_for_text_url, is_text_paste_url,
        normalize_url_for_text_content, normalize_url_for_text_page,
    };

    #[test]
    fn normalizes_xpaste_urls_to_raw_text() {
        assert_eq!(
            normalize_url_for_text_content("https://xpaste.pro/p/t4q0Lsp0"),
            "https://xpaste.pro/p/t4q0Lsp0/raw"
        );
        assert_eq!(
            normalize_url_for_text_content("https://xpaste.pro/ru/p/t4q0Lsp0"),
            "https://xpaste.pro/ru/p/t4q0Lsp0/raw"
        );
        assert_eq!(
            normalize_url_for_text_content("https://xpaste.pro/en/p/t4q0Lsp0/raw"),
            "https://xpaste.pro/en/p/t4q0Lsp0/raw"
        );
    }

    #[test]
    fn normalizes_xpaste_raw_urls_to_visual_page() {
        assert_eq!(
            normalize_url_for_text_page("https://xpaste.pro/p/t4q0Lsp0/raw"),
            "https://xpaste.pro/p/t4q0Lsp0"
        );
        assert_eq!(
            normalize_url_for_text_page("https://xpaste.pro/ru/p/t4q0Lsp0/raw"),
            "https://xpaste.pro/ru/p/t4q0Lsp0"
        );
        assert_eq!(
            normalize_url_for_text_page("https://example.com/page"),
            "https://example.com/page"
        );
    }

    #[test]
    fn detects_only_supported_xpaste_paste_urls() {
        assert!(is_text_paste_url("https://xpaste.pro/p/t4q0Lsp0"));
        assert!(is_text_paste_url("https://xpaste.pro/ru/p/t4q0Lsp0"));
        assert!(is_text_paste_url("https://xpaste.pro/en/p/t4q0Lsp0"));
        assert!(!is_text_paste_url("https://xpaste.pro/about"));
        assert!(!is_text_paste_url("https://xpaste.pro/foo/p/t4q0Lsp0"));
        assert!(!is_text_paste_url(
            "https://xpaste.pro/p/t4q0Lsp0/raw/extra"
        ));
        assert!(!is_text_paste_url("https://example.com/p/t4q0Lsp0"));
        assert!(!is_text_paste_url("not a url"));
    }

    #[test]
    fn derives_text_download_filename() {
        assert_eq!(
            filename_for_text_url("https://xpaste.pro/p/t4q0Lsp0"),
            "xpaste-pro-t4q0Lsp0.txt"
        );
    }

    #[test]
    fn embeds_raw_text_as_named_markdown_attachment() {
        let markdown = "# Page\n\nVisible content";
        let raw = "first line\n```inside paste```\nlast line";
        let result =
            append_text_attachment_markdown(markdown, "https://xpaste.pro/p/t4q0Lsp0", raw);

        assert!(result.contains("## xpaste-pro-t4q0Lsp0.txt"));
        assert!(result.contains("````text\nfirst line\n```inside paste```\nlast line\n````"));
    }
}
