# Case Study: Issue #127 - Browserbase Feature Comparison

Research date: 2026-05-30

- Issue: https://github.com/link-assistant/web-capture/issues/127
- Pull request: https://github.com/link-assistant/web-capture/pull/134
- Working branch: `issue-127-238ff237e28b`

## Executive Summary

Browserbase and web-capture overlap on rendered page access, Markdown output, screenshots,
PDFs, downloads, and browser automation, but they are positioned differently.
Browserbase is a managed browser-agent platform. Its strongest differentiators are
hosted browser sessions, SDKs, Browserbase Fetch and Search APIs, identity and proxy
controls, CAPTCHA and stealth features, persisted browser contexts, live session
inspection, recordings, logs, Stagehand agent automation, integrations, and
usage-based billing.

web-capture is an open-source capture and conversion tool that can be self-hosted or
run locally. Its strongest differentiators are direct CLI/service usage, Markdown,
HTML, image, PDF, DOCX, and archive output, Google Docs-specific capture behavior,
dual JavaScript and Rust implementations, no vendor account requirement, and full
control over local deployment.

The recommended strategy is not to copy Browserbase as a full managed platform.
Instead, web-capture should keep its local capture/conversion core and add targeted
optional integrations where Browserbase has clear operational advantages:
remote browser sessions, remote Fetch/Search fallback, persistent contexts,
identity/proxy/CAPTCHA settings, and richer session metadata.

## Requirement Coverage

| Requirement from issue                                       | Status   | Evidence or output                                                               |
| ------------------------------------------------------------ | -------- | -------------------------------------------------------------------------------- |
| Compare features with Browserbase                            | Complete | Feature matrix and gap analysis below                                            |
| Test Browserbase responses if possible                       | Partial  | Public API probes returned HTTP 401 because no `BROWSERBASE_API_KEY` was present |
| Test web-capture responses                                   | Complete | Rust CLI smoke tests captured Browserbase public pages into `reference/`         |
| Produce a Markdown comparison report                         | Complete | This `README.md`                                                                 |
| Compile collected data under `./docs/case-studies/issue-127` | Complete | `data/`, `logs/`, and `reference/` folders                                       |
| Search online for additional facts and data                  | Complete | Official Browserbase, Stagehand, npm, and GitHub sources were captured           |
| List all requirements                                        | Complete | This table plus the parity requirements below                                    |
| Propose solutions or plans for each requirement              | Complete | Solution plans section below                                                     |
| Check known components and libraries                         | Complete | Component inventory section below                                                |

## Preserved Evidence

Local artifacts are stored with the report so future readers can review the exact
snapshot used for this comparison.

| Path                                            | Purpose                                            |
| ----------------------------------------------- | -------------------------------------------------- |
| `data/issue-127.json`                           | GitHub issue details                               |
| `data/issue-127-comments.json`                  | Issue comments snapshot                            |
| `data/pr-134.json`                              | Pull request metadata                              |
| `data/pr-134-comments.json`                     | Pull request conversation comments                 |
| `data/pr-134-review-comments.json`              | Pull request inline review comments                |
| `data/pr-134-reviews.json`                      | Pull request reviews                               |
| `data/recent-merged-prs.json`                   | Recent merged pull requests for style reference    |
| `data/code-search-browserbase.json`             | GitHub code search for Browserbase references      |
| `data/code-search-js-api-endpoints.json`        | GitHub code search for web-capture API endpoints   |
| `data/browserbase-llms.txt`                     | Browserbase docs index snapshot                    |
| `data/browserbase-openapi.v1.yaml`              | Browserbase OpenAPI snapshot                       |
| `data/browserbase-pricing.html`                 | Browserbase pricing page snapshot                  |
| `data/browserbase-changelog.html`               | Browserbase changelog page snapshot                |
| `data/browserbase-create-browser-session.html`  | Browser session API docs snapshot                  |
| `data/browserbase-fetch-api.html`               | Fetch API docs snapshot                            |
| `data/browserbase-search-api.html`              | Search API docs snapshot                           |
| `data/stagehand-llms.txt`                       | Stagehand docs index snapshot                      |
| `data/npm-browserbase-sdk.json`                 | npm metadata for `@browserbasehq/sdk`              |
| `data/npm-stagehand.json`                       | npm metadata for `@browserbasehq/stagehand`        |
| `data/npm-web-capture.json`                     | npm metadata for `@link-assistant/web-capture`     |
| `data/cargo-search-web-capture.txt`             | Cargo registry search output                       |
| `data/github-browserbase-repos.json`            | GitHub repository search for Browserbase           |
| `data/github-stagehand.json`                    | GitHub metadata for `browserbase/stagehand`        |
| `data/github-browserbase-mcp-server.json`       | GitHub metadata for Browserbase MCP server         |
| `logs/browserbase-fetch-api-unauth.http`        | Browserbase Fetch API unauthenticated probe        |
| `logs/browserbase-search-api-unauth.http`       | Browserbase Search API unauthenticated probe       |
| `logs/browserbase-sessions-api-unauth.http`     | Browserbase Sessions API unauthenticated probe     |
| `logs/web-capture-browserbase-overview.log`     | web-capture smoke-test log for Browserbase docs    |
| `logs/web-capture-browserbase-pricing.log`      | web-capture smoke-test log for Browserbase pricing |
| `reference/web-capture-browserbase-overview.md` | Rendered Markdown from Browserbase docs URL        |
| `reference/web-capture-browserbase-pricing.md`  | Rendered Markdown from Browserbase pricing URL     |

