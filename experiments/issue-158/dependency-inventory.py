import concurrent.futures, json, pathlib, tomllib, urllib.request
root = pathlib.Path(__file__).resolve().parents[2]
manifest = tomllib.loads((root / 'rust/Cargo.toml').read_text())
def inspect(item):
    name, spec = item
    req = urllib.request.Request(f'https://crates.io/api/v1/crates/{name}', headers={'User-Agent': 'web-capture-issue-158-investigation'})
    with urllib.request.urlopen(req) as response:
        data = json.load(response)
    return {'name': name, 'declared': spec if isinstance(spec, str) else spec['version'], 'latest': data['crate']['max_stable_version']}
items = list(manifest['dependencies'].items()) + list(manifest['dev-dependencies'].items())
with concurrent.futures.ThreadPoolExecutor(max_workers=6) as pool:
    result = list(pool.map(inspect, items))
(root / 'docs/case-studies/issue-158/data/rust-dependencies-before.json').write_text(json.dumps(result, indent=2) + '\n')
for entry in result:
    print(entry)
