import { readFile, writeFile } from 'node:fs/promises';
const manifest = JSON.parse(await readFile(new URL('../../js/package.json', import.meta.url)));
const entries = Object.entries({...manifest.dependencies, ...manifest.devDependencies});
const result = [];
for (let i = 0; i < entries.length; i += 6) {
  const batch = await Promise.all(entries.slice(i, i + 6).map(async ([name, declared]) => {
    const response = await fetch(`https://registry.npmjs.org/${name}/latest`);
    if (!response.ok) throw new Error(`${name}: ${response.status}`);
    const data = await response.json();
    return {name, declared, latest: data.version, engines: data.engines};
  }));
  result.push(...batch);
}
await writeFile(new URL('../../docs/case-studies/issue-158/data/npm-dependencies-before.json', import.meta.url), JSON.stringify(result, null, 2) + '\n');
console.log(result.map(({name,declared,latest}) => `${name}: ${declared} -> ${latest}`).join('\n'));
