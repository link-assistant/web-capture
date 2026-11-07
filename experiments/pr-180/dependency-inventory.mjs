// Registry-only inventory; does not compile or install dependencies.
import { readFileSync, writeFileSync } from 'node:fs';
const manifest = JSON.parse(readFileSync('js/package.json'));
const inventory = { npm: {}, cargo: {} };
for (const name of Object.keys({
  ...manifest.dependencies,
  ...manifest.devDependencies,
})) {
  const response = await fetch(`https://registry.npmjs.org/${name}/latest`);
  if (!response.ok) throw new Error(`${name}: ${response.status}`);
  inventory.npm[name] = (await response.json()).version;
}
const toml = readFileSync('rust/Cargo.toml', 'utf8')
  .split('[dependencies]')[1]
  .split('[lints.clippy]')[0];
for (const [, name] of toml.matchAll(/^([\w-]+)\s*=.*(?:version|"\d)/gm)) {
  if (inventory.cargo[name]) continue;
  const response = await fetch(`https://crates.io/api/v1/crates/${name}`, {
    headers: { 'User-Agent': 'web-capture-pr-180' },
  });
  if (!response.ok) throw new Error(`${name}: ${response.status}`);
  inventory.cargo[name] = (await response.json()).crate.max_stable_version;
}
writeFileSync(
  'ci-logs/dependency-inventory.json',
  JSON.stringify(inventory, null, 2) + '\n'
);
console.log(inventory);
