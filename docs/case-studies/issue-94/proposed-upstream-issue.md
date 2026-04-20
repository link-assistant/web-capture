# Proposed upstream issue (Rust template & JS template): harden auto-bump against concurrent pushes

Target repos:
- https://github.com/link-foundation/rust-ai-driven-development-pipeline-template
- https://github.com/link-foundation/js-ai-driven-development-pipeline-template

## Problem

When a monorepo uses both templates, a push to `main` triggers both `Rust Checks and Release` and `JavaScript Checks and Release`. Each workflow's `release` job calls its own auto-bump, commits a version bump to `main`, and pushes. Whichever pushes first wins; the other fails with:

```
! [rejected]        main -> main (non-fast-forward)
error: failed to push some refs to 'https://github.com/…'
```

See a real failure at https://github.com/link-assistant/web-capture/actions/runs/24686173280/job/72197673668 (step "Auto-bump patch version for unreleased changes" in `Rust - Release`).

## Root cause

The auto-bump step does:

```yaml
git commit -m "…"
git push origin main
```

with no pre-fetch / rebase / push-retry. A sibling workflow (other language's release) that auto-bumps on the same push event races and one of them loses.

## Reproducer

Two clones of the default branch race each other:

```bash
git clone <repo> a && git clone <repo> b
(cd a && echo 1 >> x && git add . && git commit -m a && git push origin main) &
(cd b && echo 2 >> y && git add . && git commit -m b && git push origin main) &
wait
# One push is rejected with "non-fast-forward".
```

## Workaround for affected downstream users

In the inline auto-bump shell, replace `git push origin main` with:

```bash
git fetch origin main
git rebase origin/main
for i in 1 2 3; do
  git push origin main && break
  echo "push attempt $i failed; pulling and retrying"
  git pull --rebase origin main || { git rebase --abort; exit 1; }
done
```

## Suggested fix (upstream)

`rust-ai-driven-development-pipeline-template/scripts/version-and-commit.rs` already implements fetch + rebase + 3× retry for `git push` (lines ~460–522). The problem is any repo that copies the inline `Auto-bump patch version …` YAML block from a release workflow without calling `version-and-commit.rs` inherits the race. Two fixes make the templates robust:

1. Remove the inline `git commit && git push origin main` in the auto-bump step and always delegate to `scripts/version-and-commit.rs` (or equivalent `mjs`), which already does the safe push.
2. Add an integration test (`scripts/simulate-concurrent-release.sh`) that clones the repo twice and tries to push concurrent version bumps; CI should show the retry happy-path.

For the JS template, mirror the same refactor: `scripts/version-and-commit.mjs` already does `git fetch origin main` + rebase before commit. The **auto-bump** path in the release YAML should also route through it (or through `instant-version-bump.mjs` + a new safe-push helper) instead of raw `git push origin main`.

## Impact

Every monorepo that uses both templates (or any template that adds a second workflow pushing to the same default branch) will eventually hit this on a high-traffic merge. In `link-assistant/web-capture` it already broke a crates.io release.
