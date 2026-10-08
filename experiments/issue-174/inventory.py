"""Resolve all committed dependency versions from their registries before editing."""
import concurrent.futures
import json
from pathlib import Path
import re
import subprocess
import tomllib
import urllib.parse
import urllib.request

ROOT = Path(__file__).resolve().parents[2]
OUT = ROOT / "dev/log/issues/174/pulls/175/data"


def get(url):
    request = urllib.request.Request(url, headers={"User-Agent": "web-capture-issue-174"})
    with urllib.request.urlopen(request) as response:
        return json.load(response)


def npm(name):
    data = get(f"https://registry.npmjs.org/{urllib.parse.quote(name, safe='')}/latest")
    return name, {"latest": data["version"], "engines": data.get("engines", {}),
                  "repository": data.get("repository"), "dependencies": data.get("dependencies", {})}


def cargo(name):
    data = get(f"https://crates.io/api/v1/crates/{name}")
    return name, {"latest": data["crate"]["max_stable_version"],
                  "repository": data["crate"].get("repository")}


def collect():
    manifest = json.loads((ROOT / "js/package.json").read_text())
    lock = json.loads((ROOT / "js/package-lock.json").read_text())
    packages = {}
    for location, data in lock["packages"].items():
        if location and "version" in data:
            name = data.get("name") or location.rsplit("node_modules/", 1)[-1]
            packages.setdefault(name, set()).add(data["version"])
    direct = {**manifest["dependencies"], **manifest["devDependencies"]}
    extras = ["npm", "npm-check-updates", "nodemon", "capture-website", "use-m", "command-stream"]
    with concurrent.futures.ThreadPoolExecutor(max_workers=8) as pool:
        resolved = dict(pool.map(npm, sorted(set(packages) | set(direct) | set(extras))))
    result = [{"name": name, "declared": direct.get(name),
               "before": sorted(packages.get(name, [])), **data}
              for name, data in resolved.items()]
    (OUT / "npm-before.json").write_text(json.dumps(result, indent=2) + "\n")
    rust_manifest = tomllib.loads((ROOT / "rust/Cargo.toml").read_text())
    rust_lock = tomllib.loads((ROOT / "rust/Cargo.lock").read_text())
    packages = {}
    for data in rust_lock["package"]:
        if data.get("source", "").startswith("registry+"):
            packages.setdefault(data["name"], set()).add(data["version"])
    direct = {**rust_manifest["dependencies"], **rust_manifest["dev-dependencies"]}
    names = sorted(set(packages) | {"cargo-audit", "cargo-edit"})
    with concurrent.futures.ThreadPoolExecutor(max_workers=4) as pool:
        resolved = dict(pool.map(cargo, names))
    result = [{"name": name, "declared": direct.get(name),
               "before": sorted(packages.get(name, [])), **data}
              for name, data in resolved.items()]
    (OUT / "cargo-before.json").write_text(json.dumps(result, indent=2) + "\n")
    refs = sorted(set(re.findall(r"uses:\s*([^\s]+)", "\n".join(
        p.read_text() for p in (ROOT / ".github/workflows").glob("*.yml")))))
    actions = []
    for ref in refs:
        repo, current = ref.rsplit("@", 1)
        if repo == "dtolnay/rust-toolchain":
            data = json.loads(subprocess.check_output(["gh", "api", f"repos/{repo}/commits/stable"]))
            latest = data["sha"]
        else:
            data = json.loads(subprocess.check_output(["gh", "api", f"repos/{repo}/releases/latest"]))
            latest = data["tag_name"]
        actions.append({"name": repo, "before": current, "latest": latest})
    (OUT / "actions-before.json").write_text(json.dumps(actions, indent=2) + "\n")
    pypi = {}
    for name in ["requests", "pip", "pip-audit", "uv"]:
        data = get(f"https://pypi.org/pypi/{name}/json")
        pypi[name] = {"latest": data["info"]["version"], "requires_python": data["info"]["requires_python"]}
    (OUT / "python-before.json").write_text(json.dumps(pypi, indent=2) + "\n")
    print(f"Inventoried {len(resolved)} crates, {len(packages)} locked crate names and all npm/action/Python inputs.")


if __name__ == "__main__":
    collect()
