"""Generate exhaustive before/latest/after tables and explain upstream version slots."""
import concurrent.futures
import json
from pathlib import Path
import tomllib
from inventory import ROOT, OUT, npm, cargo, get


def npm_tree():
    versions, parents = {}, {}
    for lockfile in [ROOT / 'package-lock.json', ROOT / 'js/package-lock.json']:
        lock = json.loads(lockfile.read_text())
        for location, data in lock['packages'].items():
            name = data.get('name') or location.rsplit('node_modules/', 1)[-1] or lock['name']
            if location and 'version' in data:
                versions.setdefault(name, set()).add(data['version'])
            for child, constraint in {**data.get('dependencies', {}), **data.get('optionalDependencies', {}),
                                      **data.get('peerDependencies', {})}.items():
                parents.setdefault(child, set()).add(f"{name}@{data.get('version', '?')}: {constraint}")
    return versions, parents


def table(rows):
    return '\n'.join(['| Dependency | Before | Registry latest | After | Reason for older/removal |',
                      '| --- | --- | --- | --- | --- |'] +
                     ['| ' + ' | '.join(str(x).replace('|', '\\|').replace('\n', ' ') for x in row) + ' |'
                      for row in rows])


def main():
    before = json.loads((OUT / 'npm-before.json').read_text())
    versions, parents = npm_tree()
    known = {x['name']: x for x in before}
    with concurrent.futures.ThreadPoolExecutor(max_workers=8) as pool:
        for name, data in pool.map(npm, sorted(set(versions) - known.keys())):
            known[name] = {'name': name, 'before': [], **data}
    (OUT / 'npm-final-registry.json').write_text(json.dumps(list(known.values()), indent=2) + '\n')
    rows = []
    for name, data in sorted(known.items()):
        installed = sorted(versions.get(name, []))
        if name == 'npm':
            installed = ['12.2.0 (packageManager)']
            reason = 'Toolchain, not a library; exact version installed by release bootstrap'
        elif name == 'npm-check-updates':
            installed = [data['latest'] + ' (update tool)']
            reason = 'Registry-current migration tool; not shipped as a runtime dependency'
        elif name == 'browser-commander':
            reason = '[Issue 160](https://github.com/link-assistant/web-capture/issues/160): packaged consumers cannot load mandatory native SQLite; see VALIDATION.md'
        elif not installed:
            reason = 'Removed/unneeded; native ESM/watch or locked Execa replaces the former path'
        elif any(v != data['latest'] for v in installed):
            reason = 'Current upstream parents retain these version slots: ' + '; '.join(sorted(parents.get(name, [])))
        else:
            reason = 'Current'
        rows.append([name, ', '.join(data['before']) or 'unlocked/not declared', data['latest'],
                     ', '.join(installed) or 'removed', reason])
    contents = '# Complete registry-resolved dependency inventory\n\nResolved on 2026-10-08 UTC. Before is the prepared branch, after is the committed resolution.\n'
    contents += '\n## npm: runtime, tools, development and all lockfile entries\n\n' + table(rows) + '\n'
    known = {x['name']: x for x in json.loads((OUT / 'cargo-before.json').read_text())}
    lockfiles = [ROOT / 'rust/Cargo.lock', ROOT / 'experiments/issue-158/fresh-consumer/Cargo.lock']
    versions = {}
    for lockfile in lockfiles:
        for data in tomllib.loads(lockfile.read_text())['package']:
            if data.get('source', '').startswith('registry+'):
                versions.setdefault(data['name'], set()).add(data['version'])
    with concurrent.futures.ThreadPoolExecutor(max_workers=4) as pool:
        for name, data in pool.map(cargo, sorted(set(versions) - known.keys())):
            known[name] = {'name': name, 'before': [], **data}
    metadata = json.loads((ROOT / 'ci-logs/issue-174-cargo-metadata.json').read_text())
    parents = {}
    for package in metadata['packages']:
        for dep in package['dependencies']:
            parents.setdefault(dep['name'], set()).add(f"{package['name']}@{package['version']}: {dep['req']}")
    rows = []
    for name, data in sorted(known.items()):
        installed = sorted(versions.get(name, []))
        if name in ['cargo-audit', 'cargo-edit']:
            installed = [data['latest'] + ' (tool)']
            reason = 'Registry-current development tool'
        elif not installed:
            reason = 'No longer resolved'
        elif any(v != data['latest'] for v in installed):
            reason = 'Current upstream parents retain these version slots: ' + '; '.join(sorted(parents.get(name, [])))
        else:
            reason = 'Current'
        rows.append([name, ', '.join(data['before']) or 'not previously locked', data['latest'],
                     ', '.join(installed) or 'removed', reason])
    (OUT / 'cargo-final-registry.json').write_text(json.dumps(list(known.values()), indent=2) + '\n')
    contents += '\n## Cargo: both projects and every registry lockfile entry\n\n' + table(rows) + '\n'
    lock = tomllib.loads((ROOT / 'uv.lock').read_text())
    rows, registry = [], []
    for package in lock['package']:
        if 'registry' not in package['source']:
            continue
        data = get(f"https://pypi.org/pypi/{package['name']}/json")
        latest = data['info']['version']
        registry.append({'name': package['name'], 'after': package['version'], 'latest': latest,
                         'requires_python': data['info']['requires_python']})
        reason = 'Current' if package['version'] == latest else 'Current upstream dependency constraints in uv.lock'
        rows.append([package['name'], 'unlocked/not declared', latest, package['version'], reason])
    for name in ['pip', 'uv']:
        data = get(f'https://pypi.org/pypi/{name}/json')
        registry.append({'name': name, 'latest': data['info']['version']})
        rows.append([name, 'not pinned', data['info']['version'], data['info']['version'], 'Development/install tool'])
    (OUT / 'python-final-registry.json').write_text(json.dumps(registry, indent=2) + '\n')
    contents += '\n## Python: runtime examples and all locked tooling\n\n' + table(rows) + '\n'
    actions = json.loads((OUT / 'actions-before.json').read_text())
    uv = json.loads((OUT / 'setup-uv-release.json').read_text())
    actions.append({'name': 'astral-sh/setup-uv', 'before': 'not used', 'latest': uv['tag_name']})
    contents += '\n## Every GitHub Action\n\n' + table([[x['name'],x['before'],x['latest'],x['latest'],'Current'] for x in actions]) + '\n'
    contents += '''
## Runtimes, images, templates and other pins

| Input | Before | Registry latest | After | Reason |
| --- | --- | --- | --- | --- |
| Node source/CI | 24 / >=22 | 26.11.1 | 26.11.1; engine >=26.10.0 | Latest published official Docker image is 26.10.0; support that current image baseline |
| npm | >=11; unlocked bootstrap | 12.2.0 | 12.2.0 in both manifests, all npm CI jobs, Docker and scaffold | Exact supported release bootstrap |
| Python | undeclared | 3.14.8 | 3.14.8; >=3.14.8 | uv-managed interpreter |
| Rust | stable / 1.96 / edition 2021 | 1.99.0 / edition 2024 | 1.99.0 / rust-version 1.99 / edition 2024 | Both Cargo projects and every workflow |
| Node image | node:24-bookworm | node:26.10.0-trixie | node:26.10.0-trixie | 26.11.1-trixie is not published (registry 404); image publication lag |
| Rust builder image | rust:1.96-bullseye | rust:1.99.0-trixie | rust:1.99.0-trixie | Current |
| Rust bare CI image | rust:1.96-slim-bullseye | rust:1.99.0-slim-trixie | rust:1.99.0-slim-trixie | Current |
| Rust runtime image | debian:bookworm-slim | debian:trixie-20261005-slim | debian:trixie-20261005-slim | Current stable distro dated image |
| Scaffold Express/Capture Website/Turndown | ^4.18.2 / ^4.1.0 / ^7.1.1 | 5.2.1 / 5.1.0 / 7.2.4 | Maintained web-capture package | Delete duplicate implementation and its untracked dependencies; all routes preserved |
| Scaffold image | node:20-slim | node:26.10.0-trixie | Same maintained JS Dockerfile | No independent stale image or apt list |
| Playwright prebuilt browser image | dynamically resolved v1.63.0-noble | v1.63.0-noble (published) | v1.64.0-noble attempted; matching CDN fallback | Registry returns 404 for current library's unpublished image; retain existing CDN fallback instead of using an incompatible older browser bundle |
| Compose | local Dockerfile build | no external image | local Dockerfile build | No separate external dependency |
| Changesets JSON schema | config@3.1.1 URL | config@4.0.1 | Local schema from locked config@4.0.1 | Match the installed current package without a second CDN version pin |

Unpublished optional Kreuzberg musl packages have no registry version. npm 12's
lock generator drops their placeholders, although npm 12's clean installer
requires them. The compatible lock is generated once with npm 11.13.0 and verified
with npm 12.2.0; no old npm runtime/dependency is shipped. See VALIDATION.md.

Old-major transitive versions are explicit upstream constraints, not forgotten
direct updates. Forcing them with overrides can break their current parent API.
Every remaining older slot and its parent requirement is listed above. Historical
case-study dependency pins describe past incidents and are retained as evidence.
'''
    (OUT.parent / 'DEPENDENCIES.md').write_text(contents)
    print(f"Inventory written: {len(contents.splitlines())} lines")


if __name__ == '__main__':
    main()
