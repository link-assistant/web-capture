# Issue 174 / PR 175 work plan

Source: https://github.com/link-assistant/web-capture/issues/174
Target: https://github.com/link-assistant/web-capture/pull/175
Branch: `issue-174-191f66a951d0`. Research started 2026-10-08 UTC.

- [x] Verify branch, clean initial tree, and repository instructions (no AGENTS.md or CONTRIBUTING file found).
- [x] Read complete issue, issue comments, PR conversation, inline comments, and reviews; retain raw data in `data/`.
- [x] Read the dependency-update best practices and recent dependency PR context.
- [x] Inventory every live manifest, lockfile, external script import, action, image, and runtime pin before editing.
- [x] Query registries and retain before/latest tables for all direct and transitive dependencies.
- [x] Enumerate every requirement, alternatives, selected plan, and verification in ANALYSIS.md.
- [x] Research official migration guides and reusable update/audit components online.
- [x] Reproduce remaining defects with bounded experiments/tests before fixing them.
- [x] Update JavaScript direct dependencies and complete lockfile; migrate API differences and remove superseded helpers.
- [x] Update both Rust manifests, edition/MSRV, complete lockfile, and consumer fixture; migrate API differences.
- [x] Identify Python example dependencies, add reproducible manifests/lockfile, and update Python tooling.
- [x] Update every Docker base image and package names for the current distribution; build/test the JS image locally and run the Rust image build in full CI.
- [x] Update all GitHub Actions and runtime versions consistently; add weekly Dependabot for actual manifests.
- [x] Audit complete npm, Cargo, and Python trees; document every unavoidable upstream constraint with evidence.
- [x] Run full local lint/format/build/tests where the container supports them, feature/TLS/parity checks, examples, and meaningful regressions; save large logs and document the full Rust compiler's measured memory limit.
- [x] Prepare release triggers, review diff for feature preservation, and commit atomic verified steps.
- [x] Fetch current main and verify it is already an ancestor, push only the prepared branch, update PR title/body with requirement coverage and tests.
- [x] List recent CI runs with timestamps/SHA, preserve each failed run's logs, diagnose precise errors, fix and repeat.
- [ ] Wait for current-head CI, review full PR diff/comments, confirm a clean tree, and mark PR 175 ready.

Experiments belong in `experiments/issue-174/`; collected research and summarized
validation belong here. Large transient build/test/CI logs belong in `ci-logs/`.
No existing feature or test may be removed to make dependency updates pass.

Progress: implementation and reproducing regression commits are pushed. All
local JavaScript/Python checks and minimal Rust checks pass. Full Rust compilation
exceeded the 3 GB local cgroup; CI passed the full test and live integration
matrices on Linux, macOS and Windows, fresh resolution and the bare-container
build. Follow-up CI diagnostics require the final CLI let chain and current
byte-array screenshot assertions in all live suites. See VALIDATION.md for
timestamped evidence. Final readiness is recorded by the current-head checks and
review state of PR 175 after all pending build and test gates complete.
