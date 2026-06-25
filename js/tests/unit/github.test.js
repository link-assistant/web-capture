import nock from 'nock';
import {
  fetchGithubRepositorySnapshot,
  formatGithubRepositoryMarkdown,
  formatGithubRepositoryText,
  getGithubRepositoryTextFilename,
  isGithubRepositoryUrl,
  parseGithubRepositoryUrl,
} from '../../src/github.js';

const SNAPSHOT = {
  sourceUrl: 'https://github.com/octocat/Hello-World',
  defaultBranch: 'master',
  repository: {
    full_name: 'octocat/Hello-World',
    description: 'A friendly test repository',
    html_url: 'https://github.com/octocat/Hello-World',
    default_branch: 'master',
    language: 'JavaScript',
    stargazers_count: 42,
    forks_count: 7,
    open_issues_count: 3,
    license: { spdx_id: 'MIT' },
    topics: ['demo', 'capture'],
  },
  tree: [
    {
      name: 'src',
      path: 'src',
      type: 'dir',
      html_url: 'https://github.com/octocat/Hello-World/tree/master/src',
    },
    {
      name: 'README.md',
      path: 'README.md',
      type: 'file',
      size: 37,
      html_url: 'https://github.com/octocat/Hello-World/blob/master/README.md',
    },
  ],
  readme: {
    path: 'README.md',
    content: '# Hello World\n\nThis is the README.',
  },
};

afterEach(() => {
  nock.cleanAll();
});

describe('GitHub repository URLs', () => {
  it('detects plain GitHub repository pages', () => {
    expect(
      parseGithubRepositoryUrl('https://github.com/octocat/Hello-World')
    ).toEqual({
      owner: 'octocat',
      repo: 'Hello-World',
      fullName: 'octocat/Hello-World',
      htmlUrl: 'https://github.com/octocat/Hello-World',
    });
    expect(
      isGithubRepositoryUrl('https://github.com/octocat/Hello-World')
    ).toBe(true);
    expect(
      isGithubRepositoryUrl('https://github.com/octocat/Hello-World/issues')
    ).toBe(false);
    expect(
      isGithubRepositoryUrl('https://example.com/octocat/Hello-World')
    ).toBe(false);
  });

  it('derives repository text filenames', () => {
    expect(
      getGithubRepositoryTextFilename('https://github.com/octocat/Hello-World')
    ).toBe('octocat-Hello-World.txt');
  });
});

describe('GitHub repository snapshot fetching', () => {
  it('requests identity encoding from GitHub JSON and raw README fetches', async () => {
    const owner = 'octocat';
    const repo = 'Hello-World';
    const readme = '# Hello World\n\nRaw README content.';

    const githubApi = nock('https://api.github.com', {
      reqheaders: {
        'accept-encoding': 'identity',
      },
    })
      .get(`/repos/${owner}/${repo}`)
      .reply(200, {
        full_name: `${owner}/${repo}`,
        html_url: `https://github.com/${owner}/${repo}`,
        default_branch: 'master',
      })
      .get(`/repos/${owner}/${repo}/readme`)
      .query({ ref: 'master' })
      .reply(200, {
        name: 'README.md',
        path: 'README.md',
        download_url: `https://raw.githubusercontent.com/${owner}/${repo}/master/README.md`,
      })
      .get(`/repos/${owner}/${repo}/contents`)
      .query({ ref: 'master' })
      .reply(200, [
        {
          name: 'README.md',
          path: 'README.md',
          type: 'file',
          size: readme.length,
        },
      ]);

    const rawGithub = nock('https://raw.githubusercontent.com', {
      reqheaders: {
        'accept-encoding': 'identity',
      },
    })
      .get(`/${owner}/${repo}/master/README.md`)
      .reply(200, readme);

    const snapshot = await fetchGithubRepositorySnapshot(
      `https://github.com/${owner}/${repo}`
    );

    expect(snapshot.readme.content).toBe(readme);
    expect(githubApi.isDone()).toBe(true);
    expect(rawGithub.isDone()).toBe(true);
  });
});

describe('GitHub repository snapshot formatting', () => {
  it('formats a compact markdown snapshot with metadata, file tree, and README', () => {
    const markdown = formatGithubRepositoryMarkdown(SNAPSHOT);

    expect(markdown).toContain('# octocat/Hello-World');
    expect(markdown).toContain('> A friendly test repository');
    expect(markdown).toContain('- Default branch: `master`');
    expect(markdown).toContain('- [src/](');
    expect(markdown).toContain('- [README.md](');
    expect(markdown).toContain('## README.md');
    expect(markdown).toContain('# Hello World');
  });

  it('formats a compact plain-text snapshot with metadata, file tree, and README', () => {
    const text = formatGithubRepositoryText(SNAPSHOT);

    expect(text).toContain('Repository: octocat/Hello-World');
    expect(text).toContain('Description: A friendly test repository');
    expect(text).toContain('Files:');
    expect(text).toContain('- src/');
    expect(text).toContain('- README.md');
    expect(text).toContain('README.md:');
    expect(text).toContain('This is the README.');
  });
});
