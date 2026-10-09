---
'@link-assistant/web-capture': patch
---

Fix CI/CD false positives, false negatives, and warnings (#177):

- Restore the `browser-commander` 0.10.0 pin required by open blocker #160 and repair the npm lock so `npm ci` installs again after the Dependabot update.
- Use Node's built-in `fetch` instead of `node-fetch`, removing the deprecated `node-domexception` package from the install. Transport diagnostics now include the underlying network error (for example `fetch failed: connect ECONNREFUSED ...`) and no longer report server-side network failures as possible CORS blocks.
- Load the `docx` library only when a DOCX is generated. Its bundled browser polyfills read `globalThis.localStorage` on import, so on Node 25+ every process that imported the server printed "ExperimentalWarning: localStorage is not available because --localstorage-file was not provided".
- Publish only the runtime files (`bin/`, `src/`, `README.md`, `CHANGELOG.md`) instead of the tests and fixtures, normalize `bin` and `repository` so `npm publish` no longer auto-corrects them, and install the pre-commit hook from the repository root instead of printing ".git can't be found" on every install.
