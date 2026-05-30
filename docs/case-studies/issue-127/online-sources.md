# Online Sources Checked

Research date: 2026-05-30

This file indexes the external sources used for the issue 127 Browserbase
comparison. Captured copies or metadata are preserved under `data/` where practical.

## Browserbase Official Sources

| Source                      | URL                                                                                 | Local artifact                                  | Notes                                                                |
| --------------------------- | ----------------------------------------------------------------------------------- | ----------------------------------------------- | -------------------------------------------------------------------- |
| Browserbase docs index      | https://docs.browserbase.com/llms.txt                                               | `data/browserbase-llms.txt`                     | Platform capabilities, docs map, integrations                        |
| Browserbase getting started | https://docs.browserbase.com/welcome/getting-started                                | `reference/web-capture-browserbase-overview.md` | Rendered by web-capture; public page presented a security checkpoint |
| Browserbase pricing         | https://www.browserbase.com/pricing                                                 | `data/browserbase-pricing.html`                 | Public pricing tiers and limits                                      |
| Browserbase plans docs      | https://docs.browserbase.com/account/billing/plans                                  | Included in web research                        | Public plan limits used in the report                                |
| Browserbase OpenAPI         | https://api.browserbase.com/v1/openapi.yaml                                         | `data/browserbase-openapi.v1.yaml`              | API schema snapshot                                                  |
| Create browser session API  | https://docs.browserbase.com/reference/api/create-a-session                         | `data/browserbase-create-browser-session.html`  | Session creation fields                                              |
| Use browser session docs    | https://docs.browserbase.com/platform/browser/getting-started/using-browser-session | Included in web research                        | Playwright, Puppeteer, Selenium, and Stagehand connection paths      |
| Browser contexts docs       | https://docs.browserbase.com/platform/browser/core-features/contexts                | Included in web research                        | Persistent storage behavior                                          |
| Observability docs          | https://docs.browserbase.com/platform/browser/observability/observability           | Included in web research                        | Live view, replay, inspector, and logs                               |
| Live view docs              | https://docs.browserbase.com/platform/browser/observability/live-view               | Included in web research                        | Real-time session watch/control                                      |
| Session recording docs      | https://docs.browserbase.com/platform/browser/observability/session-recording       | Included in web research                        | Session replay capability                                            |
| Stream replay docs          | https://docs.browserbase.com/platform/browser/observability/stream-session-replay   | Included in web research                        | HLS replay stream                                                    |
| Session logs docs           | https://docs.browserbase.com/platform/browser/observability/session-logs            | Included in web research                        | Network, console, error, and performance logs                        |
| Screenshots docs            | https://docs.browserbase.com/platform/browser/files/screenshots                     | Included in web research                        | Screenshot capture from a session                                    |
| Fetch API docs              | https://docs.browserbase.com/reference/api/fetch-a-page                             | `data/browserbase-fetch-api.html`               | Raw, Markdown, and JSON fetch formats                                |
| Search API docs             | https://docs.browserbase.com/reference/api/web-search                               | `data/browserbase-search-api.html`              | Search endpoint behavior                                             |
| Browserbase changelog       | https://docs.browserbase.com/changelog                                              | `data/browserbase-changelog.html`               | Product-change context                                               |

## Stagehand and Browserbase Ecosystem Sources

| Source                               | URL                                                             | Local artifact                            | Notes                                |
| ------------------------------------ | --------------------------------------------------------------- | ----------------------------------------- | ------------------------------------ |
| Stagehand docs index                 | https://docs.stagehand.dev/llms.txt                             | `data/stagehand-llms.txt`                 | Stagehand capability map             |
| Stagehand documentation              | https://docs.stagehand.dev/                                     | Included in web research                  | AI browser automation framework      |
| Browserbase Stagehand page           | https://www.browserbase.com/stagehand                           | Included in web research                  | Product positioning                  |
| npm `@browserbasehq/sdk`             | https://www.npmjs.com/package/@browserbasehq/sdk                | `data/npm-browserbase-sdk.json`           | Captured version `2.12.0`            |
| npm `@browserbasehq/stagehand`       | https://www.npmjs.com/package/@browserbasehq/stagehand          | `data/npm-stagehand.json`                 | Captured version `3.4.0`             |
| GitHub `browserbase/stagehand`       | https://github.com/browserbase/stagehand                        | `data/github-stagehand.json`              | Captured repository metadata         |
| GitHub Browserbase MCP server        | https://github.com/browserbase/mcp-server-browserbase           | `data/github-browserbase-mcp-server.json` | Captured repository metadata         |
| GitHub Browserbase repository search | https://github.com/search?q=org%3Abrowserbase&type=repositories | `data/github-browserbase-repos.json`      | Ecosystem repository search snapshot |

## web-capture Sources

| Source                             | URL or path                                               | Local artifact                           | Notes                                     |
| ---------------------------------- | --------------------------------------------------------- | ---------------------------------------- | ----------------------------------------- |
| Repository README                  | `README.md`                                               | Local repository                         | Feature and endpoint overview             |
| JavaScript package metadata        | `js/package.json`                                         | Local repository                         | Node package configuration                |
| Rust package metadata              | `rust/Cargo.toml`                                         | Local repository                         | Rust package configuration                |
| npm `@link-assistant/web-capture`  | https://www.npmjs.com/package/@link-assistant/web-capture | `data/npm-web-capture.json`              | Captured version `1.7.27`                 |
| Cargo registry search              | https://crates.io/search?q=web-capture                    | `data/cargo-search-web-capture.txt`      | Registry search snapshot                  |
| GitHub code search for Browserbase | GitHub CLI search                                         | `data/code-search-browserbase.json`      | No existing Browserbase integration found |
| GitHub code search for endpoints   | GitHub CLI search                                         | `data/code-search-js-api-endpoints.json` | Endpoint implementation reference         |

## Test Artifacts

| Artifact                                        | What it shows                                              |
| ----------------------------------------------- | ---------------------------------------------------------- |
| `logs/browserbase-fetch-api-unauth.http`        | Browserbase Fetch API requires `x-bb-api-key`              |
| `logs/browserbase-search-api-unauth.http`       | Browserbase Search API requires `x-bb-api-key`             |
| `logs/browserbase-sessions-api-unauth.http`     | Browserbase Sessions API requires `x-bb-api-key`           |
| `logs/web-capture-browserbase-overview.log`     | Rust web-capture run against Browserbase docs completed    |
| `logs/web-capture-browserbase-pricing.log`      | Rust web-capture run against Browserbase pricing completed |
| `reference/web-capture-browserbase-overview.md` | Captured output was a Vercel security checkpoint           |
| `reference/web-capture-browserbase-pricing.md`  | Captured output was a Vercel security checkpoint           |
