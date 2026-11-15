import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';

const workflow = readFileSync(new URL('../../.github/workflows/python.yml', import.meta.url), 'utf8');
const publish = workflow.slice(workflow.indexOf('\n  publish:'));
const build = workflow.slice(0, workflow.indexOf('\n  publish:'));

test('Python publishing requires an upstream Python tag and verified artifacts', () => {
  assert.match(workflow, /tags: \['python-v\*'\]/);
  assert.match(publish, /needs: build/);
  assert.match(publish, /github.event_name == 'push' && startsWith\(github.ref, 'refs\/tags\/python-v'\) && github.repository == 'link-assistant\/web-capture'/);
  assert.match(build, /check-python-distribution.py --tag "\$RELEASE_TAG"/);
  assert.match(build, /uv build --no-sources/);
  assert.match(build, /twine check --strict dist\/\*/);
  assert.match(build, /check-python-distribution.py --dist dist/);
  assert.match(build, /bash experiments\/issue-190\/verify-installed.sh/);
  assert.match(publish, /name: python-distributions/);
  assert.doesNotMatch(publish, /checkout@|uv build|skip-existing/);
});

test('Python uses OIDC only in the publishing job with the documented identity', () => {
  assert.doesNotMatch(build, /id-token:/);
  assert.match(publish, /id-token: write/);
  assert.match(publish, /name: pypi/);
  assert.match(publish, /pypa\/gh-action-pypi-publish@[a-f0-9]{40}/);
  assert.doesNotMatch(workflow, /secrets\.|password:|PYPI_API_TOKEN/);
  const docs = readFileSync(new URL('../../docs/releases/python-trusted-publishing.md', import.meta.url), 'utf8');
  for (const value of ['web-capture-python-examples', 'link-assistant', 'web-capture', 'python.yml', 'pypi']) {
    assert.ok(docs.includes('`' + value + '`'), value);
  }
});
