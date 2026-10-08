---
'@link-assistant/web-capture': patch
---

Publish only the runtime files (`bin/`, `src/`, `README.md`, `CHANGELOG.md`) instead of the tests and fixtures, normalize `bin` and `repository` so `npm publish` no longer auto-corrects them, and install the pre-commit hook from the repository root instead of printing ".git can't be found" on every install.
