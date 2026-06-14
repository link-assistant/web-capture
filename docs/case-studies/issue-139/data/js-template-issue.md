Found while investigating link-assistant/web-capture#139.

## Problem

`scripts/detect-code-changes.mjs` treats any merge commit as a GitHub
`pull_request` synthetic merge and compares `HEAD^2^..HEAD^2`.

That is correct for pull request runs when the workflow wants the PR head's
latest-commit diff. It is wrong for a real merge commit pushed to `main`.

If a branch has:

1. an earlier commit that changes JavaScript code, and
2. a final commit that only changes docs,

then the merge commit pushed to `main` is diffed as only the final docs commit.
The detector reports code flags such as `mjs-changed`, `js-changed`, and
`any-code-changed` as `false`, even though the merge introduced code.

## Reproducer

1. Create `main` with an initial commit.
2. Create a `feature` branch.
3. Commit a source change, for example `src/index.mjs`.
4. Commit a docs-only change, for example `docs/notes.md`.
5. Merge the branch to `main` with `git merge --no-ff feature`.
6. Run `GITHUB_EVENT_NAME=push node scripts/detect-code-changes.mjs`.

Expected: the push merge detects the full merge diff and reports code changed.

Actual: the script compares `HEAD^2^..HEAD^2`, sees only the docs-only final
feature commit, and reports no code change.

## Suggested fix

Only use the `HEAD^2^..HEAD^2` pull-request behavior when
`GITHUB_EVENT_NAME == 'pull_request'`. For push merge commits, compare the first
parent to the merge commit, for example `git diff --name-only HEAD^1 HEAD`.

The Python and C# templates already branch on `GITHUB_EVENT_NAME`; this JS
template should do the same.
