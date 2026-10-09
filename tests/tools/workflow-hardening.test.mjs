import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { test } from 'node:test';

// Line-based invariants from the template's workflow hardening (#177). zizmor
// and actionlint enforce the same rules in workflows.yml; these keep them
// checkable with `npm test` and name the job that breaks them.
const dir = new URL('../../.github/workflows/', import.meta.url);
const workflows = readdirSync(dir)
  .filter((name) => name.endsWith('.yml'))
  .map((name) => ({
    name,
    lines: readFileSync(new URL(name, dir), 'utf8').split('\n'),
  }));

// Jobs that `git push` version commits with the checkout token.
const PUSHING_JOBS = new Set(['release', 'instant-release']);

function indentOf(line) {
  return line.length - line.trimStart().length;
}

function* jobs(lines) {
  const start = lines.indexOf('jobs:');
  let current = null;
  for (let i = start + 1; i < lines.length; i++) {
    const match = /^ {2}([a-z0-9-]+):\s*$/.exec(lines[i]);
    if (match) {
      if (current) yield current;
      current = { id: match[1], lines: [] };
    } else if (current) {
      current.lines.push(lines[i]);
    }
  }
  if (current) yield current;
}

// Returns the bodies of `run:` steps (inline value plus block lines).
function runBlocks(lines) {
  const blocks = [];
  for (let i = 0; i < lines.length; i++) {
    const match = /^(\s*)(?:- )?run:(.*)$/.exec(lines[i]);
    if (!match) continue;
    const body = [match[2]];
    while (
      i + 1 < lines.length &&
      (lines[i + 1].trim() === '' || indentOf(lines[i + 1]) > match[1].length)
    ) {
      body.push(lines[++i]);
    }
    blocks.push({ line: i + 1, text: body.join('\n') });
  }
  return blocks;
}

test('every workflow defaults to read-only permissions', () => {
  for (const { name, lines } of workflows) {
    const at = lines.indexOf('permissions:');
    assert.ok(at > 0, `${name} has no top-level permissions`);
    assert.equal(lines[at + 1], '  contents: read', name);
  }
});

test('checkouts persist credentials only in jobs that push', () => {
  for (const { name, lines } of workflows) {
    for (const job of jobs(lines)) {
      job.lines.forEach((line, i) => {
        if (!/- uses: actions\/checkout@/.test(line)) return;
        const options = [];
        for (let j = i + 1; j < job.lines.length; j++) {
          if (indentOf(job.lines[j]) <= indentOf(line) + 2 && j > i + 1) break;
          options.push(job.lines[j].trim());
        }
        const expected = PUSHING_JOBS.has(job.id) ? 'true' : 'false';
        assert.ok(
          options.includes(`persist-credentials: ${expected}`),
          `${name} job ${job.id}: checkout must set persist-credentials: ${expected}`
        );
      });
    }
  }
});

test('run steps never interpolate expressions into shell source', () => {
  for (const { name, lines } of workflows) {
    for (const block of runBlocks(lines)) {
      assert.doesNotMatch(
        block.text,
        /\$\{\{/,
        `${name}:${block.line}: pass \${{ }} values through env instead`
      );
    }
  }
});

test('every job pins its runner image and sets a timeout', () => {
  for (const { name, lines } of workflows) {
    for (const job of jobs(lines)) {
      assert.ok(
        job.lines.some((line) => /^ {4}timeout-minutes: \d+/.test(line)),
        `${name} job ${job.id} has no timeout-minutes`
      );
      for (const line of job.lines) {
        assert.doesNotMatch(
          line,
          /\b(ubuntu|macos|windows)-latest\b/,
          `${name} job ${job.id}: pin the runner label`
        );
      }
    }
  }
});

test('the run-block parser sees a template injection', () => {
  const blocks = runBlocks([
    '      - name: x',
    '        run: |',
    '          echo "${{ github.head_ref }}"',
    '      - name: y',
  ]);
  assert.equal(blocks.length, 1);
  assert.match(blocks[0].text, /github\.head_ref/);
});
