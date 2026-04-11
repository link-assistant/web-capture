---
'@link-assistant/web-capture': patch
---

Fix CI/CD release pipeline: resolve git show path bug in version-and-commit.mjs where `git show origin/main:package.json` failed because git show uses repo-root-relative paths (should be `js/package.json`). Add npx-based fallback in setup-npm.mjs for Node.js 22.22.2 broken npm issue.
