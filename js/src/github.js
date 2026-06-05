import fetch from 'node-fetch';
import { URL } from 'node:url';

const GITHUB_API_BASE = 'https://api.github.com';
const GITHUB_USER_AGENT = 'web-capture';

export function parseGithubRepositoryUrl(url) {
  try {
    const parsed = new URL(url);
    const host = parsed.hostname.toLowerCase();
    if (host !== 'github.com' && host !== 'www.github.com') {
      return null;
    }

    const parts = parsed.pathname.split('/').filter(Boolean);
    if (parts.length !== 2) {
      return null;
    }

    const [owner, repo] = parts;
    if (!owner || !repo) {
      return null;
    }

    return {
      owner,
      repo,
      fullName: `${owner}/${repo}`,
      htmlUrl: `https://github.com/${owner}/${repo}`,
    };
  } catch {
    return null;
  }
}

export function isGithubRepositoryUrl(url) {
  return Boolean(parseGithubRepositoryUrl(url));
}

export function getGithubRepositoryTextFilename(url) {
  const parsed = parseGithubRepositoryUrl(url);
  return parsed ? `${parsed.owner}-${parsed.repo}.txt` : null;
}

export async function fetchGithubRepositorySnapshot(url) {
  const parsed = parseGithubRepositoryUrl(url);
  if (!parsed) {
    throw new Error(`Not a GitHub repository URL: ${url}`);
  }

  const repository = await fetchGithubJson(
    `${GITHUB_API_BASE}/repos/${encodePath(parsed.owner)}/${encodePath(parsed.repo)}`
  );
  const defaultBranch = repository.default_branch || 'main';

  const [readme, tree] = await Promise.all([
    fetchGithubReadme(parsed, defaultBranch),
    fetchGithubRootTree(parsed, defaultBranch),
  ]);

  return {
    sourceUrl: parsed.htmlUrl,
    repository,
    defaultBranch,
    readme,
    tree,
  };
}

export function formatGithubRepositoryMarkdown(snapshot) {
  const { repository, defaultBranch, readme, tree, sourceUrl } = snapshot;
  const lines = [
    `# ${repository.full_name}`,
    '',
    repository.description ? `> ${repository.description}` : null,
    '',
    '## Repository',
    '',
    `- URL: ${repository.html_url || sourceUrl}`,
    `- Default branch: \`${defaultBranch}\``,
    repository.language ? `- Primary language: ${repository.language}` : null,
    numberLine('Stars', repository.stargazers_count),
    numberLine('Forks', repository.forks_count),
    numberLine('Open issues', repository.open_issues_count),
    repository.license?.spdx_id
      ? `- License: ${repository.license.spdx_id}`
      : null,
    topicsLine(repository.topics),
    '',
    '## Files',
    '',
  ].filter((line) => line !== null);

  if (tree.length > 0) {
    for (const item of tree) {
      const label = item.type === 'dir' ? `${item.name}/` : item.name;
      const suffix =
        item.type === 'file' && typeof item.size === 'number'
          ? ` (${formatBytes(item.size)})`
          : '';
      lines.push(`- [${label}](${item.html_url})${suffix}`);
    }
  } else {
    lines.push('- No root files returned by the GitHub API.');
  }

  lines.push('', `## ${readme?.path || 'README'}`, '');
  if (readme?.content) {
    lines.push(readme.content.trimEnd(), '');
  } else {
    lines.push('README content was not returned by the GitHub API.', '');
  }

  return lines.join('\n');
}

export function formatGithubRepositoryText(snapshot) {
  const { repository, defaultBranch, readme, tree, sourceUrl } = snapshot;
  const lines = [
    `Repository: ${repository.full_name}`,
    repository.description ? `Description: ${repository.description}` : null,
    `URL: ${repository.html_url || sourceUrl}`,
    `Default branch: ${defaultBranch}`,
    repository.language ? `Primary language: ${repository.language}` : null,
    plainNumberLine('Stars', repository.stargazers_count),
    plainNumberLine('Forks', repository.forks_count),
    plainNumberLine('Open issues', repository.open_issues_count),
    repository.license?.spdx_id
      ? `License: ${repository.license.spdx_id}`
      : null,
    repository.topics?.length
      ? `Topics: ${repository.topics.join(', ')}`
      : null,
    '',
    'Files:',
  ].filter((line) => line !== null);

  if (tree.length > 0) {
    for (const item of tree) {
      const label = item.type === 'dir' ? `${item.name}/` : item.name;
      const suffix =
        item.type === 'file' && typeof item.size === 'number'
          ? ` (${formatBytes(item.size)})`
          : '';
      lines.push(`- ${label}${suffix}`);
    }
  } else {
    lines.push('- No root files returned by the GitHub API.');
  }

  lines.push('', `${readme?.path || 'README'}:`, '');
  if (readme?.content) {
    lines.push(readme.content.trimEnd(), '');
  } else {
    lines.push('README content was not returned by the GitHub API.', '');
  }

  return lines.join('\n');
}