## Browserbase Snapshot

Browserbase describes itself as a browser-agent platform with one API key for hosted
browsers, Fetch, Search, Agent Identity, Functions, Model Gateway, Stagehand, and
integrations. The public docs emphasize cloud browser sessions that can be connected
to Playwright, Puppeteer, Selenium, or Stagehand.

Important platform capabilities found in the official docs:

- Hosted browser sessions created through `/v1/sessions`.
- Browser configuration for region, viewport, timeout, proxies, ad blocking,
  CAPTCHA solving, persisted contexts, extensions, keep-alive, and metadata.
- Session observability through live view, replay, Session Inspector, network logs,
  console logs, errors, and performance data.
- Fetch API through `/v1/fetch`, with `raw`, `markdown`, and schema-based `json`
  formats.
- Search API through `/v1/search`, returning web search results for a query.
- Persistent browser contexts for cookies, localStorage, IndexedDB, history, and
  extension data.
- Stagehand as an AI browser automation framework with deterministic Playwright
  control plus AI actions and extraction.
- MCP server and integrations for agent frameworks and model providers.
- Security and enterprise features including SSO, team controls, zero-data-retention
  references, and bring-your-own-storage references in the docs index.

Pricing and limits are a moving target, but the captured pricing and plans pages on
2026-05-30 show these public tiers:

| Tier      | Listed price | Included browser time | Concurrency              | Fetch/Search credits                     | Other visible limits                             |
| --------- | ------------ | --------------------- | ------------------------ | ---------------------------------------- | ------------------------------------------------ |
| Free      | $0/month     | 1 browser hour        | 3 concurrent browsers    | 1,000 Fetch and 1,000 Search credits     | 15 minute sessions                               |
| Developer | $20/month    | 50 browser hours      | 3 concurrent browsers    | 10,000 Fetch and 10,000 Search credits   | 15 minute sessions, 30 days data retention       |
| Startup   | $99/month    | 250 browser hours     | 50 concurrent browsers   | 100,000 Fetch and 100,000 Search credits | 15 minute sessions, 30 days data retention       |
| Scale     | Custom       | 1,000+ browser hours  | 100+ concurrent browsers | 1,000,000+ Fetch and Search credits      | Custom session duration, 30+ days data retention |

One official getting-started page still states that the free plan has one concurrent
browser and 60 minutes per month. The pricing and plans pages should be treated as
the more authoritative billing snapshot, but this discrepancy should be rechecked in
the Browserbase dashboard before building user-facing limit logic.

## web-capture Snapshot

web-capture currently exposes a capture and conversion service with CLI usage and
HTTP endpoints. From the repository README and endpoint search, the important
capabilities are:

