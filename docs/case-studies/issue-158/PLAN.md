# Issue 158 work plan

- [x] Read parent issue, all five sub-issues and their comments; read PR conversation, reviews and inline comments.
- [x] Verify prepared branch and working tree; inspect recent related merged PRs.
- [x] Record every requirement, root cause, alternatives and chosen solution in the case study.
- [x] Query current npm/crates.io releases and upstream migration/security documentation; compare reusable cache/freshness libraries.
- [x] Reproduce dependency advisories, launch-option loss, missing cache and outdated requirements before fixes; preserve experiments/logs.
- [x] Add browser option unit regression tests for both engines and explicit temporary executable integration tests.
- [x] Upgrade npm dependencies, use the audited npm lockfile, account for bundling and minimum Node version.
- [x] Upgrade all Rust direct dependencies, adapt APIs/TLS guards, update lockfile; preserve search-only and OpenSSL-free builds.
- [x] Implement versioned SHA-256 disk capture cache over arbitrary transports, exact receipts, request keys, TTL, online/offline modes, stale flags, listing/pruning and committable replay fixtures.
- [x] Apply feature consistently across JS/Rust exports/docs/examples and parity policy; reproduce cache cases with deterministic fake clocks/transports before implementation.
- [x] Add required audit/freshness jobs, explicit open-issue blocker handling, deterministic policy tests and finite CI test/job time limits where appropriate.
- [x] Run appropriate focused checks then complete local CI suites; log large output and inspect failures; keep experiment scripts in experiments and real examples in examples.
- [x] Prepare release triggers for npm and crates.io using existing workflows.
- [x] Commit useful atomic changes after local checks; push only issue-158-fa165d4218b7; merge default-branch updates if necessary.
- [x] Review complete PR diff for regressions and scope coverage; replace WIP description with reproduction, tests, breaking changes, findings and all six Fixes references.
- [ ] List current CI runs with timestamps/SHA; download each failed run to ci-logs; identify errors with log line numbers; fix and recheck until current checks pass.
- [ ] Verify clean working tree and code/tests/docs consistency; mark PR 159 ready. Release publication occurs through the authorized release workflows after merge.

No agents are delegated. No host stress probes are needed; any later stress experiments must use finite inputs and memory/stack limits.
