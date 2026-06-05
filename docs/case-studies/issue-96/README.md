# Case Study: Issue #96 - Rust browser timeout and Google Docs capture gaps

- Issue: https://github.com/link-assistant/web-capture/issues/96
- Pull request: https://github.com/link-assistant/web-capture/pull/97
- Branch: `issue-96-3180a89c0b82`
- Public test document: https://docs.google.com/document/d/1f5zI2xOFpKa90v0GjamO_t7lqSdzMlaM/edit

## Data Preserved

The investigation data for #96 is committed under this directory:

- `data/issue.json` and `data/issue-comments.json` preserve the issue body
  and the case-study request.
- `data/pr-97.json`, `data/pr-97-review-comments.json`, and
  `data/pr-97-reviews.json` preserve the prepared pull request state.
- `data/issue-80.json`, `data/issue-90.json`, `data/issue-92.json`,
  `data/pr-82.json`, and `data/pr-93.json` preserve related issue and PR
  context.
- `data/code-search-*.json`, `data/npm-web-capture-1.7.11.json`,
  `data/cargo-search-web-capture.txt`, and `data/release-*.json` preserve
  package, release, and code-search evidence.
- `reference/reference-export.html` is the current Google Docs public export
  HTML for the reference document.
- `reference/js-api-after.md`, `reference/rust-api-before.md`,
  `reference/rust-api-after.md`, `reference/rust-browser-example-after.md`,
  and `reference/rust-browser-gdocs-after.md` preserve manual capture outputs
  used during the investigation.
- `logs/*-before.log` and `logs/*-after.log` preserve the failing and passing
  regression-test runs plus live smoke-command logs.
- `ci-logs/rust-checks-24714236603.log` preserves the current-head CI failure
  where the Windows Google Docs browser-model live test hit the workflow
  timeout.

## Timeline

| Date       | Event                                                                                                                                                                                    |
| ---------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 2026-04-16 | Issue #80 reports that Rust browser capture did not actually launch a browser.                                                                                                           |
| 2026-04-20 | PR #93 ships Google Docs v1.7.11 / Rust v0.3.3 follow-up fixes after #92.                                                                                                                |
| 2026-04-21 | Issue #96 reports Rust v0.3.3 browser timeout on any URL, remaining JS browser gaps, and API-mode formatting gaps.                                                                       |
| 2026-04-21 | Seven focused regressions were added and first captured as failures in `logs/js-gdocs-regression-before.log` and `logs/rust-gdocs-regression-before.log`.                                |
| 2026-04-21 | Rust live Google Docs browser capture reproduced the Chrome `--dump-dom` timeout; the model path now falls back to direct editor HTML fetch and the live test passes.                    |
| 2026-04-21 | This PR fixes the reproducible browser/model regressions, adds Rust browser launch diagnostics and safer Chrome flags, and improves public-export style preprocessing for both runtimes. |
| 2026-04-21 | Current-head CI then exposed a Windows-hosted runner hang in the browser-model live test. The fix skips headless Chrome for Google Docs editor model fetch on Windows and bounds the HTTP fallback. |

## Requirements

| ID  | Requirement                                                                   | Status in PR #97                                                                                                                                                                                                                                                                            |
| --- | ----------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| R1  | Rust `--capture browser` must not time out immediately.                       | Fixed for Google Docs browser-model capture by bounding the Chrome attempt and falling back to direct editor HTML model fetch. On Windows, Google Docs model capture uses the HTTP model fallback directly to avoid hosted-runner Chrome hangs. General browser capture also logs Chrome path/args/status/stderr and cleans temp profiles. `https://example.com` and the public Google Doc now pass locally. |
| R2  | JS browser tables must not gain empty columns from duplicate Docs separators. | Fixed and covered by JS/Rust parser tests.                                                                                                                                                                                                                                                  |
| R3  | JS browser nested list markdown must not gain extra blank lines.              | The model renderer now keeps list adjacency by list id. Public-export nested-list fidelity is still a follow-up because Google exports each nesting level as a separate CSS-only list.                                                                                                      |
| R4  | Multi-paragraph blockquotes must keep quote context.                          | Fixed for model rendering with `>` continuation lines. Public export now converts CSS-indented paragraphs to `<blockquote>`.                                                                                                                                                                |
| R5  | Nested bold/italic markers must stay balanced.                                | Fixed by rendering inline runs with marker-state transitions instead of wrapping each run independently.                                                                                                                                                                                    |
| R6  | Captured markdown should end with a newline.                                  | Fixed for model rendering in both runtimes.                                                                                                                                                                                                                                                 |
| R7  | API capture should preserve export formatting.                                | Improved: class-based bold, italic, strikethrough, empty anchor stripping, redirect unwrapping, non-breaking-space cleanup, and blockquote detection now run before generic converters. Nested public-export lists and converter-specific heading style remain follow-up work.              |
| R8  | Preserve issue data, logs, and a deep case study.                             | Done in this directory.                                                                                                                                                                                                                                                                     |

