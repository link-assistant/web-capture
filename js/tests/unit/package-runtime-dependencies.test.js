import { readFileSync } from 'fs';
import { dirname, resolve } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const jsRoot = resolve(__dirname, '../..');

function readJson(relativePath) {
  return JSON.parse(readFileSync(resolve(jsRoot, relativePath), 'utf8'));
}

const runtimeImports = [
  {
    packageName: 'turndown-plugin-gfm',
    sourceFile: 'src/lib.js',
  },
];

describe('runtime package dependencies', () => {
  test.each(runtimeImports)(
    '$packageName is declared as a production dependency',
    ({ packageName, sourceFile }) => {
      const source = readFileSync(resolve(jsRoot, sourceFile), 'utf8');
      const packageJson = readJson('package.json');

      expect(source).toContain(`from '${packageName}'`);
      expect(packageJson.dependencies).toHaveProperty(packageName);
      expect(packageJson.devDependencies || {}).not.toHaveProperty(packageName);
    }
  );

  test.each(runtimeImports)(
    '$packageName is not marked dev-only in package-lock.json',
    ({ packageName }) => {
      const packageLock = readJson('package-lock.json');

      expect(packageLock.packages[''].dependencies).toHaveProperty(packageName);
      expect(packageLock.packages[''].devDependencies || {}).not.toHaveProperty(
        packageName
      );
      expect(packageLock.packages[`node_modules/${packageName}`]).toBeDefined();
      expect(packageLock.packages[`node_modules/${packageName}`].dev).not.toBe(
        true
      );
    }
  );
});
