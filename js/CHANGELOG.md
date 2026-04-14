# @link-assistant/web-capture

## 1.7.1

### Patch Changes

- 3ee464b: Add heading-image parity guard rail tests to prevent <img> inside headings from being silently dropped during HTML-to-Markdown conversion

## 1.7.0

### Minor Changes

- b6d77d6: Fix archive quality bugs: relative image paths in markdown, HTML pretty-printing, entity decoding, and rename article to document filenames

## 1.5.1

### Patch Changes

- e6dea94: Fix Google Docs capture: archive produces real zip, default markdown extracts images to files instead of stripping

## 1.5.0

### Minor Changes

- a463061: Markdown mode now keeps original remote image URLs and strips base64 by default (single-file output).
  Archive mode downloads images to images/ folder by default (keepOriginalLinks=false, embedImages=false).
  API and CLI share identical defaults for all modes.
  Add --embed-images, --images-dir, --no-extract-images, --archive, --data-dir, --keep-original-links flags.
  Add embedImages and keepOriginalLinks query params to /markdown and /archive API endpoints.
  Change /markdown API defaults: keepOriginalLinks=true, embedImages=false.
  Remove --enhanced umbrella flag; make sub-features default to true.
  Change default format from html to markdown.
  Auto-derive output directory from URL when -o is omitted.
  Use content-hash filenames for extracted images instead of positional numbering.
  Replace process.env ternaries with lino-arguments getenv() helper.
  Add `WEB_CAPTURE_*` environment variable support for all feature flags.

## 1.4.3

### Patch Changes

- c9d1132: Fix cargo publish token resolution: fallback to CARGO_TOKEN when CARGO_REGISTRY_TOKEN is not set, and fail instead of silently skipping publish

## 1.4.2

### Patch Changes

- 94c1953: Update lino-arguments to ^0.3.0, fix npm publish OIDC fallback, and align CI/CD workflows with reference repo best practices

## 1.4.1

### Patch Changes

- 4570a2b: Fix CI/CD release pipeline: resolve git show path bug in version-and-commit.mjs where `git show origin/main:package.json` failed because git show uses repo-root-relative paths (should be `js/package.json`). Add npx-based fallback in setup-npm.mjs for Node.js 22.22.2 broken npm issue.

## 1.4.0

### Minor Changes

- f464988: Add Google Docs document to Markdown capture support with API token authentication

## 1.3.0

### Minor Changes

- 141458e: Implement all web capture best practices from meta-theory reference scripts (R1-R7): LaTeX formula extraction (Habr, KaTeX, MathJax), article metadata extraction, markdown post-processing pipeline, animation capture with loop detection, dual-theme screenshots, figure image extraction, markdown image localization, content verification with fuzzy matching, and batch processing with JSON/MJS configuration. Add enhanced HTML-to-markdown conversion with configurable options, 3 new API endpoints (/animation, /figures, /themed-image), and expanded CLI flags.
