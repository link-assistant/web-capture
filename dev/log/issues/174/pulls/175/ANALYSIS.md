# Complete requirement analysis

Issue [174](https://github.com/link-assistant/web-capture/issues/174), implementation
[PR 175](https://github.com/link-assistant/web-capture/pull/175). The issue and all
three PR comment endpoints had no comments when collected on 2026-10-08 UTC.
Raw issue, reviews, prior PR 159, registry results and upstream migration notes
are in `data/`. Archived case studies and fixtures are historical evidence, not
active dependency pins; rewriting them would destroy their before/after context.

| ID  | Requirement                                                             | Possible solutions                                                     | Selected plan and verification                                                                                                                          |
| --- | ----------------------------------------------------------------------- | ---------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------- |
| R1  | Update every ecosystem, most repository code first                      | Separate PRs; one complete PR                                          | JavaScript, Rust, Python, Docker, Actions in this PR; inventory before edits                                                                            |
| R2  | Latest JavaScript runtime and development dependencies, crossing majors | npm update; npm-check-updates; manual registry resolution              | Registry snapshot and npm-check-updates; full transitive refresh, compatible lock regeneration, test API behavior                                                                            |
| R3  | Latest Rust dependencies in both manifests                              | cargo update alone; cargo-edit incompatible upgrades                   | Verify every direct crate against crates.io, cargo upgrade and update both manifests                                                                    |
| R4  | Regenerate and commit all lockfiles, including transitive entries       | Direct updates only; full resolution                                   | Update complete locks, inspect every remaining older transitive entry and record upstream ranges                                                        |
| R5  | Revisit Rust edition and rust-version                                   | Keep 2021; adopt current 2024                                          | Migrate both crates to 2024, run current stable fmt/clippy/features/full tests                                                                          |
| R6  | Find missing Python manifest and update all Python dependencies         | Ignore examples; remove requests for stdlib; declare examples          | Declare requests and Python baseline, lock dependencies and audit them; exercise all example scripts against local fixture                              |
| R7  | Update every FROM, digest and distribution                              | Floating old tags; current stable distro and explicit language pins    | Latest published official Node/Rust images on Trixie and Debian Trixie runtime; registry data records image publication lag                             |
| R8  | Inspect Compose dependencies                                            | Add irrelevant image; inspect local build                              | Compose uses only local Dockerfile build, no external image; retain Compose updater for future image pins                                               |
| R9  | Update every uses reference, including composite/reusable actions       | Major aliases; exact current tags/commit                               | Exact current release tags and rust-toolchain stable commit, read each major migration                                                                  |
| R10 | Inspect HTML/Shell external dependencies                                | Search just manifests; search scripts/templates                        | Include apply.sh generated manifest/image and release scripts' remote eval loader                                                                       |
| R11 | Add automatic dependency updates                                        | Dependabot; Renovate                                                   | Weekly grouped Dependabot for every actual npm/Cargo/pip/Docker/Compose/Actions manifest                                                                |
| R12 | Table for every dependency: before and registry latest                  | Direct-only summary; exhaustive machine/Markdown report                | Registry snapshots cover all locked package names; generated tables include final versions and reasons for every exception                              |
| R13 | Written reason for anything left behind                                 | Force incompatible transitive overrides; document upstream constraints | Only evidence-backed compatibility/packaging exceptions, with parent ranges and blocker links                                                           |
| R14 | Read changelog/migration guide for each major update                    | Blind bump; deliberate migration                                       | Collect/read checkout 7, setup-node 7, cache 6, Execa 10, command-stream 2 alternative, Node 26/npm 12, Rust 2024 and distro notes                                            |
| R15 | Adopt upstream features, remove hand-rolled copies/shims                | Version-only edits; simplify obsolete mechanisms                       | Replace release scripts' remote dynamic eval with locked imports; remove obsolete npm bootstrap fallbacks and Babel transform; native watch, arrayBuffer downloads and shared maintained scaffold |
| R16 | Honest floors and upper bounds                                          | Wildcard constraints; explicit current tested baselines                | Align engines/runtime/toolchain pins with current versions; preserve intentional compatibility semantics for transitive upstream dependencies           |
| R17 | Synchronize repeated pins everywhere                                    | Only production manifests; repository-wide search                      | Align workflow/Docker/toolchain/consumer/template pins; retain historical evidence unedited                                                             |
| R18 | Full builds/tests/lint and green CI in every ecosystem                  | Unit tests only; full existing frameworks                              | JS native ESM/unit/integration/process/Docker, Rust all targets/features/docs/release/Docker, Python examples, parity and CI policy tests               |
| R19 | Resolve new deprecation warnings                                        | Hide warnings; remove causes                                           | Native ESM removes Babel 7 peer conflicts; audit/inspect installation/test warnings and update their parents or explain upstream limits                 |
| R20 | Security audit final entire trees, zero unresolved vulnerabilities      | Production-only audit; complete locked audits                          | npm audit for both manifests, cargo audit, Python pip-audit; scheduled health jobs notice newly published advisories                                    |
| R21 | Follow linked best practices                                            | Read abstractly; apply requirements                                    | Retain the complete source in data; reproduce blockers, audit shipped locks, record inventory and install paths                                         |
| R22 | Finish everything in one PR without dropping existing features          | Partial updates; finish and verify                                     | Atomic commits to prepared branch, forward merges of main, full diff review and current-head CI before ready                                            |
| R23 | Compile deep research/data in requested folder                          | Ephemeral tool output; committed evidence                              | This folder contains issue/PR data, plans, online primary references, inventories and validation summaries                                              |
| R24 | Research existing reusable components                                   | Write custom updater/resolver; use existing tools                      | npm-check-updates, cargo-edit, uv, pip-audit, cargo-audit and Dependabot with minimal policy wrappers                                                   |

## Initial findings and decisions

- All Rust direct crates were already at crates.io latest. Update the lock,
  edition and tested toolchain rather than inventing version bumps.
- Playwright moved from 1.63.0 to 1.64.0. Every other JavaScript direct package
  except browser-commander was already registry-current.
- JavaScript browser-commander 0.26.3 still requires better-sqlite3 13.0.3.
  [Existing blocker 160](https://github.com/link-assistant/web-capture/issues/160)
  explicitly preserves 0.10.0 for packaged consumers until native storage is
  optional or those consumers are validated. The latest registry manifest confirms this remains a mandatory native dependency; retain the explicit packaging blocker and test executablePath/channel forwarding; Rust 0.19.0 has no such blocker.
- Python is used by requests-based consumer examples and stdlib investigation
  scripts. The former have no manifest; the latter need no third-party packages.
- apply.sh embeds express 4, capture-website 4, turndown 7.1.1, Node 20, an
  invalid node:fetch import and obsolete Debian packages. It must not escape the
  update simply because its generated package.json is inside a shell heredoc.
- Nineteen release helpers evaluate unversioned use-m code and download runtime
  packages outside any lock. Standard package imports plus a root tools manifest
  are smaller and reproducible, and make audit/Dependabot cover those packages.
- Native Jest ESM works with Node 26; an initial seven-suite/49-test probe passed
  with transforms disabled. Removing Babel avoids the latest Babel 8 versus
  Jest's Babel-7-only transitive peer conflicts without pinning Babel back.

## Online primary sources and reusable components

| Source/component                                                                                                                                    | Applicability and decision                                                                                      |
| --------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------- |
| [npm-check-updates](https://github.com/raineorshine/npm-check-updates)                                                                              | Rewrites direct ranges to latest dist-tags; use instead of treating npm update as a major updater               |
| [cargo-edit](https://github.com/killercup/cargo-edit)                                                                                               | Stable cargo upgrade --incompatible; combine with complete lock updates                                         |
| [uv](https://docs.astral.sh/uv/)                                                                                                                    | Lock/sync Python examples and tool dependencies reproducibly                                                    |
| [pip-audit](https://github.com/pypa/pip-audit), [cargo-audit](https://github.com/rustsec/rustsec/tree/main/cargo-audit)                             | Audit complete final dependency trees                                                                           |
| [Dependabot options](https://docs.github.com/en/code-security/reference/supply-chain-security/dependabot-options-reference)                         | directories and groups cover both Cargo projects and both npm manifests; avoid entries without actual manifests |
| [Renovate](https://docs.renovatebot.com/)                                                                                                           | Viable alternative; Dependabot directly satisfies requested configuration without another service               |
| [Rust 2024 migration](https://doc.rust-lang.org/edition-guide/rust-2024/index.html)                                                                 | Match ergonomics, unsafe env changes, lifetime capture; inspect code and all targets/features                   |
| [setup-node 7](https://github.com/actions/setup-node/blob/main/README.md)                                                                           | ESM internals; removed dummy auth token does not affect existing npm OIDC publishing                            |
| [checkout 7](https://github.com/actions/checkout/releases/tag/v7.0.0), [cache 6](https://github.com/actions/cache/releases/tag/v6.0.0)              | ESM migration; checkout fork restrictions target pull_request_target/workflow_run, neither is used here         |
| [command-stream changelog](https://github.com/link-foundation/command-stream/blob/main/js/CHANGELOG.md)                                             | Version 2 brings Execa 10 but retains vulnerable shelljs/braces paths; import Execa directly and remove that wrapper              |
| [Node distribution registry](https://nodejs.org/dist/index.json), [Rust stable channel](https://static.rust-lang.org/dist/channel-rust-stable.toml) | Actual runtime versions, independent of stale environment installations                                         |
| [Official Node](https://hub.docker.com/_/node), [Rust](https://hub.docker.com/_/rust), [Debian](https://hub.docker.com/_/debian)                    | Registry-resolved images; latest Node source release may precede Docker publication                             |

- The command-stream 2 migration was evaluated, then its wrapper was removed:
  locked [Execa 10](https://github.com/sindresorhus/execa/releases/tag/v10.0.0)
  supplies safe tagged interpolation, argument arrays, input and explicit
  `reject: false`/`exitCode` without the vulnerable shelljs/braces dependency
  path. Regression tests preserve literal quotes, shell characters and JSON.
- npm 12.2.0 is pinned across both manifests, release bootstrap, every npm CI job,
  Docker and generated scaffold. Its lock generator drops unpublished optional
  Kreuzberg musl placeholders, while its installer requires them. A failing
  experiment reproduces the mismatch. Generate the compatible lock with
  npm 11.13.0 once; install and release with npm 12.2.0. Use upstream
  [npm version](https://docs.npmjs.com/cli/v11/commands/npm-version) to synchronize
  changeset metadata without regenerating the dependency tree.
- The fresh-consumer fixture deliberately ignores its disposable Cargo.lock
  to detect new upstream breakage. Regenerate it for this inventory, while
  preserving its fresh-resolution purpose; the shipped Rust lock is committed.
- Source code is checked for Rust 2024 changes; existing logic required only
  rustfmt's new edition ordering. Rust 0.5.0 and a JavaScript major changeset
  prepare releases for the raised toolchain/runtime floors.
- All node-fetch binary response paths now use upstream arrayBuffer instead
  of deprecated buffer(). Shared downloads preserve the existing retry/status
  behavior. Puppeteer byte-array assertions accept its current Uint8Array API.

Final outcomes, remaining upstream constraints and exact validation are recorded
in DEPENDENCIES.md and VALIDATION.md as implementation proceeds.