## Root Causes

### R1 - Rust browser timeout

The Rust browser path shells out to Chrome and uses `--dump-dom`. The issue
reporter saw an immediate timeout on macOS. The Linux runner did not reproduce
the `https://example.com` failure, but the live Google Docs browser-model test
did reproduce the same timeout pattern against `/edit`.

The code still had two actionable weaknesses:

1. Chrome was launched with a minimal flag set. Google Docs and some local
   Chrome installs are more reliable with the modern headless mode,
   background-service disabling, a per-run user data directory, and a virtual
   time budget.
2. The timeout path discarded the evidence needed to diagnose the next
   environment-specific failure, especially the Chrome executable path,
   command-line arguments, process status, and stderr.

PR #97 changes `rust/src/browser.rs` to log those details at debug level, use
`--headless=new`, `--disable-gpu`, `--disable-extensions`,
`--disable-dev-shm-usage`, `--disable-background-networking`,
`--disable-component-update`, `--disable-default-apps`, `--disable-sync`,
`--no-first-run`, `--no-default-browser-check`, `--no-sandbox`,
`--virtual-time-budget=8000`, and `--run-all-compositor-stages-before-draw`,
and to remove temporary Chrome profiles on timeout/error paths.

For Google Docs specifically, the real-browser capture is now a bounded
attempt. If Chrome does not return the editor DOM quickly, the model path falls
back to fetching the editor HTML directly and parsing the embedded
`DOCS_modelChunk` payload. That preserves the v0.3.2 behavior described in the
issue while keeping the diagnostics needed to debug future Chrome failures.

The first current-head CI run after the main fix passed Linux/macOS but timed
out on the Windows Google Docs browser-model live test:
`ci-logs/rust-checks-24714236603.log` lines 4879-4881 show the export-mode
live test passing, the browser-model test running for over 60 seconds, and the
workflow killing the step at 10 minutes. The follow-up change avoids launching
headless Chrome for this Google Docs editor-model path on Windows, where the
static editor HTML fallback already contains the model chunks needed by this
capture mode. The fallback fetch is now also wrapped in a 20-second timeout, and
Chrome processes launched by the generic browser helper use `kill_on_drop(true)`
so future timeouts clean up the child process.

### R2 - Empty table columns

Google Docs model chunks can emit both a form-feed style cell separator
(`0x1c`) and a newline (`0x0a`) for the same boundary. The parser treated both
as independent boundaries. For `A`, `B`, `C` this produced five cells:
`A`, empty, `B`, empty, `C`.

Both parsers now track the previous table-control character and ignore the
duplicate newline when the current table cell is empty.

### R3/R4/R6 - Block joins and final newline

The model renderers joined every block with a generic blank line and returned
the joined string as-is. That lost quote continuity for adjacent blockquote
paragraphs and left no final newline. The Rust renderer also did not retain
enough per-block metadata to distinguish adjacent list items in the same list
from unrelated blocks.

Both renderers now carry per-block quote/list context, use `\n>\n` between
adjacent quote blocks, keep same-list adjacency tight, and append one final
newline.

### R5 - Nested inline marker escaping

Inline content used to be rendered one run at a time. A bold run followed by a
bold+italic run closed and reopened markers independently, producing sequences
like `*****italic*****`. The new renderer groups adjacent runs with the same
link target and transitions the active marker state only when the style set
actually changes.

### R7 - API-mode export formatting

