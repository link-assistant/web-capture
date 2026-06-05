# Case Study: Issue #106 - Google Docs browser-model capture quiescence

## Issue

Issue #106 reports that both CLIs use time-based readiness checks for Google
Docs browser-model capture:

- Rust returned as soon as the first non-empty `DOCS_modelChunk` snapshot was
  visible.
- JavaScript waited a fixed 8000 ms after `domcontentloaded`.

Both approaches can silently truncate large or slow Google Docs captures because
the editor can publish model chunks progressively.

## Preserved Data

The investigation data is stored in `data/`:

- `issue-106.json` and `issue-106-comments.json` - issue body and follow-up
  requirements.
- `pr-107.json`, `pr-107-comments.json`, `pr-107-review-comments.json`, and
  `pr-107-reviews.json` - prepared PR state and discussion surfaces.
- `ci-runs.json`, `ci-run-24913312377.log`, and `ci-run-24913312386.log` -
  initial branch CI state and logs.
- `related-issue-90.json`, `related-issue-100.json`, `related-issue-102.json`,
  `related-issue-104.json`, `related-pr-101.json`, `related-pr-103.json`, and
  `related-pr-105.json` - recent Google Docs capture work that exposed or
  depends on this behavior.
- `related-merged-google-docs-prs.json` - recent merged Google Docs PRs.
- `code-search-DOCS_modelChunk.json` and
  `code-search-wait_for_google_docs_model_chunks.json` - repository code-search
  results.
- `online-sources.md` - external references checked during analysis.
- `js-regression-before.log`, `js-regression-after.log`,
  `js-gdocs-tests.log`, `js-check.log`, `js-test-non-docker.log`,
  `rust-gdocs-tests.log`, `rust-fmt-check.log`, `rust-clippy.log`, and
  `rust-test-all.log` - local reproduction and verification logs.

## Timeline

| Date                 | Event                                                                            |
| -------------------- | -------------------------------------------------------------------------------- |
| 2026-04-20           | PR #91 introduced the Rust CDP browser-model path for Google Docs.               |
| 2026-04-24 13:43 UTC | PR #101 fixed browser capture regressions from issue #100.                       |
| 2026-04-24 20:20 UTC | PR #105 fixed browser-model HTML parity for issue #104.                          |
| 2026-04-24 21:44 UTC | Issue #106 was filed with repeated Rust truncation evidence.                     |
| 2026-04-24 21:45 UTC | PR #107 was opened from `issue-106-44f7ed55b657`; initial detect-only CI passed. |

## Requirements

1. Rust and JS must not return browser-model captures based only on elapsed time.
2. Rust must not return on the first non-empty model poll.
3. JS must replace the fixed post-load sleep with readiness detection.
4. Readiness must mean a non-empty model fingerprint is stable for a configurable
   window.
5. The fingerprint must include both chunk count and total serialized chunk
   payload size so same-count growth is detected.
6. A hard timeout must prevent hanging forever.
7. `WEB_CAPTURE_GDOCS_STABILITY_MS` and `WEB_CAPTURE_GDOCS_MAX_WAIT_MS` must be
   supported.
8. Logs should include operational diagnostics: poll count and stable duration.
9. Regression tests should make the race deterministic without depending on a
   private document.

## Root Cause

The Google Docs editor does not expose a single "model stream finished" signal
that this project can rely on. The existing browser capture hook correctly
records assignments and later pushes to `DOCS_modelChunk`, but the extraction
code did not wait for that recorded data to settle.

Rust polled CDP every 250 ms and returned on the first non-empty snapshot. When
chunk 1 arrived before chunk 2, Rust parsed an incomplete document. JavaScript
was less visibly flaky only because its 8000 ms sleep happened to cover the
reported fixture; any document or network path that streamed past that window
could still truncate.

No upstream issue was filed because the failure is in this repository's local
readiness logic. The external facts checked were API/protocol behavior:
`Page.addScriptToEvaluateOnNewDocument` is appropriate for installing the hook
before page scripts, and `Runtime.evaluate` supports polling page state by
value.

## Fix

Both CLIs now use the same readiness rule:

1. Poll the captured editor model.
2. Compute a fingerprint of `(chunks.length, serialized_chunk_payload_bytes)`.
3. Ignore empty fingerprints for success.
4. Reset stability tracking whenever the fingerprint changes.
5. Return only after the same non-empty fingerprint remains unchanged for the
   stability window.
6. Error after the hard timeout instead of returning a known-unstable snapshot.

Defaults:

- `WEB_CAPTURE_GDOCS_STABILITY_MS`: 1500 ms.
- `WEB_CAPTURE_GDOCS_MAX_WAIT_MS`: 30000 ms.
- Poll interval: 250 ms.

JavaScript also keeps `waitMs` as a deprecated test/API alias for the hard
timeout, while the new options are `modelStabilityMs`, `modelMaxWaitMs`, and
`modelPollMs`.

## Tests

- JavaScript unit test: `captureGoogleDocWithBrowser (issue #106) waits for
DOCS_modelChunk data to stop changing before parsing`.
  This fake browser exposes one chunk first and the complete two-chunk model only
  on later polls. The old code returned only "First paragraph"; the fixed code
  waits and includes "Second paragraph".
- Rust private unit tests:
  - `browser_model_fingerprint_includes_payload_size`
  - `browser_model_quiescence_resets_when_chunks_change`

Live multi-run Google Docs stability remains useful, but the deterministic unit
tests are the regression guard that does not depend on private documents or a
particular live streaming threshold.
