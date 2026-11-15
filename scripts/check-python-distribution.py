"""Validate release identity and built metadata without importing source code."""
import argparse
from email.parser import BytesParser
from pathlib import Path
import tarfile
import tomllib
import zipfile

ROOT = Path(__file__).resolve().parents[1]


def check_tag(version, tag):
    expected = f"python-v{version}"
    if tag != expected:
        raise ValueError(f"Release tag must be {expected!r}, got {tag!r}")


def check_distributions(directory, project):
    files = sorted(p for p in directory.iterdir() if not p.name.startswith("."))
    version = project["version"]
    stem = f"web_capture_python_examples-{version}"
    expected = {f"{stem}.tar.gz", f"{stem}-py3-none-any.whl"}
    if {p.name for p in files} != expected:
        raise ValueError(f"Expected exactly {sorted(expected)}, got {[p.name for p in files]}")
    with zipfile.ZipFile(directory / f"{stem}-py3-none-any.whl") as wheel:
        modules = {Path(p).name for p in (ROOT / 'js/examples/python').glob('*.py')}
        assert {f'web_capture_python_examples/{name}' for name in modules} <= set(wheel.namelist())
        metadata = wheel.read(f"{stem}.dist-info/METADATA")
        assert not any(p.startswith(('tests/', 'rust/', 'experiments/')) for p in wheel.namelist())
    with tarfile.open(directory / f"{stem}.tar.gz") as sdist:
        for name in ['pyproject.toml', 'docs/python-examples.md', 'LICENSE', *[f'js/examples/python/{name}' for name in modules]]:
            assert f"{stem}/{name}" in sdist.getnames(), name
        source_metadata = sdist.extractfile(f"{stem}/PKG-INFO").read()
    for raw in [metadata, source_metadata]:
        parsed = BytesParser().parsebytes(raw)
        assert parsed['Name'] == project['name']
        assert parsed['Version'] == version
        assert parsed['Requires-Python'] == project['requires-python']
        assert parsed['Description-Content-Type'] == 'text/markdown'
        assert 'Repository, https://github.com/link-assistant/web-capture' in parsed.get_all('Project-URL')
        assert parsed.get_all('Requires-Dist') == project['dependencies']
        assert 'Python HTTP client examples' in parsed.get_payload()
    print(f"Verified sdist, wheel, modules, README, dependencies and repository metadata for {version}")


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--tag', help='Require this release tag to match project.version')
    parser.add_argument('--dist', type=Path, help='Check the distribution directory')
    args = parser.parse_args()
    project = tomllib.loads((ROOT / 'pyproject.toml').read_text())['project']
    if args.tag is not None:
        check_tag(project['version'], args.tag)
    if args.dist is not None:
        check_distributions(args.dist, project)
