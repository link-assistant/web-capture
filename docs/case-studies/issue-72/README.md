# Case Study: Issue #72 - Google Docs Capture Methods

## Timeline

1. **2026-04-10T16:20:43Z**: PR #37 adds Google Docs capture using the public `/export?format=...` endpoint and auto-detects Google Docs URLs.
2. **2026-04-14T10:38:43Z**: PR #54 fixes Google Docs archive/image handling while preserving export-based capture.
3. **2026-04-16T09:47:43Z**: Issue #72 reports that `--capture browser` is ignored for Google Docs and still routes through `/export?format=html`.
4. **2026-04-16T10:45:00Z**: The issue author adds a working `DOCS_modelChunk` browser extraction example.
5. **2026-04-16T10:49:21Z**: The issue author asks to preserve issue data and produce this case-study analysis.
6. **2026-04-16T10:50:46Z**: PR #74 removes the `/gdocs` HTTP route; this branch merges that change before implementing issue #72 so the removed route is not reintroduced.

## Data Preserved

- Issue data: `issue.json`, `issue-comments.json`
- PR data: `pr-75.json`, `pr-75-comments.json`, `pr-75-review-comments.json`, `pr-75-reviews.json`
- Related work: `related-merged-prs.json`
- Code search: `code-search-DOCS_modelChunk.json`, `code-search-fetchGoogleDocAsMarkdown.json`
- Reproduction and validation logs: `js-gdocs-before.log`, `rust-gdocs-before.log`, `js-gdocs-after.log`, `rust-gdocs-after.log`, `js-non-browser-test.log`, `js-full-test-browser-missing.log`, `js-lint.log`, `js-format-check.log`, `js-duplication.log`, `rust-test.log`, `rust-clippy.log`, `rust-fmt.log`, `validate-changeset.log`, `npm-install.log`

## Requirements

1. `--capture browser` must not be redirected to the Google Docs public export endpoint.
2. `--capture browser` should capture the fresh editor model from `/edit` using `DOCS_modelChunk`.
3. `--capture api` without a token should keep the existing public export behavior.
4. `--capture api` with a token should use the Google Docs REST API at `docs.googleapis.com`.
5. Suggested-edit text and images from the editor model must be represented by the browser-model parser.
6. Rust and JavaScript CLIs should expose the same capture-method semantics.
7. Do not reintroduce the `/gdocs` HTTP route removed by issue #73 / PR #74.

## Online Research Notes

- Google documents are available through the official `documents.get` REST method: https://developers.google.com/workspace/docs/api/reference/rest/v1/documents/get
- The Docs API document resource contains body structural elements, tables, paragraphs, and inline object references: https://developers.google.com/workspace/docs/api/reference/rest/v1/documents
- Google Drive export is the documented API pattern for exporting Google Workspace files to downloadable formats: https://developers.google.com/workspace/drive/api/guides/manage-downloads

## Root Cause Analysis

The CLI accepted `--capture browser`, but the Google Docs auto-detection block ran before the normal browser capture paths in both implementations. Once a URL matched `docs.google.com/document/d/...`, the code always used `fetchGoogleDoc*` / `fetch_google_doc*`, which build `/export?format=...` URLs.

That made the capture flag mostly cosmetic for Google Docs. It also meant the freshest representation mentioned in the issue, the editor model embedded in `/edit` as `DOCS_modelChunk`, was unreachable from the CLI.

A second gap was token handling. Existing token support added an `Authorization` header to the public export request. Issue #72 requires `--capture api --api-token` to use the structured Google Docs REST API instead.

## Solution Options

1. **Only skip the Google Docs auto-detect block when `--capture browser` is set**: Rejected as incomplete. It would avoid `/export`, but generic browser HTML capture does not parse the canvas-backed editor model.
2. **Add a browser-model parser for `DOCS_modelChunk`**: Chosen. It directly addresses freshness and suggested-edit requirements.
3. **Use `/preview`, `/mobilebasic`, or `/pub` for browser capture**: Rejected. The issue documents staleness or publishing requirements for those routes.
4. **Replace all Google Docs capture with Docs API**: Rejected. Public export remains useful for unauthenticated `--capture api`, and browser capture includes model details outside the public export path.

## Fix Applied

- Added capture-method selection helpers:
  - `browser` -> browser/editor model
  - `api` without token -> public export
  - `api` with token -> Docs REST API
- Added JS browser-model capture that installs an init script, intercepts `DOCS_modelChunk`, extracts `docs-images-rt` CID mappings, and renders Markdown/HTML/text.
- Added Rust model and Docs API renderers, with Rust browser-model capture fetching `/edit` HTML and parsing embedded model chunks where available.
- Added Docs API renderers for paragraphs, tables, and inline images in both implementations.
- Updated the CLIs to route Google Docs through the selected backend and let screenshot-like browser formats continue through the normal browser path.
- Added regression tests for capture selection, model parsing with suggested edits, and Docs API table/image rendering.

## Validation

- `js-gdocs-before.log`: Jest could not start before dependency installation because `js/node_modules` was absent.
- `rust-gdocs-before.log`: Rust regression failed before implementation with missing capture-selection/model/API functions.
- `js-gdocs-after.log`: Targeted JS Google Docs unit tests pass.
- `rust-gdocs-after.log`: Targeted Rust Google Docs integration tests pass.
- `js-non-browser-test.log`: JS Jest tests pass when browser-binary-dependent suites are excluded.
- `js-full-test-browser-missing.log`: Full JS Jest reaches the browser suites and fails because local Playwright browser binaries are not installed in this environment.
- `js-lint.log`, `js-format-check.log`, and `js-duplication.log`: ESLint passes with existing warnings only, Prettier formatting passes, and duplication checking passes.
- `rust-test.log`, `rust-clippy.log`, and `rust-fmt.log`: Rust tests, clippy with `-D warnings`, and rustfmt checks pass.
- `validate-changeset.log`: The single pending JS changeset passes validation.
- `npm-install.log`: npm dependencies installed locally with an expected Node engine warning because the environment uses Node v20.20.2 while the package declares Node >=22 <23.

No upstream issue was opened. The root cause is local CLI routing and missing local parsers, not a defect in Google Docs, Google Drive, browser-commander, or the Docs API.