- Render URL to Markdown.
- Render URL to HTML.
- Capture PNG or JPEG screenshots.
- Produce ZIP archives.
- Produce PDF output.
- Produce DOCX output.
- Fetch raw content through `/fetch`.
- Stream task progress through `/stream`.
- Use JavaScript and Rust implementations.
- Self-host or run locally without a third-party account.
- Support Google Docs-specific capture workflows.

Current package metadata captured on 2026-05-30:

| Package                       | Captured version               | Notes                                             |
| ----------------------------- | ------------------------------ | ------------------------------------------------- |
| `@link-assistant/web-capture` | `1.7.27`                       | npm package metadata snapshot                     |
| Rust package                  | `0.3.19` in local `Cargo.toml` | Cargo search snapshot was preserved               |
| `@browserbasehq/sdk`          | `2.12.0`                       | Official Browserbase Node SDK                     |
| `@browserbasehq/stagehand`    | `3.4.0`                        | Browserbase-maintained agent automation framework |

## Feature Matrix

| Capability                   | Browserbase                                              | web-capture today                                      | Gap or opportunity                                                        |
| ---------------------------- | -------------------------------------------------------- | ------------------------------------------------------ | ------------------------------------------------------------------------- |
| Deployment model             | Managed cloud browser-agent platform                     | Local/self-hosted CLI and service                      | Keep local-first model; add optional remote providers                     |
| Hosted browser sessions      | First-class `/v1/sessions` API                           | Local Playwright/Puppeteer-style rendering             | Optional Browserbase session connector would close this gap               |
| Automation framework support | Playwright, Puppeteer, Selenium, Stagehand               | Existing browser automation in JS/Rust implementations | Expose remote CDP/WebSocket connection as a capture backend               |
| Markdown output              | Fetch API supports Markdown format                       | Core output format                                     | Strong overlap; web-capture remains stronger for local conversion control |
| HTML output                  | Raw Fetch/session access can expose page content         | Core output format                                     | Strong overlap                                                            |
| Structured JSON extraction   | Fetch API supports schema-based JSON format              | Not a core documented output                           | Potential future schema extraction mode                                   |
| Search                       | Dedicated Search API                                     | No comparable hosted search endpoint                   | Optional Browserbase Search adapter or leave out of scope                 |
| Screenshots                  | Browser session screenshot support                       | Core image output                                      | Strong overlap; Browserbase can help with protected sites                 |
| PDF                          | Browser session file/PDF workflows                       | Core PDF output                                        | Strong overlap                                                            |
| DOCX                         | Not a visible Browserbase core output                    | Core DOCX output                                       | web-capture differentiator                                                |
| ZIP archive                  | Not a visible Browserbase core output                    | Core archive output                                    | web-capture differentiator                                                |
| Downloads/uploads            | Browser session file APIs                                | Archive and rendered output workflows                  | Could add remote download collection when using Browserbase               |
| Persistent contexts          | Context API for cookies, storage, history, extensions    | Local browser profile behavior only if configured      | Add explicit context import/export settings                               |
| Identity, proxies, region    | Built-in Agent Identity, proxies, regions                | Limited local deployment responsibility                | Add provider-neutral capture settings and map to Browserbase              |
| CAPTCHA and stealth          | Public plans list CAPTCHA solving and stealth options    | Not a managed feature                                  | Optional Browserbase fallback for difficult pages                         |
| Observability                | Live view, replay, inspector, network/console/error logs | Local logs and output files                            | Add metadata fields for remote session links and logs                     |
| Agent automation             | Stagehand and integrations                               | Deterministic capture service                          | Keep deterministic core; add Stagehand examples or optional extraction    |
| Model gateway                | Browserbase platform feature                             | Out of scope today                                     | Do not implement unless extraction workflows require it                   |
| Functions/runtime            | Browserbase hosted function capability                   | Not a hosted runtime                                   | Prefer deployment examples over building a platform runtime               |
| MCP integration              | Browserbase MCP server exists                            | No direct Browserbase MCP integration found            | Possible example integration, not core capture functionality              |
| Billing and quotas           | Usage-based SaaS tiers                                   | User controls own infrastructure cost                  | Document provider costs if optional connector is added                    |
| Vendor independence          | Requires Browserbase account for cloud features          | Open-source local use                                  | Preserve no-account path as a product boundary                            |

