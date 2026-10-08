import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import {
  checkDependabotIgnores,
  checkVersions,
} from '../../scripts/check-dependency-freshness.mjs';

const blockers = {
  'browser-commander': {
    issue: 'https://github.com/link-assistant/web-capture/issues/160',
    reason: 'native dependency',
  },
};

const config = (ignore) => `version: 2
updates:
  - package-ecosystem: npm
    directories: ['/', '/js']
    schedule:
      interval: weekly
${ignore}
  - package-ecosystem: cargo
    directories: ['/rust']
    schedule:
      interval: weekly
`;

test('a blocked dependency must be ignored by Dependabot for its directory', () => {
  assert.throws(
    () => checkDependabotIgnores('npm', '/js', blockers, config('')),
    /browser-commander: blocked by .*issues\/160 but not ignored/
  );
  const ignored = config(
    "    ignore:\n      - dependency-name: 'browser-commander'"
  );
  checkDependabotIgnores('npm', '/js', blockers, ignored);
  // An ignore in another ecosystem does not count.
  assert.throws(() =>
    checkDependabotIgnores('cargo', '/rust', blockers, ignored)
  );
});

test('the committed Dependabot config ignores every npm blocker', () => {
  const root = new URL('../../', import.meta.url);
  const manifest = JSON.parse(
    readFileSync(new URL('js/package.json', root), 'utf8')
  );
  checkDependabotIgnores(
    'npm',
    '/js',
    manifest.dependencyBlockers || {},
    readFileSync(new URL('.github/dependabot.yml', root), 'utf8')
  );
});

test('outdated dependencies need an open blocker issue', async () => {
  const latest = async () => '0.26.3';
  const open = async () => ({ state: 'open' });
  const dependency = [{ name: 'browser-commander', current: '0.10.0' }];
  await checkVersions(dependency, blockers, latest, open);
  await assert.rejects(
    checkVersions(dependency, {}, latest, open),
    /update or document an open issue blocker/
  );
  await assert.rejects(
    checkVersions(dependency, blockers, latest, async () => ({
      state: 'closed',
    })),
    /is closed/
  );
});
