# Issue 104 Case Study

Issue 104 tracks cross-CLI Google Docs browser-model parity for marked text that spans soft line breaks and inline images.

The fixture in `fixtures/multiline-marked-inline-image-model.json` reproduces the failing shape without relying on a live Google Doc: one bold span covers three soft-broken lines, an inline image sits between the second and third lines, and the image model includes width and height metadata.

Expected outputs are stored next to the fixture so JS and Rust tests assert the same HTML and Markdown serialization:

- `multiline-marked-inline-image.expected.html`
- `multiline-marked-inline-image.expected.md`

The selected convention is to keep soft line breaks outside inline mark tags. For example, bold text across a soft break serializes as `<strong>line one</strong><br><strong>line two</strong>`, not `<strong>line one<br>line two</strong>`. Image dimensions from the editor model are preserved in both CLIs.

Validation logs:

- `js-gdocs-before.log` and `rust-gdocs-before.log` reproduce the original mark/newline failures.
- `js-gdocs-after.log` and `rust-gdocs-after.log` show the focused Google Docs suites passing after the fix.
- `js-test-hermetic.log`, `js-check.log`, `rust-test.log`, `rust-fmt-check.log`, and `rust-clippy.log` preserve the broader local checks.
- `js-test-non-docker.log` records the broader JS attempt that reached browser suites and failed because the local Playwright Chromium binary is not installed; the hermetic non-browser/non-Docker suite passed separately.