## Known Components and Libraries

| Component                                                     | Source                                  | Fit for web-capture                                                 |
| ------------------------------------------------------------- | --------------------------------------- | ------------------------------------------------------------------- |
| `@browserbasehq/sdk`                                          | Browserbase npm package                 | Best candidate for optional Browserbase session and API integration |
| Browserbase REST/OpenAPI                                      | `data/browserbase-openapi.v1.yaml`      | Useful for generated clients, mocks, and error contract tests       |
| Browserbase Fetch API                                         | `/v1/fetch`                             | Optional remote Markdown/raw/JSON fetch backend                     |
| Browserbase Search API                                        | `/v1/search`                            | Optional discovery helper, not core capture functionality           |
| Browserbase Sessions API                                      | `/v1/sessions`                          | Optional remote browser backend                                     |
| Browserbase contexts                                          | Browserbase docs                        | Optional persisted cookies/storage/history configuration            |
| Browserbase observability APIs and dashboard links            | Browserbase docs                        | Optional debug metadata for remote sessions                         |
| `@browserbasehq/stagehand`                                    | Browserbase npm package                 | Optional AI-assisted extraction examples or experiments             |
| Browserbase MCP server                                        | `browserbase/mcp-server-browserbase`    | Possible agent integration example; not needed for core CLI/service |
| Playwright/Puppeteer/Selenium remote connections              | Browserbase docs and existing ecosystem | Connection layer for Browserbase-hosted sessions                    |
| Existing web-capture JS implementation                        | Local repository                        | Reference path for CLI/service capture behavior                     |
| Existing web-capture Rust implementation                      | Local repository                        | Reference path for compiled CLI and service behavior                |
| Existing Markdown/HTML/image/PDF/DOCX/archive output pipeline | Local repository                        | Should be reused by any optional remote backend                     |

## Smoke Tests

### Browserbase API probes

No `BROWSERBASE_API_KEY` was available in the environment, so authenticated free-tier
or paid-tier tests were not run. Public unauthenticated probes were still useful
because they confirmed the expected authentication boundary:

| Endpoint                                       | Probe result                     | Preserved log                               |
| ---------------------------------------------- | -------------------------------- | ------------------------------------------- |
| `POST https://api.browserbase.com/v1/fetch`    | HTTP 401, missing `x-bb-api-key` | `logs/browserbase-fetch-api-unauth.http`    |
| `POST https://api.browserbase.com/v1/search`   | HTTP 401, missing `x-bb-api-key` | `logs/browserbase-search-api-unauth.http`   |
| `POST https://api.browserbase.com/v1/sessions` | HTTP 401, missing `x-bb-api-key` | `logs/browserbase-sessions-api-unauth.http` |

The common response body was:

```json
{
  "statusCode": 401,
  "error": "Unauthorized",
  "message": "Missing x-bb-api-key header"
}
```

### web-capture probes

The Rust CLI was run against two public Browserbase pages:

- `https://docs.browserbase.com/welcome/getting-started`
- `https://www.browserbase.com/pricing`

Both runs completed and produced Markdown files, but the rendered content was the
Vercel security checkpoint page rather than the target product content. This is an
important comparison finding: local web-capture can successfully render and convert
the page it receives, but modern protected sites may present an interstitial before
the desired content is available. Browserbase's managed identity, proxy, CAPTCHA,
and stealth features are directly relevant to this failure mode.

## Root-Cause Findings

1. Browserbase is broader than a capture library.
   The issue title asks for a feature comparison, but Browserbase includes platform
   services that web-capture should not automatically treat as product parity
   requirements.

2. The strongest direct overlap is Fetch and rendered browser output.
   Browserbase Fetch Markdown and web-capture Markdown are the most comparable
   outputs. Browserbase sessions and web-capture image/PDF/HTML outputs also
   overlap.

3. The largest practical gap is operational browsing reliability.
   The web-capture smoke tests reached a security checkpoint on Browserbase public
   pages. This points to identity, proxy, CAPTCHA, stealth, and managed session
   features as the most valuable optional integration areas.

4. web-capture has local output formats Browserbase does not visibly emphasize.
   DOCX and ZIP archive output are clear web-capture differentiators.

