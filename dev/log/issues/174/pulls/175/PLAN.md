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
- [ ] Update every Docker base image and package names for the current distribution; build/test both images.
- [x] Update all GitHub Actions and runtime versions consistently; add weekly Dependabot for actual manifests.
- [x] Audit complete npm, Cargo, and Python trees; document every unavoidable upstream constraint with evidence.
- [ ] Run full local lint/format/build/tests, feature/TLS/parity checks, examples, and meaningful regressions; save large logs.
- [x] Prepare release triggers, review diff for feature preservation, and commit atomic verified steps.
- [ ] Fetch/merge current main, push only the prepared branch, update PR title/body with requirement coverage and tests.
- [ ] List recent CI runs with timestamps/SHA, preserve each failed run's logs, diagnose precise errors, fix and repeat.
- [ ] Wait for current-head CI, review full PR diff/comments, confirm a clean tree, and mark PR 175 ready.

Experiments belong in `experiments/issue-174/`; collected research and summarized
validation belong here. Large transient build/test/CI logs belong in `ci-logs/`.
No existing feature or test may be removed to make dependency updates pass.

Progress: implementation commits b055a30 and 67b069d are pushed. All local
JavaScript/Python checks and minimal Rust checks pass. Full Rust compilation
exceeded the 3 GB local cgroup; complete CI coverage remains enabled. See
VALIDATION.md for reproduction evidence and final-run tracking.
