# Case study: MinerU practices for Unlicense-compatible Rust and JavaScript

Issue: [link-assistant/web-capture#143](https://github.com/link-assistant/web-capture/issues/143)

Research date: 2026-07-27

MinerU snapshot:
[`79d6d8d`](https://github.com/opendatalab/MinerU/commit/79d6d8d79fb8f3ddba5cc34c07a16f0ec36f56c7)
(release 3.4.4)

web-capture baseline:
[`4c5443e`](https://github.com/link-assistant/web-capture/commit/4c5443e1ab83a4a250457933079eaf2fbd61ed21)
(JavaScript 1.10.10, Rust 0.3.32)

## Executive decision

MinerU and web-capture overlap at Markdown/JSON output, but they solve different
primary problems:

- MinerU parses local PDFs, images, and Office files with layout, OCR, formula,
  table, and vision-language models.
- web-capture renders URLs and exports the resulting web content through
  equivalent Rust and JavaScript CLIs and HTTP services.

Therefore, "use all best practices" must not mean copying every MinerU feature or
source file. That would silently redefine this project, require large ML
runtimes, break the Rust/JavaScript parity promise, and violate the requested
Unlicense provenance.

The defensible interpretation is:

1. identify every transferable engineering practice in the pinned MinerU
   snapshot;
2. distinguish practices from product features and MinerU-specific
   implementation choices;
3. map each practice to current web-capture coverage;
4. define an Unlicense-safe target architecture and acceptance test; and
5. sequence implementation so every release remains useful and compatible.

This case study completes that work. It is the specification for subsequent,
bounded implementation PRs. It deliberately introduces no untested parser,
model dependency, or public API.

## Issue reconstruction

Issue 143 contains only its title. There is no body, comment, screenshot,
attachment, or acceptance test. The labels are `documentation` and
`enhancement`.

The title yields three explicit requirements:

| ID  | Requirement               | Interpretation used here                                                                                                        |
| --- | ------------------------- | ------------------------------------------------------------------------------------------------------------------------------- |
| R1  | Use MinerU best practices | Audit the current upstream project and retain practices that improve correctness, operability, or extensibility                 |
| R2  | Rust/JavaScript           | Every public contract must be implementable and tested in both workspaces; model engines may be external processes              |
| R3  | Unlicense (Public Domain) | No MinerU code, model, fixture, or restricted dataset is copied; dependencies and generated artifacts require provenance review |

The word "all" cannot be tested until "best practice" is made finite. This study
defines 20 transferable practices, `BP-01` through `BP-20`, and gives each one a
coverage state, target, and verification gate.

## Research method

1. Read issue 143 and all issue comments.
2. Read PR 146, conversation comments, inline comments, and reviews.
3. Review recent merged web-capture PRs, especially the Browserbase comparison
   and FormalAI contract precedents.
4. Inspect web-capture's README, architecture, package manifests, CLIs,
   endpoints, source layout, test layout, parity guard, and license.
5. Clone MinerU at the current default-branch commit and inspect its README,
   license, package groups, CLI, API, router, backend layout, outputs,
   configuration, tests, and workflows.
6. Check MinerU's latest release and its official benchmark project,
   OmniDocBench.
7. Separate observed facts, upstream claims, and recommendations.
8. Preserve compact metadata and link every online source.

See [`online-sources.md`](./online-sources.md) and [`data/`](./data/).

## Timeline

| Date       | Event                                                             | Relevance                                                                 |
| ---------- | ----------------------------------------------------------------- | ------------------------------------------------------------------------- |
| 2024-02-29 | MinerU repository created                                         | Upstream project begins                                                   |
| 2024-09    | Original MinerU technical report published                        | Documents the parsing pipeline and benchmark motivation                   |
| 2026-04-18 | MinerU 3.1 changes from AGPLv3 to a custom Apache-derived license | Current source is still not Unlicense-compatible by simple relicensing    |
| 2026-06-18 | MinerU 3.4 upgrades pipeline OCR and model-cache behavior         | Current best-practice snapshot includes explicit model lifecycle handling |
| 2026-07-10 | MinerU 3.4.4 released                                             | Snapshot release used by this study                                       |
| 2026-07-14 | web-capture issue 143 opened                                      | Requests MinerU practices in Rust/JavaScript under Unlicense              |
| 2026-07-27 | PR 146 opened and research performed                              | Case-study baseline                                                       |

## Root cause of the ambiguity

The issue compares products at the output level ("document to Markdown/JSON")
without defining the different input and execution models.

```text
MinerU
local/remote document
  -> classify/native extract/OCR/layout/VLM
  -> page/block intermediate representation
  -> Markdown + JSON + images + debug overlays

web-capture
URL
  -> fetch/browser/site-specific extraction
  -> HTML or site-specific model
  -> Markdown/HTML/text/image/PDF/DOCX/archive/JSON
```

The root cause is not a missing one-line dependency. It is the absence of a
shared, typed document model between acquisition and serialization in
web-capture. Without that seam, adding PDF parsing, OCR, alternate engines,
debug overlays, or benchmarks independently would multiply special cases across
two implementations.

The first code milestone should consequently be a versioned capture-document
contract, not an embedded VLM.

## Capability boundary

Status values:

- **Yes**: public behavior exists in both implementations.
- **Partial**: behavior exists only for a subset, is site-specific, or lacks a
  shared contract.
- **No**: no supported public behavior was found.
- **Different**: web-capture intentionally solves the inverse or adjacent task.

| Capability                      | MinerU 3.4.4                                      | web-capture baseline                                | Status                     |
| ------------------------------- | ------------------------------------------------- | --------------------------------------------------- | -------------------------- |
| URL acquisition                 | Local document path; remote inference is separate | Core purpose; browser and direct fetch              | Different                  |
| Local PDF/image input           | Parses documents                                  | CLI expects URLs                                    | No                         |
| DOCX/PPTX/XLSX input            | Native parsing                                    | DOCX is an output format                            | Different                  |
| Render JavaScript web apps      | Not the core parser path                          | Puppeteer/Playwright/browser-commander              | web-capture advantage      |
| Browser screenshots             | Parsing visualization, not general capture        | PNG/JPEG, viewport/full-page, themes                | web-capture advantage      |
| HTML/Markdown/text output       | Markdown plus structured outputs                  | All three                                           | Yes                        |
| PDF/DOCX output                 | Original/derived parsing artifacts                | Page export is currently richer in JavaScript       | Partial/different          |
| Archive with assets             | Output directory/ZIP responses                    | ZIP with localized images                           | Yes                        |
| Structured JSON                 | Page/block middle JSON and flat content list      | Converter/search/dialog JSON                        | Partial                    |
| Reading order                   | Explicit page block order                         | DOM/landmark order and site models                  | Partial                    |
| Bounding boxes/page coordinates | Core structured output                            | No general public schema                            | No                         |
| Tables                          | Detects/recognizes tables                         | HTML conversion and structured converter results    | Partial                    |
| Formula recognition             | Formula OCR to LaTeX                              | Preserves/extracts existing web LaTeX               | Different                  |
| OCR                             | 109-language upstream claim                       | No OCR engine                                       | No                         |
| Scanned/garbled input detection | Automatic                                         | No document classifier                              | No                         |
| Multiple parsing backends       | pipeline/VLM/hybrid/local/remote                  | browser/API and converter engines                   | Partial                    |
| Backend effort/quality control  | Explicit trade-off                                | Converter/capture choice, no unified quality policy | Partial                    |
| Page range                      | Yes                                               | Not meaningful for ordinary web pages               | Future document input only |
| Batch input                     | Files/directories and service queue               | JSON/MJS configuration exists; no shared task queue | Partial                    |
| Async task API                  | Task IDs, polling, retention                      | Synchronous HTTP endpoints                          | No                         |
| Health/capacity response        | Protocol and queue information                    | Basic JS `/health`; no equivalent Rust contract     | Partial                    |
| Multi-worker router             | Local/remote workers and accelerators             | External deployment concern                         | No                         |
| Debug overlays                  | Layout/span PDFs                                  | Logs and screenshots, no block overlay              | Partial                    |
| Model cache/source selection    | Explicit                                          | Browser dependency management only                  | Different                  |
| CPU/GPU/remote inference        | Multiple modes                                    | CPU plus browser process                            | Future external backend    |
| Benchmark harness               | OmniDocBench integration/claims                   | Functional tests; no quality corpus                 | No                         |
| Rust/JavaScript parity          | Python product                                    | Explicit repository invariant                       | web-capture requirement    |
| Public-domain project license   | Custom license                                    | Unlicense                                           | web-capture requirement    |

## Transferable best-practice catalog

### BP-01: Separate acquisition, analysis, and serialization

**Observation:** MinerU's backend-specific analyzers converge on intermediate
content builders rather than having every CLI/API route format model output
directly.

**Current state:** web-capture has reusable modules, but several formats and
site-specific paths still own their own result shapes.

**Target:** `Source -> Acquirer -> Analyzer -> CaptureDocument -> Renderer`.
CLI and HTTP handlers must be thin adapters around that pipeline.

**Gate:** the same fixture produces schema-equivalent JSON in Rust and
JavaScript, then Markdown and archive renderers consume only that JSON.

### BP-02: Use a versioned intermediate document model

**Observation:** MinerU exposes detailed `middle.json` and a simpler
`content_list.json`, including page indexes, block types, coordinates, and
reading order.

**Current state:** structured Kreuzberg, search, dialog, and Google Docs results
are unrelated contracts.

**Target:** introduce `CaptureDocument v1` as the stable public envelope and
keep engine-native output under an explicitly unstable diagnostics field.

**Gate:** JSON Schema fixtures and cross-language golden tests reject unknown
versions and verify deterministic serialization.

### BP-03: Provide rich and flat structured views

**Observation:** a rich page/block model serves diagnostics while a flat content
list serves downstream consumers.

**Target:** `pages[].blocks[]` is canonical; `content[]` is a derived,
reading-order view. Neither duplicates binary assets.

**Gate:** flattening is deterministic and preserves each block's source ID,
page, type, and order.

### BP-04: Preserve provenance and geometry

**Observation:** MinerU records page index, normalized bounding boxes, block
type, and producer details.

**Target:** every block carries a stable ID, source locator, producer, and
optional `page`/`bbox`. DOM sources may use a CSS/XPath locator and viewport
rectangle; non-paged sources may omit `page`.

**Gate:** browser fixture blocks trace back to DOM nodes; document fixtures trace
back to page coordinates.

### BP-05: Make reading order explicit

**Observation:** multi-column parsing succeeds only when human reading order is
modeled separately from extraction order.

**Current state:** web-capture reorders page landmarks and has specialized
Google Docs ordering, but does not expose the result.

**Target:** every sibling block has an integer `order`; renderers never infer
order from coordinates.

**Gate:** two-column and reordered-landmark fixtures produce the expected
linearized sequence in both languages.

### BP-06: Route by source and confidence

**Observation:** MinerU distinguishes native Office parsing, text PDFs, OCR, VLM,
and hybrid paths.

**Target:** a source probe selects a capable backend using declared
capabilities. It records why it selected or rejected each backend. Silent
fallback is forbidden.

**Gate:** routing-table unit tests cover MIME mismatch, extension mismatch,
unsupported source, and fallback diagnostics.

### BP-07: Expose quality/cost profiles

**Observation:** MinerU offers backends and an `effort` setting to trade speed
for capability.

**Target:** stable profiles `fast`, `balanced`, and `accurate`, translated to
backend-specific options. Existing low-level options remain available.

**Gate:** profile resolution is pure, documented, serialized into provenance,
and identical in Rust/JavaScript.

### BP-08: Keep expensive engines out of the core

**Observation:** MinerU splits dependency groups and supports HTTP clients for
remote inference.

**Target:** the Unlicense-compatible core owns contracts and orchestration. OCR/VLM
engines are optional adapters or OpenAI-compatible/HTTP services. Installing
web-capture must not download model weights.

**Gate:** default packages build/test without an accelerator or model; remote
adapter contract tests use a mock server.

### BP-09: Make feature switches uniform

**Observation:** table, formula, OCR, image analysis, page range, and artifact
controls are explicit.

**Target:** common options live in one request type and apply consistently to
CLI, HTTP, Rust, and JavaScript. Unsupported combinations return a structured
error.

**Gate:** generated option matrices verify CLI/API parity and negative cases.

### BP-10: Treat artifacts as first-class outputs

**Observation:** MinerU emits Markdown, images, original input, intermediate
JSON, model output, and visualizations.

**Current state:** web-capture archives localize images but has no general
manifest.

**Target:** every run returns an artifact manifest with media type, role, byte
size, checksum, and relative path. Archives are renderings of that manifest.

**Gate:** golden ZIP tests validate manifest paths, checksums, no traversal, and
deterministic ordering.

### BP-11: Build observability into the model

**Observation:** layout and span overlays make quality failures inspectable.

**Target:** opt-in debug artifacts include source snapshot, backend decisions,
block overlays, warnings, timings, and sanitized engine output. Defaults remain
quiet.

**Gate:** a failing-layout fixture produces enough information to identify
acquisition, ordering, recognition, or rendering as the failing stage.

### BP-12: Offer synchronous and asynchronous service contracts

**Observation:** MinerU uses task submission, polling, result retrieval,
retention, and cleanup while retaining a synchronous endpoint.

**Target:** retain current synchronous endpoints; add a shared task contract
only when batch/document backends justify it. Define states, cancellation,
retention, idempotency, and error envelopes before implementation.

**Gate:** state-machine tests cover queued, running, succeeded, failed,
cancelled, expired, and restart behavior.

### BP-13: Report health, capacity, and protocol version

**Observation:** MinerU health reports protocol version, processing window,
concurrency, and task statistics.

**Current state:** JavaScript exposes a basic `{"status":"ok"}` route; no
equivalent Rust health/capacity contract was found.

**Target:** `/health` separates liveness from readiness and lists protocol
version, enabled backends, saturation, and dependency readiness without secrets.

**Gate:** health tests cover healthy, degraded optional backend, and unavailable
required backend.

### BP-14: Design local and remote backends to one protocol

**Observation:** local engines and HTTP-client engines feed the same downstream
pipeline.

**Target:** backend descriptors declare protocol version, capabilities, limits,
and supported profiles. A local process adapter and remote HTTP adapter obey the
same conformance suite.

**Gate:** conformance tests replay identical requests against mock local and
remote implementations.

### BP-15: Bound resources and lifecycle

**Observation:** task retention, cleanup, worker counts, page ranges, and
accelerator selection are explicit.

**Target:** define maximum bytes, redirects, pages, pixels, expanded archive
size, concurrency, runtime, and artifact retention. Limits must fail with typed
diagnostics, not partial success.

**Gate:** adversarial tests exercise oversized input, redirect loops,
decompression bombs, timeout, queue saturation, and cleanup.

### BP-16: Validate remote sources against SSRF

**Observation:** MinerU has a dedicated public HTTP client policy. web-capture's
purpose inherently accepts URLs, making the risk more central here.

**Target:** resolve and validate every redirect hop, block private/link-local
ranges by default in service mode, cap response size, and make private-network
access an explicit deployment policy.

**Gate:** unit and integration tests cover IPv4/IPv6 literals, DNS rebinding
simulation, credentials in URLs, redirects to private addresses, and allowed
public destinations.

### BP-17: Cache by content and configuration

**Observation:** MinerU checks model caches before downloads and records model
source configuration.

**Target:** cache immutable acquisition/analysis artifacts by source digest,
backend identity/version, normalized options, and schema version. Never key only
by URL.

**Gate:** cache tests cover hits, option changes, backend upgrades, corruption,
expiry, and concurrent writers.

### BP-18: Benchmark quality by component

**Observation:** OmniDocBench measures text, tables, formulas, layout, and
reading order instead of relying on a single example.

**Target:** create a legally redistributable web/document fixture corpus with
separate fidelity metrics for text, links, tables, formulas, images, metadata,
reading order, geometry, and runtime. Pin tool and corpus versions.

**Gate:** CI publishes machine-readable results and fails only against reviewed
regression thresholds. Upstream scores are never presented as local results.

### BP-19: Preserve cross-language contract parity

**Observation:** this is a web-capture requirement, not a MinerU property.

**Target:** schema, fixtures, examples, error codes, MIME types, defaults, and
archive layouts are shared data. Implementation internals may differ.

**Gate:** extend `scripts/check-js-rust-parity.mjs` from source/test presence to
contract and golden-output parity.

### BP-20: Make provenance and licensing testable

**Observation:** MinerU 3.4.4 uses a custom Apache-derived license with
commercial thresholds and online-service attribution. It is not the Unlicense.
Its model and benchmark artifacts can have separate terms.

**Target:** every dependency, model, dataset, and copied fixture has an SPDX
identifier or recorded custom terms, source URL, version/digest, and
redistribution decision.

**Gate:** CI performs dependency license review and validates a provenance
manifest. Unknown or incompatible terms block distribution.

## Practices not to copy

Learning from MinerU includes identifying choices that do not fit this project:

| Upstream characteristic                                           | Decision                                                                   |
| ----------------------------------------------------------------- | -------------------------------------------------------------------------- |
| Python implementation and ML framework stack                      | Do not embed it; issue explicitly requires Rust/JavaScript                 |
| Custom source license                                             | Do not copy or relicense source; use clean-room behavior-level design      |
| Model weights and benchmark PDFs                                  | Do not assume source-code license applies; review each artifact separately |
| One large default installation                                    | Keep web-capture core small; use optional adapters                         |
| Backend-specific incompatible intermediate output                 | Stabilize web-capture's envelope before adding engines                     |
| GPU-vendor-specific orchestration in core                         | Keep deployment adapters outside the capture contract                      |
| Upstream accuracy numbers                                         | Cite as upstream claims until locally reproduced                           |
| Sparse upstream unit-test surface relative to implementation size | Use schema/golden/conformance tests from the first milestone               |
| Automatic downloads without an explicit artifact policy           | Require opt-in, digest verification, cache location, and provenance        |

## Proposed `CaptureDocument v1`

The shape below is illustrative. A follow-up contract PR must provide formal JSON
Schema, examples, and compatibility rules before code depends on it.

```json
{
  "schemaVersion": "1.0",
  "id": "sha256:<canonical-request-and-source-digest>",
  "source": {
    "kind": "url",
    "uri": "https://example.com/",
    "mediaType": "text/html",
    "sha256": "...",
    "retrievedAt": "2026-07-27T00:00:00Z"
  },
  "producer": {
    "name": "web-capture",
    "version": "…",
    "language": "rust",
    "backend": "browser",
    "backendVersion": "…",
    "profile": "balanced",
    "options": {}
  },
  "pages": [
    {
      "index": 0,
      "width": 1280,
      "height": 800,
      "blocks": [
        {
          "id": "b1",
          "type": "heading",
          "order": 0,
          "text": "Example",
          "level": 1,
          "bbox": [0.1, 0.1, 0.9, 0.2],
          "sourceLocator": { "kind": "css", "value": "main > h1" }
        }
      ]
    }
  ],
  "content": [{ "blockId": "b1", "page": 0, "order": 0 }],
  "artifacts": [
    {
      "role": "markdown",
      "path": "document.md",
      "mediaType": "text/markdown",
      "sha256": "...",
      "bytes": 123
    }
  ],
  "diagnostics": {
    "warnings": [],
    "timingsMs": {},
    "backendDecisions": []
  }
}
```

Contract rules:

1. Coordinates are normalized `[x0, y0, x1, y1]` in the range `0..1`; page
   dimensions preserve the original coordinate space.
2. Block IDs are stable within one source digest and normalized option set.
3. Binary data is referenced through artifacts, never embedded repeatedly.
4. Unknown block types round-trip as `other` plus an extension field.
5. Renderers use explicit order, not array accident or geometric guesses.
6. Diagnostics contain no credentials, cookies, authorization headers, or raw
   private content by default.
7. Schema minor versions add optional fields; breaking changes require a major
   version.

## Target architecture

```text
CLI / HTTP sync / HTTP tasks
            |
      CaptureRequest
            |
   Source probe + policy
            |
     Backend registry
      /      |      \
 fetch   browser   document adapter
      \      |      /
      CaptureDocument v1
       /      |       \
 Markdown   JSON    artifact/archive renderers
            |
 diagnostics + metrics + cache
```

The backend registry is capability-based:

```text
probe(request) -> supported | unsupported(reason)
analyze(request, source) -> CaptureDocument
describe() -> protocol version, capabilities, limits, health
```

This avoids language-specific plugin loading. Rust and JavaScript can implement
native adapters and call the same external engine protocol where a model is too
large or unavailable in one ecosystem.

## Delivery roadmap

Each phase is independently releasable. New public behavior requires a
changeset/version trigger in the implementation PR that introduces it.

### Phase 0: Contract and provenance

- Formalize `CaptureDocument v1`, artifact manifest, diagnostics, error codes,
  compatibility rules, and JSON examples.
- Add schema validation and shared golden fixtures.
- Add a dependency/model/dataset provenance manifest and CI validation.
- Extend parity checks to public contracts.

Exit: Rust and JavaScript can read, validate, flatten, and render the same
hand-authored document fixture.

### Phase 1: Adapt existing web acquisition

- Map direct fetch, browser capture, Kreuzberg structured output, Google Docs,
  search, and shared dialogs into the common envelope.
- Keep old CLI and endpoint output byte-compatible unless a new structured
  format is explicitly requested.
- Add DOM locators, reading order, warnings, and artifact checksums.

Exit: existing feature suites pass and cross-language golden JSON is equivalent.

### Phase 2: Operability and safety

- Add `/health` liveness/readiness and backend descriptors.
- Centralize source policy, redirect validation, input/resource limits, and
  sanitized diagnostics.
- Add content/configuration cache primitives.
- Add debug snapshot and block-overlay artifacts behind an opt-in flag.

Exit: adversarial safety tests and degraded-backend health tests pass.

### Phase 3: Local document ingestion

- Add local/stream input abstraction only after service-mode file access policy
  is defined.
- Start with text-bearing PDF extraction through reviewed Rust and JavaScript
  adapters.
- Add page ranges, batch request schema, and page/block geometry.
- Preserve input and output provenance.

Exit: a shared, redistributable PDF corpus passes text, order, link, and
geometry golden tests in both implementations.

### Phase 4: Optional OCR and layout engines

- Introduce capability-negotiated local process and remote HTTP adapters.
- Add scanned-document detection, OCR language choice, table/formula switches,
  and `fast`/`balanced`/`accurate` profiles.
- Keep model installation separate and opt-in with digests and license records.

Exit: core still installs without models; mock conformance tests and one
reviewed engine integration pass.

### Phase 5: Task service and scaling

- Add task submission, status, result, cancellation, expiration, retention,
  idempotency, and cleanup.
- Add bounded concurrency and backpressure before worker routing.
- Treat multi-GPU/multi-host routing as a deployment adapter.

Exit: state-machine, restart, saturation, and cleanup tests pass.

### Phase 6: Quality program

- Publish the legal fixture corpus, metric definitions, environment lock, and
  baseline results.
- Measure fidelity per component plus latency, peak memory, and artifact size.
- Add reviewed regression budgets.
- Evaluate OmniDocBench only where its dataset terms permit the intended use.

Exit: every accuracy or performance claim links to a reproducible result.

## Candidate components

These are discovery candidates, not dependency approvals. Every candidate needs
an active-maintenance, API, security, binary-distribution, and license review at
the version actually selected.

| Need                | Rust candidates                             | JavaScript candidates                                 | Preferred boundary             |
| ------------------- | ------------------------------------------- | ----------------------------------------------------- | ------------------------------ |
| PDF text/geometry   | `pdfium-render`, `lopdf`                    | `pdfjs-dist`                                          | Native adapter                 |
| OCR                 | `ocrs`, Tesseract bindings, ONNX Runtime    | `tesseract.js`, `onnxruntime-node`                    | Optional process/service first |
| Image preprocessing | `image`, OpenCV bindings                    | `sharp`                                               | Optional native adapter        |
| Office ingestion    | ZIP/XML crates plus format-specific readers | ZIP/XML packages, existing `docx` only renders output | One format per bounded PR      |
| VLM inference       | HTTP/OpenAI-compatible client               | HTTP/OpenAI-compatible client                         | External service               |
| Schema validation   | `jsonschema` or generated Serde types       | Ajv or generated types                                | Shared schema fixtures         |
| Checksums/cache     | `sha2`, filesystem/SQLite                   | Node crypto, filesystem/SQLite                        | Common key specification       |

Why service-first for OCR/VLM:

- it avoids forcing both language ecosystems to wrap the same accelerator
  runtime;
- model processes can crash or exhaust memory without taking down the HTTP
  frontend;
- model licenses and distribution remain separable from Unlicense-compatible
  core code;
- local and remote deployments exercise one protocol; and
- conformance tests can use a small mock.

## Benchmark plan

### Fixture classes

1. semantic HTML with headings, lists, links, images, code, tables, math, and
   metadata;
2. client-rendered pages and delayed resources;
3. reordered landmarks and two-column layouts;
4. public Google Docs and stable local model fixtures;
5. text PDFs, multi-column PDFs, tagged PDFs, and broken-font PDFs;
6. scanned documents across a small reviewed language set;
7. tables with merged cells and formulas;
8. adversarial sources: redirects, huge images, malformed files, archive
   traversal, and decompression bombs.

### Metrics

| Dimension     | Suggested metric                                      |
| ------------- | ----------------------------------------------------- |
| Text          | normalized edit distance                              |
| Reading order | sequence edit distance over block IDs                 |
| Tables        | structural tree similarity plus cell text distance    |
| Formulas      | normalized LaTeX comparison                           |
| Links/images  | precision/recall and target equality                  |
| Layout        | intersection-over-union and block classification      |
| Metadata      | field precision/recall                                |
| Determinism   | artifact checksum equality                            |
| Runtime       | wall time and throughput by fixture class             |
| Resources     | peak resident memory, output bytes, model/cache bytes |

The benchmark must report hardware, OS, browser/engine/model versions, profile,
warm/cold cache, and failures. One aggregate score must never hide component
regressions.

## Security and privacy checklist

- Remote URL policy covers DNS resolution and every redirect.
- Service-local file input is disabled unless explicitly configured.
- Upload filenames never become filesystem paths.
- Archive paths are generated, normalized, and traversal-tested.
- Input, decoded pixels, expanded archives, output, runtime, and concurrency are
  bounded.
- Browser contexts are isolated and credentials are opt-in.
- Logs and debug artifacts redact tokens, cookies, headers, query secrets, and
  form data.
- Model endpoints have explicit trust and data-retention policies.
- Cached private results are access-scoped and encrypted where required.
- Original documents and debug artifacts have retention controls.
- HTML renderings document whether they sanitize active content.

## License and clean-room protocol

MinerU 3.4.4's `LICENSE.md` says it is based on Apache 2.0 with additional
commercial thresholds and an online-service attribution obligation. GitHub
therefore reports `NOASSERTION`, not `Apache-2.0`. Regardless of whether a
particular use might be allowed, copying that implementation cannot produce an
unencumbered Unlicense-only codebase.

Rules for this project:

1. Treat MinerU documentation and observable behavior as research inputs.
2. Do not translate MinerU source line-by-line into Rust or JavaScript.
3. Write contracts and acceptance tests from requirements and independently
   created fixtures.
4. Record the author, source, license, and digest of every imported fixture.
5. Review model cards, weights, tokenizer/config files, datasets, and generated
   outputs separately from engine source.
6. Do not commit research-only or non-commercial benchmark content.
7. Keep optional engine notices with distributed engine packages; do not label
   third-party code as Unlicense.
8. Preserve the repository's Unlicense for original project code.
9. Escalate ambiguous license terms before adding a dependency or artifact.

This is an engineering provenance policy, not legal advice.

## Risks and mitigations

| Risk                                                | Impact                                 | Mitigation                                                      |
| --------------------------------------------------- | -------------------------------------- | --------------------------------------------------------------- |
| Scope turns web-capture into a MinerU clone         | Multi-year rewrite and lost focus      | Use capability boundaries and phased acceptance criteria        |
| Rust and JS outputs drift                           | Broken compatibility promise           | Shared schemas, fixtures, and golden parity checks              |
| Model/runtime bloats default install                | Poor install and deployment experience | Optional external adapters                                      |
| Custom/model/dataset terms contaminate distribution | License conflict                       | Provenance manifest and review gate                             |
| Intermediate schema freezes too early               | Expensive compatibility burden         | Experimental namespace, then v1 after fixture validation        |
| Rich JSON leaks private content                     | Security/privacy incident              | Redaction, access scope, retention, opt-in diagnostics          |
| Async queue added before limits                     | Resource exhaustion                    | Limits/backpressure before task routing                         |
| Benchmark overfits one document type                | Misleading quality claims              | Diverse fixture classes and component metrics                   |
| OCR improves text but damages native PDF text       | Fidelity regression                    | Classifier confidence, explicit fallback, per-component metrics |
| Silent backend fallback hides failures              | Unreproducible output                  | Structured backend decisions and warnings                       |

## Acceptance matrix

| Requirement                         | Evidence in this PR                                | Status            |
| ----------------------------------- | -------------------------------------------------- | ----------------- |
| Inventory current MinerU practices  | BP-01 through BP-20, pinned to commit/release      | Complete          |
| Map MinerU to current web-capture   | Capability boundary matrix                         | Complete          |
| Define Rust/JavaScript approach     | Shared contract, backend protocol, parity gates    | Complete          |
| Preserve Unlicense                  | Clean-room and provenance protocol                 | Complete          |
| Identify reusable components        | Candidate component matrix with review requirement | Complete          |
| Define implementation order         | Phases 0 through 6 with exit criteria              | Complete          |
| Define tests before implementation  | Per-practice gates and benchmark plan              | Complete          |
| Preserve research evidence          | `data/` snapshots and online source index          | Complete          |
| Port every MinerU feature in one PR | Rejected as unsafe, untestable, and out of scope   | Explicit non-goal |

## Validation performed

- Read issue 143 and all comments (none).
- Read PR 146 conversation comments, review comments, and reviews (none).
- Inspected the pinned MinerU source tree, license, docs, package configuration,
  backends, service/router contracts, tests, workflows, and latest release.
- Inspected web-capture's Rust/JavaScript packages, docs, formats, endpoints,
  source/test structure, parity script, license, and recent related work.
- Verified that no MinerU source, model, dataset, or fixture is included.
- Formatted and link-checked the case-study Markdown locally.
- Validated all preserved JSON artifacts by parsing them.

## Conclusion

MinerU's most valuable transferable idea is not a particular OCR model. It is
the explicit pipeline boundary between acquisition/analysis, a rich
intermediate document representation, and multiple outputs, supported by
backend selection, diagnostics, and component benchmarks.

For web-capture, the correct first implementation is `CaptureDocument v1` with
shared Rust/JavaScript golden tests and provenance controls. PDF ingestion, OCR,
async tasks, and scaling should follow as optional, measurable capabilities.
That sequence adopts the practices while preserving web-capture's identity,
cross-language contract, small core, and Unlicense.