async function fetchGithubReadme(parsed, defaultBranch) {
  const readme = await fetchGithubJson(
    `${GITHUB_API_BASE}/repos/${encodePath(parsed.owner)}/${encodePath(parsed.repo)}/readme?ref=${encodeURIComponent(defaultBranch)}`,
    { optional: true }
  );
  if (!readme) {
    return null;
  }

  let content = null;
  if (readme.content && readme.encoding === 'base64') {
    content = Buffer.from(
      readme.content.replace(/\s+/g, ''),
      'base64'
    ).toString('utf8');
  } else if (readme.download_url) {
    content = await fetchGithubText(readme.download_url, { optional: true });
  }

  return {
    name: readme.name || 'README',
    path: readme.path || readme.name || 'README',
    htmlUrl: readme.html_url,
    content,
  };
}

async function fetchGithubRootTree(parsed, defaultBranch) {
  const tree = await fetchGithubJson(
    `${GITHUB_API_BASE}/repos/${encodePath(parsed.owner)}/${encodePath(parsed.repo)}/contents?ref=${encodeURIComponent(defaultBranch)}`,
    { optional: true }
  );
  if (!Array.isArray(tree)) {
    return [];
  }

  return tree
    .map((item) => {
      const pathKind = item.type === 'dir' ? 'tree' : 'blob';
      return {
        name: item.name,
        path: item.path,
        type: item.type,
        size: item.size,
        html_url:
          item.html_url ||
          `https://github.com/${parsed.owner}/${parsed.repo}/${pathKind}/${defaultBranch}/${item.path}`,
      };
    })
    .sort((a, b) => {
      if (a.type !== b.type) {
        return a.type === 'dir' ? -1 : 1;
      }
      return a.name.localeCompare(b.name);
    });
}

async function fetchGithubJson(url, options = {}) {
  const response = await fetch(url, {
    headers: githubHeaders('application/vnd.github+json'),
  });
  if (options.optional && response.status === 404) {
    return null;
  }
  if (!response.ok) {
    throw new Error(`GitHub API ${response.status}: ${response.statusText}`);
  }
  return response.json();
}

async function fetchGithubText(url, options = {}) {
  const response = await fetch(url, {
    headers: githubHeaders('text/plain'),
  });
  if (options.optional && response.status === 404) {
    return null;
  }
  if (!response.ok) {
    throw new Error(`GitHub raw ${response.status}: ${response.statusText}`);
  }
  return response.text();
}

function githubHeaders(accept) {
  const headers = {
    Accept: accept,
    'User-Agent': GITHUB_USER_AGENT,
    'X-GitHub-Api-Version': '2022-11-28',
  };
  const token = process.env.GITHUB_TOKEN || process.env.GH_TOKEN;
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }
  return headers;
}

function encodePath(value) {
  return encodeURIComponent(value);
}

function numberLine(label, value) {
  return typeof value === 'number'
    ? `- ${label}: ${value.toLocaleString()}`
    : null;
}

function plainNumberLine(label, value) {
  return typeof value === 'number'
    ? `${label}: ${value.toLocaleString()}`
    : null;
}

function topicsLine(topics) {
  return topics?.length ? `- Topics: ${topics.join(', ')}` : null;
}

function formatBytes(size) {
  if (size < 1024) {
    return `${size} B`;
  }
  if (size < 1024 * 1024) {
    return `${(size / 1024).toFixed(1)} KB`;
  }
  return `${(size / (1024 * 1024)).toFixed(1)} MB`;
}
