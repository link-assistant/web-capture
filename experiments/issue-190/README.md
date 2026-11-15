# Issue 190 work plan and verification inventory

Original issue: https://github.com/link-assistant/web-capture/issues/190
Pull request: https://github.com/link-assistant/web-capture/pull/192

Read the complete issue, issue comments and sub-issues, plus PR conversation
comments, inline comments and reviews on 2026-11-15. All five lists were empty.
The latest related merged PR, #180, supplies the repository's OIDC conventions.

| Requirement | Implementation | Verification / status |
| --- | --- | --- |
| Choose first public Python version | `pyproject.toml` and `uv.lock`: 0.1.0 | Built wheel/sdist metadata checks |
| Correct repository and README metadata | Project URLs and `docs/python-examples.md` | Twine strict check and `scripts/check-python-distribution.py` |
| Build and verify wheel and sdist | `python.yml`, setuptools, explicit package mapping | Wheel built from sdist; isolated installation of both |
| Preserve existing examples | Original script paths and standalone imports retained | Local HTTP fixture exercises every script and installed module |
| Publish on Python version tags | `python-v*`, exact version guard, dependent publish job | Unit tests reject other ecosystem and mismatched tags; workflow guard tests |
| Future releases use OIDC without token secret | Isolated publish job, `pypi` environment, PyPA action | Workflow invariants and zizmor; real exchange remains unverified |
| Document pending publisher for setup tool | `docs/releases/python-trusted-publishing.md` | Exact project/owner/repository/workflow/environment identity documented |
| Installable from public PyPI | Requires first real release | **Unfinished:** public JSON endpoint returns 404; no authenticated PyPI session; setup tool plan recognizes the publisher identity |
| All current-commit CI green | Inspect run SHA, timestamp and logs | Track in PR; initial unrelated dependency freshness/security failures preserved in `ci-logs/` |

Focused local validation:

```bash
uv build --no-sources
uvx --from twine==7.0.0 twine check --strict dist/*
uv run --locked python scripts/check-python-distribution.py --dist dist --tag python-v0.1.0
uv run --locked python -m unittest discover -s tests/python -v
bash experiments/issue-190/verify-installed.sh
node --test tests/tools/*.test.mjs
uvx zizmor==1.30.1 --config .github/zizmor.yml --min-confidence low --persona regular .github
```

`verify-installed.sh` uses temporary environments outside the checkout and a
local mock HTTP service. It runs the actual documented `python -m` commands
from both installed artifacts, with finite subprocess timeouts. No browser,
Rust build, or live capture service is needed for this package.

## Existing CI failures and investigation

The initial runs at `fdf1690` failed freshness checks for nine JS dependencies
and three Rust dependencies. Compatible updates, lockfile regeneration, a JS
patch changeset and Rust 0.5.3 restore these checks. The latest JS audit also
passes, retaining the existing rejected-CVE verification and browser blocker.

The Python security job initially failed after packaging because strict
`pip-audit` tried to look up our editable, unpublished project on PyPI.
`--skip-editable` also fails under strict mode. Exporting the complete hashed
runtime and development dependency set with `--no-emit-project`, then auditing
it with `--strict --require-hashes --disable-pip`, passes while retaining
third-party dependency coverage.

The Rust security failure was traced beyond the dependency manifest:

- Fresh run `43769460690` at `6d20b86` (2026-11-15 22:28:16 UTC), saved
  as `ci-logs/dependencies-43769460690.log`, lines 2897–2906, reports
  `libsqlite3-sys 0.38.2`, RUSTSEC-2026-0459, requiring `>=0.39.0`.
- Compatible updates cannot fix `browser-commander 0.22.1 -> rusqlite
  0.40.2 -> libsqlite3-sys 0.38.2`.
- Source inspection (`rg browser_commander rust/src rust/tests`) finds no
  imports, calls or re-exports. `src/browser.rs` launches installed Chrome
  directly with `tokio::process::Command` for DOM rendering and screenshots.
  Removing this unused dependency removes the vulnerable SQLite code without
  changing browser or cookie behavior. No advisory or security check is ignored.
- Regression verification: the unchanged strict `cargo audit --file
  rust/Cargo.lock --deny warnings` fails before this change and must pass after
  it. Existing `integration::browser` tests cover JavaScript rendering, CLI
  browser capture and PNG screenshots; the CI matrix also verifies every
  feature and fresh dependency resolution.

Public installation probe: `uv pip install --dry-run` in a fresh Python 3.14
environment, using only `https://pypi.org/simple`, fails for
`web-capture-python-examples==0.1.0`. The project JSON endpoint is HTTP 404;
publisher management redirects to `https://pypi.org/account/login/`.
