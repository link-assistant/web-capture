# Online sources

Research snapshot: 2026-07-27.

The analysis in this case study is pinned to MinerU commit
[`79d6d8d`](https://github.com/opendatalab/MinerU/commit/79d6d8d79fb8f3ddba5cc34c07a16f0ec36f56c7)
and web-capture commit
[`4c5443e`](https://github.com/link-assistant/web-capture/commit/4c5443e1ab83a4a250457933079eaf2fbd61ed21).
That pin matters because both projects evolve quickly.

## Primary MinerU sources

| Source                     | URL                                                                                                                            | Used for                                                                                       |
| -------------------------- | ------------------------------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------- |
| Repository                 | <https://github.com/opendatalab/MinerU>                                                                                        | Product scope, supported inputs, backends, platforms, CLI, API, deployment, and project layout |
| README at snapshot         | <https://github.com/opendatalab/MinerU/blob/79d6d8d79fb8f3ddba5cc34c07a16f0ec36f56c7/README.md>                                | Feature inventory and release history                                                          |
| License at snapshot        | <https://github.com/opendatalab/MinerU/blob/79d6d8d79fb8f3ddba5cc34c07a16f0ec36f56c7/LICENSE.md>                               | Custom Apache-2.0-derived terms, thresholds, and attribution obligation                        |
| Package manifest           | <https://github.com/opendatalab/MinerU/blob/79d6d8d79fb8f3ddba5cc34c07a16f0ec36f56c7/pyproject.toml>                           | Optional dependency groups, supported Python versions, entry points, and test configuration    |
| Quick usage                | <https://github.com/opendatalab/MinerU/blob/79d6d8d79fb8f3ddba5cc34c07a16f0ec36f56c7/docs/en/usage/quick_usage.md>             | Local/remote execution, async tasks, health, router, and model configuration                   |
| CLI tools                  | <https://github.com/opendatalab/MinerU/blob/79d6d8d79fb8f3ddba5cc34c07a16f0ec36f56c7/docs/en/usage/cli_tools.md>               | Input, page-range, backend, output, OCR, formula, and table controls                           |
| Advanced CLI               | <https://github.com/opendatalab/MinerU/blob/79d6d8d79fb8f3ddba5cc34c07a16f0ec36f56c7/docs/en/usage/advanced_cli_parameters.md> | Accelerator selection and inference-engine pass-through                                        |
| Output files               | <https://github.com/opendatalab/MinerU/blob/79d6d8d79fb8f3ddba5cc34c07a16f0ec36f56c7/docs/en/reference/output_files.md>        | Intermediate representation, content list, debug overlays, coordinates, and artifacts          |
| Model source configuration | <https://github.com/opendatalab/MinerU/blob/79d6d8d79fb8f3ddba5cc34c07a16f0ec36f56c7/docs/en/usage/model_source.md>            | Cache reuse, automatic source selection, and offline model paths                               |
| Backend directory          | <https://github.com/opendatalab/MinerU/tree/79d6d8d79fb8f3ddba5cc34c07a16f0ec36f56c7/mineru/backend>                           | Pipeline, VLM, hybrid, Office, and shared output stages                                        |
| API implementation         | <https://github.com/opendatalab/MinerU/blob/79d6d8d79fb8f3ddba5cc34c07a16f0ec36f56c7/mineru/cli/fast_api.py>                   | Task lifecycle, limits, result packaging, and service boundary                                 |
| Router implementation      | <https://github.com/opendatalab/MinerU/blob/79d6d8d79fb8f3ddba5cc34c07a16f0ec36f56c7/mineru/cli/router.py>                     | Multi-worker routing and local/remote worker management                                        |
| Public HTTP client policy  | <https://github.com/opendatalab/MinerU/blob/79d6d8d79fb8f3ddba5cc34c07a16f0ec36f56c7/mineru/cli/public_http_client_policy.py>  | Public-bind guard for caller-selected inference endpoints and SSRF considerations              |
| Latest release             | <https://github.com/opendatalab/MinerU/releases/tag/mineru-3.4.4-released>                                                     | Version and recent font/duplicate-glyph hardening                                              |

## Benchmarks and technical reports

| Source                  | URL                                           | Used for                                                           |
| ----------------------- | --------------------------------------------- | ------------------------------------------------------------------ |
| MinerU technical report | <https://arxiv.org/abs/2409.18839>            | Original pipeline motivation and evaluation context                |
| MinerU 2.5 report       | <https://arxiv.org/abs/2509.22186>            | VLM architecture evolution                                         |
| OmniDocBench repository | <https://github.com/opendatalab/OmniDocBench> | Reproducible evaluation dimensions and current dataset information |
| OmniDocBench paper      | <https://arxiv.org/abs/2412.07626>            | Benchmark design and annotations                                   |
| OHR-Bench repository    | <https://github.com/opendatalab/OHR-Bench>    | Downstream RAG impact of OCR errors                                |

Benchmark scores quoted by MinerU are upstream claims, not results reproduced by
this case study. The roadmap requires web-capture to publish its own pinned
results before making comparative accuracy claims.

## web-capture sources

| Source                      | URL or path                                                                     | Used for                                                             |
| --------------------------- | ------------------------------------------------------------------------------- | -------------------------------------------------------------------- |
| Repository                  | <https://github.com/link-assistant/web-capture>                                 | Project purpose and current code                                     |
| Root README                 | [`README.md`](../../../README.md)                                               | Current formats, endpoints, image policies, and parity promise       |
| Architecture                | [`ARCHITECTURE.md`](../../../ARCHITECTURE.md)                                   | Current browser pipeline, deployment, security notes, and known gaps |
| JavaScript package          | [`js/package.json`](../../../js/package.json)                                   | Runtime, dependencies, checks, version, and Unlicense declaration    |
| Rust package                | [`rust/Cargo.toml`](../../../rust/Cargo.toml)                                   | Runtime, dependencies, lints, version, and Unlicense declaration     |
| JS README                   | [`js/README.md`](../../../js/README.md)                                         | JS CLI/API contract and development commands                         |
| Rust README                 | [`rust/README.md`](../../../rust/README.md)                                     | Rust CLI/API contract and development commands                       |
| Parity script               | [`scripts/check-js-rust-parity.mjs`](../../../scripts/check-js-rust-parity.mjs) | Existing source/test parity guard                                    |
| Browserbase precedent       | [`docs/case-studies/issue-127/README.md`](../issue-127/README.md)               | Comparison-study scope and evidence style                            |
| FormalAI contract precedent | <https://github.com/link-assistant/web-capture/pull/136>                        | Contract-first documentation precedent                               |

## Archived metadata

The `data/` directory preserves compact, machine-readable snapshots for:

- issue 143 and its comments;
- PR 146 conversation comments, review comments, and reviews;
- MinerU repository and latest release metadata;
- OmniDocBench and web-capture repository metadata;
- recent merged web-capture PRs; and
- the initial CI runs on PR 146.

No screenshots or issue attachments existed to download. No authenticated MinerU
cloud or model-backed run was attempted: the issue asks for transferable
practices, and a model download would not validate a Rust/JavaScript design.
