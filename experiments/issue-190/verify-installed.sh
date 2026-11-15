#!/usr/bin/env bash
# Run from any directory after uv build. No browser or external service needed.
set -euo pipefail
project_root=$(cd "$(dirname "$0")/../.." && pwd)
smoke_dir=$(mktemp -d)
trap 'rm -rf "$smoke_dir"' EXIT
for artifact in "$project_root"/dist/*.whl "$project_root"/dist/*.tar.gz; do
  uv venv --python "$(cat "$project_root/.python-version")" "$smoke_dir/venv" --clear
  smoke_python="$smoke_dir/venv/bin/python"
  uv pip install --python "$smoke_python" "$artifact"
  (
    cd "$smoke_dir"
    export WEB_CAPTURE_EXAMPLES_DIR
    WEB_CAPTURE_EXAMPLES_DIR=$("$smoke_python" -c 'import pathlib, web_capture_python_examples as p; print(pathlib.Path(p.__file__).parent)')
    "$smoke_python" -m unittest discover -s "$project_root/tests/python" -v
  )
done
