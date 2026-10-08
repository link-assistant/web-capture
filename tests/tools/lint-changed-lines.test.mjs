import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  filterWarningsToChangedLines,
  parseChangedLines,
} from '../../scripts/lint-changed-lines.mjs';

// `git diff --relative -U0` run from js/ prints paths relative to js/.
const diff = [
  'diff --git a/src/lib.js b/src/lib.js',
  '--- a/src/lib.js',
  '+++ b/src/lib.js',
  '@@ -10,0 +11,2 @@',
  '+// new',
  '+const value = 1;',
  '',
].join('\n');

const message = (severity, line) => ({ severity, line, endLine: line });
const result = (filePath, messages) => ({
  filePath,
  messages,
  errorCount: messages.filter((m) => m.severity === 2).length,
  warningCount: messages.filter((m) => m.severity === 1).length,
});

test('changed lines are parsed from a zero-context diff', () => {
  assert.deepEqual([...parseChangedLines(diff).get('src/lib.js')], [11, 12]);
});

test('warnings survive only on changed lines; errors always survive', () => {
  const changed = parseChangedLines(diff);
  changed.set('src/new.js', true);
  const [lib, other, created] = filterWarningsToChangedLines(
    [
      result('/repo/js/src/lib.js', [message(1, 3), message(1, 12)]),
      result('/repo/js/src/other.js', [message(1, 5), message(2, 7)]),
      result('/repo/js/src/new.js', [message(1, 1)]),
    ],
    changed,
    '/repo/js'
  );
  assert.deepEqual(lib.messages, [message(1, 12)]);
  assert.deepEqual(other.messages, [message(2, 7)]);
  assert.equal(other.warningCount, 0);
  assert.equal(created.warningCount, 1);
});