5. Browserbase's pricing and public limits can change.
   The preserved pricing snapshot should be referenced by date and verified before
   implementation that depends on exact quotas.

## Parity Requirements and Solution Plans

### R1. Preserve local capture and conversion as the default

Plan:

- Keep current CLI/service behavior as the default path.
- Do not require Browserbase credentials for existing Markdown, HTML, image, PDF,
  DOCX, archive, fetch, or stream endpoints.
- Keep Browserbase-specific code behind optional configuration.

Suggested implementation shape:

- Add a provider abstraction only if at least two capture backends need shared
  behavior: local browser and Browserbase remote browser.
- Preserve the current local browser pipeline as the reference implementation.

### R2. Add an optional Browserbase remote browser backend

Plan:

- Accept `BROWSERBASE_API_KEY` and `BROWSERBASE_PROJECT_ID` from environment or
  explicit config.
- Create a Browserbase session through the SDK or REST API.
- Connect Playwright or Puppeteer to the returned remote browser endpoint.
- Reuse web-capture's existing conversion pipeline after navigation.
- Return remote session metadata in debug output.

Known components:

- `@browserbasehq/sdk`
- Browserbase `/v1/sessions`
- Playwright or Puppeteer remote browser connection
- Existing JS capture pipeline

Testing approach:

- Unit-test API request construction with mocked Browserbase responses.
- Integration-test only when credentials are present.
- Add a skipped-by-default test marker for authenticated Browserbase runs.

### R3. Add optional Browserbase Fetch fallback

Plan:

- Add a mode such as `remoteFetchProvider=browserbase` or a CLI equivalent.
- Use Browserbase Fetch for pages that fail local rendering or for users who
  explicitly select remote fetch.
- Support Browserbase Fetch `markdown` output as a direct passthrough option.
- Support Browserbase Fetch `raw` output as input to existing converters.

Known components:

- Browserbase `/v1/fetch`
- Browserbase OpenAPI schema preserved in `data/browserbase-openapi.v1.yaml`
- Existing `/fetch` endpoint and Markdown conversion code

Testing approach:

- Mock HTTP responses for raw, Markdown, auth failure, quota failure, and rate
  limit failure.
- Ensure local fallback still works when Browserbase is not configured.

### R4. Add optional Browserbase Search adapter

Plan:

- Treat Search as adjacent functionality, not required for capture parity.
- If added, expose it as a separate helper endpoint or documented integration.
- Avoid mixing search results with capture output unless a workflow explicitly asks
  for discovery plus capture.

Known components:

- Browserbase `/v1/search`

Testing approach:

- Mock search API responses.
- Validate query, result count, auth failure, and quota failure handling.

### R5. Support context, identity, proxy, CAPTCHA, and region settings

Plan:

- Define provider-neutral capture options for region, viewport, timeout, proxy,
  context ID, CAPTCHA solving, ad blocking, and keep-alive.
- Map supported options into Browserbase session creation.
- Ignore or warn on options unsupported by the selected backend.
- Never log secrets, proxy credentials, or session tokens.

Known components:

- Browserbase session `browserSettings`
- Browserbase context APIs
- Existing browser launch/navigation options

Testing approach:

- Unit-test option normalization.
- Snapshot-test Browserbase session payloads with sensitive fields redacted.

### R6. Improve observability metadata

Plan:

- When a Browserbase backend is used, include session ID, live-view URL if
  available, replay URL if available, and log retrieval hints in debug metadata.
- For local runs, preserve current logs and consider a structured capture metadata
  file.
- Keep verbose tracing off by default.

Known components:

- Browserbase live view, replay, Session Inspector, and session logs
- Existing local logs

Testing approach:

- Mock session metadata and assert sanitized output.
- Ensure default output remains stable unless debug metadata is requested.

### R7. Explore Stagehand-assisted extraction separately

Plan:

- Do not replace deterministic capture with Stagehand.
- Add examples or experiments for AI-assisted extraction where deterministic
  selectors or raw conversion are insufficient.
- Keep generated extraction results separate from canonical Markdown capture.

Known components:

