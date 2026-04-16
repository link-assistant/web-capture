# Case Study: Issue #73 - Remove `/gdocs` as an API Route

**Issue:** [#73](https://github.com/link-assistant/web-capture/issues/73)
**Pull request:** [#74](https://github.com/link-assistant/web-capture/pull/74)
**Date opened:** 2026-04-16

## Summary

Issue #73 reports that `/gdocs` should not be a supported HTTP route because web-capture routes represent target output formats. Google Docs is a source URL family, not an output format, so exposing it as `GET /gdocs?url=<URL>` makes the API surface inconsistent.

## Collected Data

- `issue.json` - issue title, body, timestamps, and author metadata.
- `issue-comments.json` - issue discussion comments. This issue had no comments at analysis time.
- `pr-74.json` - current pull request metadata before implementation.
- `related-merged-prs.json` - recent merged pull requests related to Google Docs support.
- Existing code references found with `rg -n "gdocs|Google Docs|/gdocs|gdoc" .`.

## Timeline

1. **2026-04-10:** Issue #36 requested Google Docs capture support in both JavaScript and Rust.
2. **2026-04-10:** PR #37 added Google Docs support, including `/gdocs` API routes.
3. **2026-04-14:** PRs #54, #59, and #63 fixed Google Docs capture quality and parity bugs.
4. **2026-04-16:** Issue #73 clarified that `/gdocs` does not fit the route model because routes should be output formats.

## Requirements

1. Remove `/gdocs` route support from JavaScript.
2. Remove `/gdocs` route support from Rust.
3. Remove `/gdocs` from endpoint documentation and server help output.
4. Preserve Google Docs as a source URL capability for existing output formats unless explicitly removed later.
5. Keep JavaScript and Rust implementations aligned.

## Root Cause

The original Google Docs implementation mixed two separate concepts:

- **Source format/input URL:** Google Docs document URLs.
- **Target output format/API route:** markdown, html, image, archive, pdf, docx, fetch, stream.

`/gdocs` encoded the input source as an API route, unlike the rest of the API. That created an endpoint that looked like an output format even though Google Docs is not a target format.

## Solution

Remove only the HTTP route surface:

- JavaScript no longer imports or registers `gdocsHandler` in `js/src/index.js`.
- JavaScript CLI server help no longer advertises `/gdocs`.
- Rust no longer registers `.route("/gdocs", ...)` in `rust/src/main.rs`.
- Rust server startup logs no longer advertise `/gdocs`.
- Documentation endpoint tables no longer list `/gdocs`.

The shared Google Docs modules remain because the CLI still uses them when a Google Docs URL is captured as markdown, html, or archive output.

## Alternatives Considered

- **Delete all Google Docs code:** Rejected because the issue objects to `/gdocs` as a target route, not to Google Docs source capture through normal output formats.
- **Keep `/gdocs` but mark deprecated:** Rejected because the issue says the route should be removed.
- **Redirect `/gdocs` to `/markdown`:** Rejected because it would keep the unsupported route semantics alive.

## Verification Plan

- Add a JavaScript integration test asserting `GET /gdocs` returns 404.
- Add a JavaScript CLI help test asserting `/gdocs` is not advertised.
- Run JavaScript tests in a Node 22 environment with dependencies installed.
- Run Rust formatting and tests to confirm the route removal compiles.
