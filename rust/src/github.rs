//! GitHub repository-page capture helpers.
//!
//! Plain repository pages are mostly application HTML. For text and markdown
//! output, the compact content users expect is available more reliably through
//! the GitHub REST API: repository details, the root file listing, and README.

use anyhow::{anyhow, Context};
use base64::{engine::general_purpose::STANDARD, Engine as _};
use reqwest::header::{HeaderMap, HeaderValue, ACCEPT, AUTHORIZATION, USER_AGENT};
use reqwest::StatusCode;
use serde::de::DeserializeOwned;
use serde::Deserialize;
use url::Url;

const GITHUB_API_BASE: &str = "https://api.github.com";
const GITHUB_USER_AGENT: &str = "web-capture";

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct GithubRepositoryUrl {
    pub owner: String,
    pub repo: String,
    pub full_name: String,
    pub html_url: String,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct GithubRepositoryMetadata {
    pub full_name: String,
    pub html_url: String,
    pub description: Option<String>,
    pub language: Option<String>,
    pub stargazers_count: u64,
    pub forks_count: u64,
    pub open_issues_count: u64,
    pub license_spdx_id: Option<String>,
    pub topics: Vec<String>,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct GithubReadme {
    pub name: String,
    pub path: String,
    pub html_url: Option<String>,
    pub content: Option<String>,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct GithubTreeEntry {
    pub name: String,
    pub path: String,
    pub kind: String,
    pub size: Option<u64>,
    pub html_url: String,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct GithubRepositorySnapshot {
    pub source_url: String,
    pub repository: GithubRepositoryMetadata,
    pub default_branch: String,
    pub readme: Option<GithubReadme>,
    pub tree: Vec<GithubTreeEntry>,
}

#[derive(Debug, Deserialize)]
struct RepositoryApiResponse {
    full_name: String,
    html_url: String,
    description: Option<String>,
    default_branch: Option<String>,
    language: Option<String>,
    stargazers_count: Option<u64>,
    forks_count: Option<u64>,
    open_issues_count: Option<u64>,
    license: Option<RepositoryLicenseApiResponse>,
    topics: Option<Vec<String>>,
}

#[derive(Debug, Deserialize)]
struct RepositoryLicenseApiResponse {
    spdx_id: Option<String>,
}

#[derive(Debug, Deserialize)]
struct ReadmeApiResponse {
    name: Option<String>,
    path: Option<String>,
    html_url: Option<String>,
    download_url: Option<String>,
    content: Option<String>,
    encoding: Option<String>,
}

#[derive(Debug, Deserialize)]
struct ContentsApiResponse {
    name: String,
    path: String,
    #[serde(rename = "type")]
    kind: String,
    size: Option<u64>,
    html_url: Option<String>,
}

/// Parse a plain GitHub repository URL.
///
/// URLs for subpages such as `/issues`, `/tree/...`, or `/blob/...` are not
/// treated as repository snapshots because those pages have their own capture
/// semantics.
#[must_use]
pub fn parse_github_repository_url(url: &str) -> Option<GithubRepositoryUrl> {
    let parsed = Url::parse(url).ok()?;
    let host = parsed.host_str()?.to_ascii_lowercase();
    if host != "github.com" && host != "www.github.com" {
        return None;
    }

    let parts: Vec<_> = parsed
        .path_segments()?
        .filter(|segment| !segment.is_empty())
        .collect();
    if parts.len() != 2 {
        return None;
    }

    let owner = parts[0].to_string();
    let repo = parts[1].to_string();
    if owner.is_empty() || repo.is_empty() {
        return None;
    }

    Some(GithubRepositoryUrl {
        full_name: format!("{owner}/{repo}"),
        html_url: format!("https://github.com/{owner}/{repo}"),
        owner,
        repo,
    })
}

#[must_use]
pub fn is_github_repository_url(url: &str) -> bool {
    parse_github_repository_url(url).is_some()
}

#[must_use]
pub fn github_repository_text_filename(url: &str) -> Option<String> {
    parse_github_repository_url(url).map(|repo| format!("{}-{}.txt", repo.owner, repo.repo))
}

pub async fn fetch_github_repository_snapshot(
    url: &str,
) -> anyhow::Result<GithubRepositorySnapshot> {
    let parsed = parse_github_repository_url(url)
        .ok_or_else(|| anyhow!("Not a GitHub repository URL: {url}"))?;

    let repository: RepositoryApiResponse = fetch_github_json(&format!(
        "{GITHUB_API_BASE}/repos/{}/{}",
        parsed.owner, parsed.repo
    ))
    .await?
    .ok_or_else(|| anyhow!("Repository was not returned by the GitHub API"))?;

    let default_branch = repository
        .default_branch
        .clone()
        .unwrap_or_else(|| "main".to_string());

    let (readme, tree) = tokio::try_join!(
        fetch_github_readme(&parsed, &default_branch),
        fetch_github_root_tree(&parsed, &default_branch)
    )?;

    Ok(GithubRepositorySnapshot {
        source_url: parsed.html_url,
        repository: GithubRepositoryMetadata {
            full_name: repository.full_name,
            html_url: repository.html_url,
            description: repository.description,
            language: repository.language,
            stargazers_count: repository.stargazers_count.unwrap_or_default(),
            forks_count: repository.forks_count.unwrap_or_default(),
            open_issues_count: repository.open_issues_count.unwrap_or_default(),
            license_spdx_id: repository.license.and_then(|license| license.spdx_id),
            topics: repository.topics.unwrap_or_default(),
        },
        default_branch,
        readme,
        tree,
    })
}

#[must_use]
pub fn format_github_repository_markdown(snapshot: &GithubRepositorySnapshot) -> String {
    let mut lines = vec![
        format!("# {}", snapshot.repository.full_name),
        String::new(),
    ];
    if let Some(description) = &snapshot.repository.description {
        lines.push(format!("> {description}"));
        lines.push(String::new());
    }

    lines.extend([
        "## Repository".to_string(),
        String::new(),
        format!("- URL: {}", repository_url(snapshot)),
        format!("- Default branch: `{}`", snapshot.default_branch),
    ]);
    push_optional_line(
        &mut lines,
        snapshot
            .repository
            .language
            .as_ref()
            .map(|language| format!("- Primary language: {language}")),
    );
    lines.push(format!("- Stars: {}", snapshot.repository.stargazers_count));
    lines.push(format!("- Forks: {}", snapshot.repository.forks_count));
    lines.push(format!(
        "- Open issues: {}",
        snapshot.repository.open_issues_count
    ));
    push_optional_line(
        &mut lines,
        snapshot
            .repository
            .license_spdx_id
            .as_ref()
            .map(|license| format!("- License: {license}")),
    );
    if !snapshot.repository.topics.is_empty() {
        lines.push(format!(
            "- Topics: {}",
            snapshot.repository.topics.join(", ")
        ));
    }

    lines.extend([String::new(), "## Files".to_string(), String::new()]);
    append_tree_markdown(&mut lines, &snapshot.tree);

    let readme_path = snapshot
        .readme
        .as_ref()
        .map_or("README", |readme| readme.path.as_str());
    lines.extend([String::new(), format!("## {readme_path}"), String::new()]);
    append_readme_content(&mut lines, snapshot.readme.as_ref());

    lines.join("\n")
}

#[must_use]
pub fn format_github_repository_text(snapshot: &GithubRepositorySnapshot) -> String {
    let mut lines = vec![format!("Repository: {}", snapshot.repository.full_name)];
    if let Some(description) = &snapshot.repository.description {
        lines.push(format!("Description: {description}"));
    }
    lines.extend([
        format!("URL: {}", repository_url(snapshot)),
        format!("Default branch: {}", snapshot.default_branch),
    ]);
    push_optional_line(
        &mut lines,
        snapshot
            .repository
            .language
            .as_ref()
            .map(|language| format!("Primary language: {language}")),
    );
    lines.push(format!("Stars: {}", snapshot.repository.stargazers_count));
    lines.push(format!("Forks: {}", snapshot.repository.forks_count));
    lines.push(format!(
        "Open issues: {}",
        snapshot.repository.open_issues_count
    ));
    push_optional_line(
        &mut lines,
        snapshot
            .repository
            .license_spdx_id
            .as_ref()
            .map(|license| format!("License: {license}")),
    );
    if !snapshot.repository.topics.is_empty() {
        lines.push(format!("Topics: {}", snapshot.repository.topics.join(", ")));
    }

    lines.extend([String::new(), "Files:".to_string()]);
    append_tree_text(&mut lines, &snapshot.tree);

    let readme_path = snapshot
        .readme
        .as_ref()
        .map_or("README", |readme| readme.path.as_str());
    lines.extend([String::new(), format!("{readme_path}:"), String::new()]);
    append_readme_content(&mut lines, snapshot.readme.as_ref());

    lines.join("\n")
}

async fn fetch_github_readme(
    parsed: &GithubRepositoryUrl,
    default_branch: &str,
) -> anyhow::Result<Option<GithubReadme>> {
    let readme: Option<ReadmeApiResponse> = fetch_optional_github_json(&format!(
        "{GITHUB_API_BASE}/repos/{}/{}/readme?ref={default_branch}",
        parsed.owner, parsed.repo
    ))
    .await?;

    let Some(readme) = readme else {
        return Ok(None);
    };

    let content = if readme.encoding.as_deref() == Some("base64") {
        readme
            .content
            .as_deref()
            .map(decode_base64_text)
            .transpose()?
    } else if let Some(download_url) = readme.download_url.as_deref() {
        fetch_optional_github_text(download_url).await?
    } else {
        None
    };

    let name = readme.name.unwrap_or_else(|| "README".to_string());
    let path = readme.path.unwrap_or_else(|| name.clone());
    Ok(Some(GithubReadme {
        name,
        path,
        html_url: readme.html_url,
        content,
    }))
}

async fn fetch_github_root_tree(
    parsed: &GithubRepositoryUrl,
    default_branch: &str,
) -> anyhow::Result<Vec<GithubTreeEntry>> {
    let contents: Option<Vec<ContentsApiResponse>> = fetch_optional_github_json(&format!(
        "{GITHUB_API_BASE}/repos/{}/{}/contents?ref={default_branch}",
        parsed.owner, parsed.repo
    ))
    .await?;

    let mut tree: Vec<_> = contents
        .unwrap_or_default()
        .into_iter()
        .map(|item| {
            let html_url = item.html_url.unwrap_or_else(|| {
                let kind = if item.kind == "dir" { "tree" } else { "blob" };
                format!(
                    "https://github.com/{}/{}/{kind}/{default_branch}/{}",
                    parsed.owner, parsed.repo, item.path
                )
            });
            GithubTreeEntry {
                name: item.name,
                path: item.path,
                kind: item.kind,
                size: item.size,
                html_url,
            }
        })
        .collect();
    tree.sort_by(
        |a, b| match (a.kind.as_str() == "dir", b.kind.as_str() == "dir") {
            (true, false) => std::cmp::Ordering::Less,
            (false, true) => std::cmp::Ordering::Greater,
            _ => a.name.cmp(&b.name),
        },
    );
    Ok(tree)
}

async fn fetch_github_json<T>(url: &str) -> anyhow::Result<Option<T>>
where
    T: DeserializeOwned,
{
    fetch_github_json_with_optional_not_found(url, false).await
}

async fn fetch_optional_github_json<T>(url: &str) -> anyhow::Result<Option<T>>
where
    T: DeserializeOwned,
{
    fetch_github_json_with_optional_not_found(url, true).await
}

async fn fetch_github_json_with_optional_not_found<T>(
    url: &str,
    optional: bool,
) -> anyhow::Result<Option<T>>
where
    T: DeserializeOwned,
{
    let response = reqwest::Client::new()
        .get(url)
        .headers(github_headers("application/vnd.github+json"))
        .send()
        .await
        .with_context(|| format!("Requesting {url}"))?;
    if optional && response.status() == StatusCode::NOT_FOUND {
        return Ok(None);
    }
    let status = response.status();
    let body = response
        .text()
        .await
        .with_context(|| format!("Reading response body from {url}"))?;
    if !status.is_success() {
        anyhow::bail!("GitHub API {status}: {body}");
    }
    Ok(Some(serde_json::from_str(&body).with_context(|| {
        format!("Parsing GitHub JSON from {url}")
    })?))
}

async fn fetch_optional_github_text(url: &str) -> anyhow::Result<Option<String>> {
    let response = reqwest::Client::new()
        .get(url)
        .headers(github_headers("text/plain"))
        .send()
        .await
        .with_context(|| format!("Requesting {url}"))?;
    if response.status() == StatusCode::NOT_FOUND {
        return Ok(None);
    }
    let status = response.status();
    let text = response
        .text()
        .await
        .with_context(|| format!("Reading text response from {url}"))?;
    if !status.is_success() {
        anyhow::bail!("GitHub raw {status}: {text}");
    }
    Ok(Some(text))
}

fn github_headers(accept: &str) -> HeaderMap {
    let mut headers = HeaderMap::new();
    headers.insert(
        ACCEPT,
        HeaderValue::from_str(accept).unwrap_or_else(|_| HeaderValue::from_static("*/*")),
    );
    headers.insert(USER_AGENT, HeaderValue::from_static(GITHUB_USER_AGENT));
    headers.insert(
        "X-GitHub-Api-Version",
        HeaderValue::from_static("2022-11-28"),
    );
    if let Ok(token) = std::env::var("GITHUB_TOKEN").or_else(|_| std::env::var("GH_TOKEN")) {
        if let Ok(value) = HeaderValue::from_str(&format!("Bearer {token}")) {
            headers.insert(AUTHORIZATION, value);
        }
    }
    headers
}

fn decode_base64_text(content: &str) -> anyhow::Result<String> {
    let stripped: String = content.chars().filter(|ch| !ch.is_whitespace()).collect();
    let bytes = STANDARD
        .decode(stripped)
        .context("Decoding GitHub README base64 content")?;
    Ok(String::from_utf8_lossy(&bytes).into_owned())
}

fn repository_url(snapshot: &GithubRepositorySnapshot) -> &str {
    if snapshot.repository.html_url.is_empty() {
        &snapshot.source_url
    } else {
        &snapshot.repository.html_url
    }
}

fn push_optional_line(lines: &mut Vec<String>, line: Option<String>) {
    if let Some(line) = line {
        lines.push(line);
    }
}

fn append_tree_markdown(lines: &mut Vec<String>, tree: &[GithubTreeEntry]) {
    if tree.is_empty() {
        lines.push("- No root files returned by the GitHub API.".to_string());
        return;
    }

    for item in tree {
        let label = if item.kind == "dir" {
            format!("{}/", item.name)
        } else {
            item.name.clone()
        };
        let suffix = if item.kind == "file" {
            item.size
                .map_or_else(String::new, |size| format!(" ({})", format_bytes(size)))
        } else {
            String::new()
        };
        lines.push(format!("- [{label}]({}){suffix}", item.html_url));
    }
}

fn append_tree_text(lines: &mut Vec<String>, tree: &[GithubTreeEntry]) {
    if tree.is_empty() {
        lines.push("- No root files returned by the GitHub API.".to_string());
        return;
    }

    for item in tree {
        let label = if item.kind == "dir" {
            format!("{}/", item.name)
        } else {
            item.name.clone()
        };
        let suffix = if item.kind == "file" {
            item.size
                .map_or_else(String::new, |size| format!(" ({})", format_bytes(size)))
        } else {
            String::new()
        };
        lines.push(format!("- {label}{suffix}"));
    }
}

fn append_readme_content(lines: &mut Vec<String>, readme: Option<&GithubReadme>) {
    if let Some(content) = readme.and_then(|readme| readme.content.as_deref()) {
        lines.push(content.trim_end().to_string());
    } else {
        lines.push("README content was not returned by the GitHub API.".to_string());
    }
    lines.push(String::new());
}

fn format_bytes(size: u64) -> String {
    if size < 1024 {
        return format!("{size} B");
    }
    if size < 1024 * 1024 {
        return format_scaled_bytes(size, 1024, "KB");
    }
    format_scaled_bytes(size, 1024 * 1024, "MB")
}

fn format_scaled_bytes(size: u64, unit: u64, suffix: &str) -> String {
    let mut whole = size / unit;
    let mut tenth = ((size % unit) * 10 + unit / 2) / unit;
    if tenth == 10 {
        whole += 1;
        tenth = 0;
    }
    format!("{whole}.{tenth} {suffix}")
}
