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
- [x] Update every Docker base image and package names for the current distribution; build/test JS locally and build both final images in passing CI.
- [x] Update all GitHub Actions and runtime versions consistently; add weekly Dependabot for actual manifests.
- [x] Audit complete npm, Cargo, and Python trees; document every unavoidable upstream constraint with evidence.
- [x] Run full local lint/format/build/tests where the container supports them, feature/TLS/parity checks, examples, and meaningful regressions; save large logs and document the full Rust compiler's measured memory limit.
- [x] Prepare release triggers, review diff for feature preservation, and commit atomic verified steps.
- [x] Fetch current main and verify it is already an ancestor, push only the prepared branch, update PR title/body with requirement coverage and tests.
- [x] List recent CI runs with timestamps/SHA, preserve each failed run's logs, diagnose precise errors, fix and repeat.
- [x] Complete full CI for the implementation, including all live integrations, cross-platform Rust, release and both Docker builds; retain the validated SHA and run receipts.

Final gate: every later evidence commit must pass the same complete checks before
PR 175 is marked ready. The PR's current-head checks and review state record that
final gate without a self-referential CI-results commit.

Experiments belong in `experiments/issue-174/`; collected research and summarized
validation belong here. Large transient build/test/CI logs belong in `ci-logs/`.
No existing feature or test may be removed to make dependency updates pass.

Progress: all four workflows passed for implementation head 59c9a0e, including
full test and live integration matrices, all-feature Rust Clippy, fresh resolution,
the bare-container build, release/package checks and both final Docker images.
Follow-up diagnostics were fixed with the CLI let chain and current byte-array
screenshot assertions in every live suite. All local JavaScript/Python and
minimal Rust checks pass; full Rust compilation exceeded the measured 3 GB local
cgroup and passed on CI runners. See VALIDATION.md and the saved run receipts.