- `@browserbasehq/stagehand`
- Stagehand `act`, `extract`, and `observe` APIs
- Browserbase hosted sessions or local Playwright

Testing approach:

- Keep experiments under `experiments/` until a stable API is required.
- Use mocked model responses for unit tests.

### R8. Add structured JSON extraction only if there is a product need

Plan:

- Browserbase Fetch already supports schema-based JSON extraction.
- web-capture could expose schema extraction as an optional mode, but it should not
  be bundled into basic Markdown capture.
- Prefer a small schema-driven adapter before adding a broad extraction framework.

Known components:

- Browserbase Fetch `json` format
- JSON Schema or Zod-style validation, depending on existing project conventions

Testing approach:

- Unit-test schema validation and error reporting.
- Preserve raw source and extraction output separately for auditability.

### R9. Document cost and operational tradeoffs

Plan:

- If Browserbase support is added, document that remote sessions consume Browserbase
  account quotas.
- Surface quota and billing errors clearly.
- Keep local execution available for users who do not want external service costs.

Known components:

- Browserbase pricing/plans pages
- Browserbase API errors for auth, quota, and rate limits

Testing approach:

- Mock HTTP 401, 402, 403, and 429 errors.
- Assert user-facing messages identify the provider and likely remediation.

## Recommended Roadmap

| Priority | Work item                                                                            | Rationale                                                                 |
| -------- | ------------------------------------------------------------------------------------ | ------------------------------------------------------------------------- |
| P0       | Land this case-study report                                                          | Satisfies issue documentation and planning requirements                   |
| P1       | Add optional Browserbase session backend behind credentials                          | Directly addresses the largest reliability gap for protected sites        |
| P1       | Add tests with mocked Browserbase SDK/API responses                                  | Enables implementation without requiring secrets in CI                    |
| P1       | Add clear provider error handling for auth/quota/rate limits                         | Prevents opaque failures when remote provider calls fail                  |
| P2       | Add provider-neutral settings for region, proxy, context, CAPTCHA, viewport, timeout | Makes remote and local capture configuration consistent                   |
| P2       | Add Browserbase Fetch passthrough/fallback mode                                      | Gives users a simple managed Markdown/raw fetch path                      |
| P2       | Add observability metadata for remote sessions                                       | Helps debug remote capture failures                                       |
| P3       | Add Browserbase Search integration if discovery workflows are requested              | Useful but not core capture parity                                        |
| P3       | Add Stagehand examples or experiments                                                | Useful for agentic extraction without destabilizing deterministic capture |
| P3       | Evaluate structured JSON extraction                                                  | Should be driven by real product workflows                                |

## Non-Goals

- Rebuilding Browserbase's billing, team management, managed runtime, or model
  gateway inside web-capture.
- Making Browserbase a required dependency.
- Changing existing output formats or removing local/self-hosted workflows.
- Running authenticated Browserbase tests in CI without a secret strategy and
  quota controls.

## Verification Commands

The following checks were run during the investigation:

```bash
gh issue view https://github.com/link-assistant/web-capture/issues/127 --json title,body,comments,labels,state,createdAt,updatedAt,url
gh api repos/link-assistant/web-capture/issues/127/comments --paginate
gh pr view 134 --repo link-assistant/web-capture --json title,body,comments,isDraft,headRefName,baseRefName,state,url
gh api repos/link-assistant/web-capture/pulls/134/comments --paginate
gh api repos/link-assistant/web-capture/issues/134/comments --paginate
gh api repos/link-assistant/web-capture/pulls/134/reviews --paginate
gh search code --owner link-assistant "browserbase"
gh search code --owner link-assistant "app.get('/markdown'"
curl -i -sS -X POST https://api.browserbase.com/v1/fetch
curl -i -sS -X POST https://api.browserbase.com/v1/search
curl -i -sS -X POST https://api.browserbase.com/v1/sessions
RUST_LOG=info cargo run --bin web-capture -- --url https://docs.browserbase.com/welcome/getting-started --format markdown
RUST_LOG=info cargo run --bin web-capture -- --url https://www.browserbase.com/pricing --format markdown
```

Authenticated Browserbase tests were intentionally not run because no
`BROWSERBASE_API_KEY` was available in the environment.
