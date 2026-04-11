# @link-assistant/web-capture

## 1.4.1

### Patch Changes

- 4570a2b: Fix CI/CD release pipeline: resolve git show path bug in version-and-commit.mjs where `git show origin/main:package.json` failed because git show uses repo-root-relative paths (should be `js/package.json`). Add npx-based fallback in setup-npm.mjs for Node.js 22.22.2 broken npm issue.

## 1.4.0

### Minor Changes

- f464988: Add Google Docs document to Markdown capture support with API token authentication

## 1.3.0

### Minor Changes

- 141458e: Implement all web capture best practices from meta-theory reference scripts (R1-R7): LaTeX formula extraction (Habr, KaTeX, MathJax), article metadata extraction, markdown post-processing pipeline, animation capture with loop detection, dual-theme screenshots, figure image extraction, markdown image localization, content verification with fuzzy matching, and batch processing with JSON/MJS configuration. Add enhanced HTML-to-markdown conversion with configurable options, 3 new API endpoints (/animation, /figures, /themed-image), and expanded CLI flags.
