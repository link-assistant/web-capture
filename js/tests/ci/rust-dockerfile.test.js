import { readFileSync } from 'fs';
import { dirname, resolve } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const repoRoot = resolve(__dirname, '../../..');

function parseVersion(version) {
  return version.split('.').map((part) => Number(part));
}

function compareVersions(left, right) {
  const leftParts = parseVersion(left);
  const rightParts = parseVersion(right);
  const maxLength = Math.max(leftParts.length, rightParts.length);

  for (let index = 0; index < maxLength; index += 1) {
    const leftPart = leftParts[index] || 0;
    const rightPart = rightParts[index] || 0;

    if (leftPart !== rightPart) {
      return leftPart - rightPart;
    }
  }

  return 0;
}

describe('Rust Dockerfile', () => {
  test('uses a Rust builder image that satisfies Cargo.toml rust-version', () => {
    const cargoToml = readFileSync(
      resolve(repoRoot, 'rust/Cargo.toml'),
      'utf8'
    );
    const dockerfile = readFileSync(
      resolve(repoRoot, 'rust/Dockerfile'),
      'utf8'
    );

    const requiredRustVersion = cargoToml.match(
      /^rust-version = "([^"]+)"/m
    )?.[1];
    const dockerRustVersion = dockerfile.match(
      /^FROM rust:(\d+(?:\.\d+){1,2})[-\s]/m
    )?.[1];

    expect(requiredRustVersion).toBeDefined();
    expect(dockerRustVersion).toBeDefined();
    expect(
      compareVersions(dockerRustVersion, requiredRustVersion)
    ).toBeGreaterThanOrEqual(0);
  });
});
