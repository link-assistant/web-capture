# Python trusted publishing

## Publisher identity

The first public version is **0.1.0**, replacing the development placeholder
`0.0.0`. Python versions are independent of the JavaScript and Rust versions.
Register this pending publisher at <https://pypi.org/manage/account/publishing/>:

| Field | Value |
| --- | --- |
| PyPI project name | `web-capture-python-examples` |
| GitHub owner | `link-assistant` |
| GitHub repository | `web-capture` |
| Workflow filename | `python.yml` |
| Environment | `pypi` |

These are also the settings to attach with
`package-registry-manager setup --registry pypi --execute` when that tool and
an authenticated PyPI owner account are available. The environment must match
exactly on GitHub and PyPI. If the project already exists, add the same identity
under its Publishing settings instead of creating a pending publisher.

The publishing job requests `id-token: write` and uses the PyPA publishing
action to exchange GitHub's OIDC identity for a short-lived credential.
No PyPI API token secret or fallback is used. Build and PR jobs have no OIDC
permission. Only Python version tag pushes in the upstream repository publish.

## Release procedure

1. Register the publisher above and configure the GitHub `pypi` environment to
   allow release tags matching `python-v*` (optionally require reviewer approval).
2. Update `project.version` in `pyproject.toml`, run `uv lock`, and export
   `requirements.txt` with the command below. Merge the reviewed PR after CI passes.
3. Tag that reviewed commit `python-v<project.version>` (initially `python-v0.1.0`)
   and push the tag. JS and Rust tags do not publish Python packages.
4. Check the **Python Package and Release** workflow. It rejects a mismatched
   tag, builds an sdist and a wheel from that sdist, checks metadata with Twine,
   and runs the local HTTP fixture tests against both installed artifacts in
   isolated environments outside the checkout. Only then does it upload the
   verified artifacts using OIDC. Publish errors fail the workflow.
5. Verify the public release in a clean environment:

   ```bash
   uv venv --python 3.14 /tmp/web-capture-pypi-check
   uv pip install --python /tmp/web-capture-pypi-check/bin/python --index-url https://pypi.org/simple web-capture-python-examples==0.1.0
   /tmp/web-capture-pypi-check/bin/python -c 'from importlib.metadata import version; from web_capture_python_examples import capture; print(version("web-capture-python-examples"))'
   ```

Local verification from the repository root:

```bash
uv lock
uv export --locked --no-dev --no-emit-project --format requirements-txt --output-file requirements.txt
uv build --no-sources
uvx --from twine==7.0.0 twine check --strict dist/*
uv run --locked python scripts/check-python-distribution.py --dist dist --tag python-v0.1.0
uv run --locked python -m unittest discover -s tests/python -v
bash experiments/issue-190/verify-installed.sh
```

## Publication status and remaining acceptance criteria

At investigation on 2026-11-15, the public PyPI JSON endpoint
`https://pypi.org/pypi/web-capture-python-examples/json` returned **404**.
This workspace has no `package-registry-manager` executable or authenticated
PyPI owner session. Pending-publisher registration and a real OIDC upload
remain unverified. GitHub credentials alone cannot register a PyPI publisher.
A successful PR build or local installation does not prove PyPI availability.
Keep the PR unmerged until the external acceptance criteria are resolved and
record the successful release run and clean public-index installation here.

References: [PyPI pending publishers](https://docs.pypi.org/trusted-publishers/creating-a-project-through-oidc/),
[PyPA release workflow guide](https://packaging.python.org/en/latest/guides/publishing-package-distribution-releases-using-github-actions-ci-cd-workflows/).
