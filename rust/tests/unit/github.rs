use web_capture::github::{
    format_github_repository_markdown, format_github_repository_text,
    github_repository_text_filename, is_github_repository_url, parse_github_repository_url,
    GithubReadme, GithubRepositoryMetadata, GithubRepositorySnapshot, GithubTreeEntry,
};

#[test]
fn detects_plain_github_repository_pages() {
    let parsed = parse_github_repository_url("https://github.com/octocat/Hello-World").unwrap();

    assert_eq!(parsed.owner, "octocat");
    assert_eq!(parsed.repo, "Hello-World");
    assert_eq!(parsed.full_name, "octocat/Hello-World");
    assert_eq!(parsed.html_url, "https://github.com/octocat/Hello-World");
    assert!(is_github_repository_url(
        "https://github.com/octocat/Hello-World"
    ));
    assert!(!is_github_repository_url(
        "https://github.com/octocat/Hello-World/issues"
    ));
    assert!(!is_github_repository_url(
        "https://example.com/octocat/Hello-World"
    ));
}

#[test]
fn derives_repository_text_filenames() {
    assert_eq!(
        github_repository_text_filename("https://github.com/octocat/Hello-World"),
        Some("octocat-Hello-World.txt".to_string())
    );
}

#[test]
fn formats_compact_markdown_snapshot_with_metadata_files_and_readme() {
    let snapshot = fixture_snapshot();

    let markdown = format_github_repository_markdown(&snapshot);

    assert!(markdown.contains("# octocat/Hello-World"));
    assert!(markdown.contains("> A friendly test repository"));
    assert!(markdown.contains("- Default branch: `master`"));
    assert!(markdown.contains("- [src/]("));
    assert!(markdown.contains("- [README.md]("));
    assert!(markdown.contains("## README.md"));
    assert!(markdown.contains("# Hello World"));
}

#[test]
fn formats_compact_text_snapshot_with_metadata_files_and_readme() {
    let snapshot = fixture_snapshot();

    let text = format_github_repository_text(&snapshot);

    assert!(text.contains("Repository: octocat/Hello-World"));
    assert!(text.contains("Description: A friendly test repository"));
    assert!(text.contains("Files:"));
    assert!(text.contains("- src/"));
    assert!(text.contains("- README.md"));
    assert!(text.contains("README.md:"));
    assert!(text.contains("This is the README."));
}

fn fixture_snapshot() -> GithubRepositorySnapshot {
    GithubRepositorySnapshot {
        source_url: "https://github.com/octocat/Hello-World".to_string(),
        default_branch: "master".to_string(),
        repository: GithubRepositoryMetadata {
            full_name: "octocat/Hello-World".to_string(),
            html_url: "https://github.com/octocat/Hello-World".to_string(),
            description: Some("A friendly test repository".to_string()),
            language: Some("JavaScript".to_string()),
            stargazers_count: 42,
            forks_count: 7,
            open_issues_count: 3,
            license_spdx_id: Some("MIT".to_string()),
            topics: vec!["demo".to_string(), "capture".to_string()],
        },
        tree: vec![
            GithubTreeEntry {
                name: "src".to_string(),
                path: "src".to_string(),
                kind: "dir".to_string(),
                size: None,
                html_url: "https://github.com/octocat/Hello-World/tree/master/src".to_string(),
            },
            GithubTreeEntry {
                name: "README.md".to_string(),
                path: "README.md".to_string(),
                kind: "file".to_string(),
                size: Some(37),
                html_url: "https://github.com/octocat/Hello-World/blob/master/README.md"
                    .to_string(),
            },
        ],
        readme: Some(GithubReadme {
            name: "README.md".to_string(),
            path: "README.md".to_string(),
            html_url: Some(
                "https://github.com/octocat/Hello-World/blob/master/README.md".to_string(),
            ),
            content: Some("# Hello World\n\nThis is the README.".to_string()),
        }),
    }
}
