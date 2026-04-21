# Case Study: Issue #100 - Google Docs browser capture must use real CDP data

- Issue: https://github.com/link-assistant/web-capture/issues/100
- Pull request: https://github.com/link-assistant/web-capture/pull/101
- Branch: `issue-100-99e0a350ea14`
- Public test document: https://docs.google.com/document/d/1f5zI2xOFpKa90v0GjamO_t7lqSdzMlaM/edit

## Data Preserved

This directory keeps the investigation reproducible:

- `data/issue-100.json` and `data/issue-100-comments.json` preserve the issue
  body and comments.
- `data/pr-101*.json` preserve the prepared pull request, discussion, reviews,
  and review comments.
- `data/related-issue-90.json` and `data/related-issue-92.json` preserve the
  public fixture and prior Google Docs capture context.
- `experiments/model-dump/model-data.json` is a raw live
  `DOCS_modelChunk` dump from the public Google Doc.
- `experiments/model-dump/summary.json` records the model structures that were
  relevant to tables, nested lists, and editor image URLs.
- `reference/js-browser-current.md` is the pre-fix JS browser capture that
  reproduced ghost table columns and nested ordered-list bullets.
- `reference/rust-browser-after-raw-cdp.md` is the post-fix Rust browser
  capture from the real CDP path.
- `reference/rust-browser-archive-after.zip` is the post-fix Rust browser
  archive with localized `docs-images-rt` image files.
- `logs/*before*`, `logs/*final*`, `logs/rust-browser-*`, and
  `logs/js-gdocs-public-live.log` preserve failing repros, passing test runs,
  live smoke commands, and archive listings.

## Timeline

| Date       | Event |
| ---------- | ----- |
| 2026-04-16 | Issue #72 and PR #75 introduced explicit Google Docs capture modes and the editor-model parser. |
| 2026-04-19 | Issue #90 added the public markdown feature fixture used by this investigation. |
| 2026-04-20 | PR #91 and PR #93 improved `DOCS_modelChunk` rendering, tables, lists, images, and export preprocessing. |
| 2026-04-21 | Issue #100 reported that Rust `--capture browser` still timed out through Chrome `--dump-dom`, both runtimes still produced live table ghost columns, Rust archive mode missed model images, and nested ordered lists were wrong. |
| 2026-04-21 | This PR added failing unit/integration regressions, dumped the live editor model, replaced the Rust Google Docs browser path with raw CDP capture, fixed table/list rendering in both runtimes, localized Rust model images for archives, and verified the public fixture live. |

## Requirements

| ID | Requirement | Status |
| -- | ----------- | ------ |
| R1 | Rust Google Docs `--capture browser` must use a real browser/CDP path and wait for `DOCS_modelChunk`; it must not silently fall back to direct editor HTML. | Fixed. Rust now launches headless Chrome with remote debugging, injects a model-capture script before navigation, navigates to `/edit`, and polls `Runtime.evaluate` until model chunks are available. |
| R2 | Browser-model tables must not create ghost empty columns from Google Docs live table separator patterns. | Fixed in JS and Rust parsers while preserving intentionally empty cells. |
| R3 | Nested ordered sub-lists must stay ordered and tightly grouped. | Fixed in JS and Rust renderers for the public fixture's separate-per-level list ids. |
| R4 | Rust browser archive mode must download and rewrite `docs-images-rt` images. | Fixed by carrying remote image metadata from model capture into archive localization. |
| R5 | Preserve the investigation data and a detailed case study. | Done in this directory. |

## Root Causes

### R1 - Rust used `--dump-dom` for a SPA

The previous Rust Google Docs browser path launched Chrome with `--dump-dom`.
That mode serializes the DOM after page loading, but Google Docs is a
JavaScript application whose useful editor model is assigned asynchronously to
`DOCS_modelChunk`. In practice the command timed out and the code then fetched
the editor HTML directly. That direct fetch was useful as a compatibility
fallback in older work, but it violated the current `--capture browser`
contract because a user explicitly asking for browser capture did not get
browser execution.

The fix uses Chrome DevTools Protocol directly:

1. Launch Chrome with `--headless=new` and `--remote-debugging-port=0`.
2. Read the `DevTools listening on ...` websocket URL from Chrome stderr.
3. Connect to CDP, create an `about:blank` target, and attach with flattened
   sessions.
4. Enable `Page` and `Runtime`.
5. Install a `Page.addScriptToEvaluateOnNewDocument` hook that wraps
   `window.DOCS_modelChunk` and array `push` calls.
6. Navigate to the Google Docs `/edit` URL.
7. Poll `Runtime.evaluate` until captured chunks are available, then parse the
   same model data as the JS path.

A short-lived implementation using `chromiumoxide` proved too brittle against
the locally installed Chrome because the crate rejected the newer
`Page.frameRequestedNavigation` event; the preserved failure log is
`logs/rust-browser-chromiumoxide-cdp-failure.log`. The final raw websocket loop
ignores unrelated CDP events and only handles responses matching the command id,
which is the behavior needed here.

### R2 - Live table separators were double counted

The live model dump showed table boundaries that differ from the simplified
fixtures used before this issue. Google Docs can emit a newline (`0x0a`) next
to a cell separator (`0x1c`) for the same boundary:

