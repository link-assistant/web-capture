# Issue 158 probes

Run from the repository root. Large command output belongs in ignored `ci-logs/`.

```sh
mkdir -p ci-logs
node experiments/issue-158/check-dependency-regressions.mjs
python3 experiments/issue-158/dependency-inventory.py
node experiments/issue-158/npm-inventory.mjs
node --max-old-space-size=256 experiments/issue-158/nock-repro.mjs
cargo metadata --manifest-path experiments/issue-158/fresh-consumer/Cargo.toml --format-version 1 > ci-logs/consumer-metadata.json
python3 experiments/issue-158/check-fresh-consumer.py ci-logs/consumer-metadata.json
```

The consumer probe checks that all seven direct requirements share the current
web-capture versions and reports remaining upstream transitive duplicates. Add
`--strict` to reproduce the unresolved whole-graph single-copy requirement.
Delete its ignored Cargo.lock to force a fresh resolution.

For the unavailable optional dependency/npm lockfile regression, a normal
`npm install --package-lock-only --ignore-scripts` in `js/` omits two musl
placeholders and subsequent `npm ci` fails. Regenerate with npm 11.13.0 using
the command documented in the case study; current npm ci then succeeds. Do this
in a temporary copy of the manifests when testing the failure.

The progress reporter records per-suite heap use if Jest cannot emit a final
summary. Set `ISSUE_158_PROGRESS_LOG` and pass
`--reporters=default --reporters=../experiments/issue-158/jest-progress-reporter.cjs`
from `js/`. The complete suite needs more than a deliberately limited 512 MiB
heap; the 1024 MiB run passes. Rust compilation on this 3 GiB host uses
`CARGO_BUILD_JOBS=1 CARGO_PROFILE_DEV_DEBUG=0 CARGO_PROFILE_TEST_DEBUG=0`.
