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
| Installable from public PyPI | Requires first real release | **Unfinished:** public JSON endpoint returns 404; no authenticated PyPI session or setup executable |
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