```text
Feature<0x0a><0x1c>Supported<0x0a><0x1c>Notes
```

The old parser treated both controls as independent cells, so a three-column
table became a five-column table with blanks between real cells. The parser now
marks the newline after a table separator as consumed and skips the duplicate
control only when it represents the same boundary. Real empty cells such as
`<0x1c><0x0a><0x1c>x<0x0a><0x1c><0x0a>` are still preserved.

### R3 - Google Docs uses separate list ids per nested ordered level

The public document's nested ordered list uses one list id for parents, another
for children, and another for grandchildren. The previous JS ordered-list
heuristic only recognized the parent items, so child ordered list items became
bullets. Both renderers also inserted blank lines when adjacent list blocks had
different list ids, which split nested lists apart.

The model renderers now infer the child and grandchild ordered fixtures as
ordered, join adjacent list blocks tightly across list ids, and indent nested
items with four spaces per level.

### R4 - Rust archive mode discarded model image URLs

The editor model already exposes `docs-images-rt` URLs through image nodes, and
the JS archive path already downloads them. Rust browser archive mode rendered
markdown and HTML from model capture but then created an archive with an empty
image list. `GDocsRenderedResult` now carries `remote_images`, and archive mode
downloads each unique URL, writes `images/image-01.png` style entries, and
rewrites both markdown and HTML.

## Online Research Notes

- Chrome Headless documentation explains current headless behavior and the
  `--dump-dom` command: https://developer.chrome.com/docs/chromium/headless
- The older Chrome headless blog documents virtual time and DOM dumping
  behavior for JavaScript-heavy pages:
  https://developer.chrome.com/blog/headless-chrome/
- CDP `Page.addScriptToEvaluateOnNewDocument` is the mechanism used to install
  the model hook before Google Docs scripts run:
  https://chromedevtools.github.io/devtools-protocol/tot/Page/#method-addScriptToEvaluateOnNewDocument
- CDP `Runtime.evaluate` is the mechanism used to read captured chunks from the
  page context:
  https://chromedevtools.github.io/devtools-protocol/tot/Runtime/#method-evaluate
- Google Docs REST `documents` remains the authenticated structured API path,
  but it is not equivalent to browser capture:
  https://developers.google.com/workspace/docs/api/reference/rest/v1/documents

## Verification

Failing repro logs before the fix:

```bash
cd js
npm test -- --runTestsByPath tests/unit/gdocs.test.js --runInBand
```

Result before the fix: 3 new issue #100 regressions failed in
`logs/js-gdocs-test-before-fix.log`.

```bash
cd rust
cargo test --test integration gdocs:: -- --nocapture
```

Result before the fix: 3 new issue #100 regressions failed in
`logs/rust-gdocs-test-before-fix.log`.

Passing targeted checks after the fix:

```bash
cd js
npm test -- --runTestsByPath tests/unit/gdocs.test.js tests/integration/gdocs-public-doc.test.js --runInBand
```

Result: 84 passed, 7 skipped, 2 suites passed. See
`logs/js-gdocs-tests-final.log`.

```bash
cd rust
cargo test --test integration gdocs:: -- --nocapture
cargo test --test integration gdocs_public_doc:: -- --nocapture
GDOCS_INTEGRATION=1 RUST_LOG=off cargo test --test integration gdocs_public_doc::live_browser_model_capture_of_public_document_preserves_markdown_features -- --nocapture
```

Result: 41 focused Google Docs tests passed, 8 public-doc tests passed, and the
live browser-model public-doc test passed. See `logs/rust-gdocs-unit-final.log`,
`logs/rust-gdocs-public-final.log`, and
`logs/rust-gdocs-public-live-browser-final.log`.

Static checks:

```bash
cd rust
cargo fmt --all -- --check
cargo clippy --all-targets --all-features -- -D warnings

cd ../js
npm run lint
npm run format:check
```

Result: Rust fmt and clippy passed. JS lint exited successfully with existing
warning-level complexity findings, and Prettier passed. See
`logs/rust-fmt-check-2.log`, `logs/rust-clippy-3.log`, `logs/js-lint.log`, and
`logs/js-format-check.log`.

Live smoke commands:

```bash
cd rust
RUST_LOG=off cargo run --quiet -- \
  'https://docs.google.com/document/d/1f5zI2xOFpKa90v0GjamO_t7lqSdzMlaM/edit' \
  --capture browser --format markdown -o -
```

Result: `reference/rust-browser-after-raw-cdp.md` contains the corrected table
`| Feature | Supported | Notes |`, nested ordered child item
`    1. Child item 1.1`, and empty-cell row `|  | x |  |`.

```bash
cd rust
RUST_LOG=off cargo run --quiet -- \
  'https://docs.google.com/document/d/1f5zI2xOFpKa90v0GjamO_t7lqSdzMlaM/edit' \
  --capture browser --format archive \
  -o ../docs/case-studies/issue-100/reference/rust-browser-archive-after.zip
```

Result: the archive contains `document.md`, `document.html`, and four localized
images. See `logs/rust-browser-archive-after-listing.log`.
