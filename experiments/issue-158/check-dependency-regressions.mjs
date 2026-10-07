import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const lock = JSON.parse(readFileSync('js/package-lock.json', 'utf8'));
assert.equal(Object.keys(lock.packages).some(key => key.endsWith('/extract-zip')), false, 'Puppeteer graph must not include extract-zip');
assert.equal(/^name = "fxhash"$/m.test(readFileSync('rust/Cargo.lock', 'utf8')), false, 'search graph must not include fxhash');
console.log('Both dependency graph regressions are absent.');
