import assert from "node:assert/strict";
import { test } from "node:test";
import {
  mkdtempSync,
  mkdirSync,
  writeFileSync,
  readFileSync,
  cpSync,
  symlinkSync,
  rmSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { $ } from "execa";
import {
  getJsRoot,
  getPackageJsonPath,
  getPackageLockPath,
  getChangesetDir,
  resetCache,
} from "../../scripts/js-paths.mjs";

test("release helpers select js/ when a root tooling manifest also exists", () => {
  const original = process.cwd();
  const directory = mkdtempSync(join(tmpdir(), "web-capture-paths-"));
  try {
    writeFileSync(join(directory, "package.json"), '{"private":true}');
    mkdirSync(join(directory, "js"));
    writeFileSync(
      join(directory, "js/package.json"),
      '{"name":"published-package"}',
    );
    process.chdir(directory);
    resetCache();
    assert.equal(getJsRoot(), "js");
    assert.equal(getPackageJsonPath(), "js/package.json");
    assert.equal(getPackageLockPath(), "js/package-lock.json");
    assert.equal(getChangesetDir(), "js/.changeset");
    process.chdir(join(directory, "js"));
    resetCache();
    assert.equal(getJsRoot(), ".");
    assert.equal(getJsRoot({ jsRoot: "custom" }), "custom");
  } finally {
    process.chdir(original);
    resetCache();
    rmSync(directory, { recursive: true, force: true });
  }
});

test("a manual release from the repository root versions only the published package", async () => {
  const repository = fileURLToPath(new URL("../../", import.meta.url));
  const directory = mkdtempSync(join(tmpdir(), "web-capture-release-"));
  const tooling = { name: "private-tools", private: true, version: "1.0.0" };
  try {
    writeFileSync(join(directory, "package.json"), JSON.stringify(tooling));
    mkdirSync(join(directory, "js"));
    writeFileSync(
      join(directory, "js/package.json"),
      JSON.stringify({ name: "published-package", version: "1.0.0" }),
    );
    writeFileSync(
      join(directory, "js/CHANGELOG.md"),
      "# Changelog\n\n## 1.0.0\n",
    );
    cpSync(join(repository, "scripts"), join(directory, "scripts"), {
      recursive: true,
    });
    symlinkSync(
      join(repository, "node_modules"),
      join(directory, "node_modules"),
      "dir",
    );
    await $({
      cwd: directory,
    })`${process.execPath} scripts/instant-version-bump.mjs --bump-type patch --description ${'Quotes " and $literal\nnewlines'}`;
    assert.deepEqual(
      JSON.parse(readFileSync(join(directory, "package.json"), "utf8")),
      tooling,
    );
    assert.equal(
      JSON.parse(readFileSync(join(directory, "js/package.json"), "utf8"))
        .version,
      "1.0.1",
    );
    assert.match(
      readFileSync(join(directory, "js/CHANGELOG.md"), "utf8"),
      /## 1\.0\.1/,
    );
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});
