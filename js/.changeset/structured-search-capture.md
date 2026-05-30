---
'@link-assistant/web-capture': minor
---

Add a structured search-provider capture contract (issue #130). New
`search({ query, provider, limit, captureMode })` library API, `GET /search?q=&provider=&format=json|markdown`
HTTP endpoint, and `web-capture search "<query>" --provider <provider> --format json|markdown`
CLI subcommand. Supported providers: `wikipedia` (default, CORS-friendly REST
API), `duckduckgo`, `google`, `bing`, and `brave` (HTML parsed server-side).
Results are normalized to a single machine-readable shape —
`{ query, provider, captureMode, capturedAt, results: [{ rank, title, url, snippet }], diagnostics: { status, blockedByCors, blockedByCaptcha, sourceUrl } }`
— and blocked or CAPTCHA-gated pages are surfaced through `diagnostics`
instead of failing silently. The same contract is mirrored in the Rust crate
so both implementations stay aligned.