Google Docs public export HTML stores many semantics in generated CSS classes:
for example `.c7{font-weight:700}`, `.c19{font-style:italic}`, `.c21{text-decoration:line-through}`,
and `.c18{margin-left:24pt;margin-right:24pt}` for quoted paragraphs. The
generic Turndown and html2md pipelines remove style information before
markdown rendering, so those semantics disappeared.

The preprocessor now parses generated CSS class rules and rewrites matching
spans/paragraphs to semantic `<strong>`, `<em>`, `<del>`, and `<blockquote>`
markup before generic markdown conversion. It also removes standalone empty
anchors and normalizes `&nbsp;` residue.

The remaining API-mode gaps are caused by the generic converter stage after
preprocessing:

- Turndown escapes dots in numeric heading text, yielding `## 1\. Headings`.
- html2md emits H1/H2 as setext headings and adds extra standalone `>` lines
  around blockquotes.
- Both generic converters flatten Google Docs nested lists because the export
  represents each level as a separate top-level list with CSS-only indentation.
- Adjacent same-target links split by inline styling are still not merged into
  a single markdown link.

Those are local pipeline limitations, not proven upstream defects. No upstream
issue was filed from this pass because every confirmed failure has a local
workaround in either preprocessing or model rendering.

## Online Research Notes

- Chrome's current headless documentation describes the unified headless mode
  and `--dump-dom` behavior: https://developer.chrome.com/docs/chromium/headless
- Chrome's virtual-time guidance explains why `--virtual-time-budget` can make
  JS-heavy captures more deterministic: https://developer.chrome.com/blog/headless-chrome
- Google Drive export/download documentation confirms public export is the
  browser-less path for file content: https://developers.google.com/workspace/drive/api/guides/manage-downloads
- Google Docs API `documents` output is the structured authenticated
  alternative to public export HTML: https://developers.google.com/workspace/docs/api/reference/rest/v1/documents
- Turndown is the JS HTML-to-Markdown converter used here:
  https://github.com/mixmark-io/turndown
- html2md is the Rust HTML-to-Markdown converter used here:
  https://docs.rs/html2md

## Verification

Failing repro logs before the fix:

- `logs/js-gdocs-regression-before.log`: 7 failing Google Docs unit
  regressions.
- `logs/rust-gdocs-regression-before.log`: 7 failing Google Docs integration
  regressions.

Passing targeted checks after the fix:

```bash
cd js
npm test -- --runTestsByPath tests/unit/gdocs.test.js
```

Result: 63 passed.

```bash
cargo test --manifest-path rust/Cargo.toml --test integration gdocs -- --nocapture
```

Result: 49 passed.

Live smoke checks after the fix:

```bash
cargo run --manifest-path rust/Cargo.toml -- https://example.com --capture browser -f markdown --verbose -o docs/case-studies/issue-96/reference/rust-browser-example-after.md
```

Result: passed on this Linux runner.

```bash
cargo run --manifest-path rust/Cargo.toml -- "https://docs.google.com/document/d/1f5zI2xOFpKa90v0GjamO_t7lqSdzMlaM/edit" --capture browser -f markdown --verbose -o docs/case-studies/issue-96/reference/rust-browser-gdocs-after.md
```

Result: passed. The log shows Chrome timing out after the bounded attempt and
the editor-HTML fallback extracting one model chunk, four CID URLs, 121 blocks,
five tables, and 26 image records.

```bash
cd rust
GDOCS_INTEGRATION=1 cargo test --test integration gdocs_public_doc::live_browser_model_capture_of_public_document_preserves_markdown_features -- --nocapture
```

Result after the Windows-timeout fix: passed on this Linux runner in 15.45s.

```bash
cargo run --manifest-path rust/Cargo.toml -- "https://docs.google.com/document/d/1f5zI2xOFpKa90v0GjamO_t7lqSdzMlaM/edit" --capture api -f markdown --verbose -o docs/case-studies/issue-96/reference/rust-api-after.md
```

Result: passed.

```bash
cd js
node bin/web-capture.js "https://docs.google.com/document/d/1f5zI2xOFpKa90v0GjamO_t7lqSdzMlaM/edit" --capture api -f markdown --verbose -o ../docs/case-studies/issue-96/reference/js-api-after.md
```

Result: passed.
