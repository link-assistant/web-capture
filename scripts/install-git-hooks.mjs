#!/usr/bin/env node
// `prepare` hook for js/: install the husky pre-commit hook (lint-staged).
//
// Running plain `husky` from js/ printed ".git can't be found" into every
// `npm ci` and `npm publish` log, because the git root is the parent
// directory, and exited 0, so the hooks were never installed. Husky must run
// from the git root with the hooks directory as argument; its exit code
// proves nothing, so verify core.hooksPath afterwards (pattern from
// link-foundation/js-ai-driven-development-pipeline-template).
import { execFileSync } from "node:child_process";
import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const jsRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../js",
);
const gitRoot = path.dirname(jsRoot);
const hooksDir = "js/.husky";

if (process.env.CI || process.env.HUSKY === "0") {
  process.exit(0);
}

// A consumer installing the package has no repository checkout.
if (!existsSync(path.join(gitRoot, ".git"))) {
  process.exit(0);
}

const { default: husky } = await import(
  path.join(jsRoot, "node_modules/husky/index.js")
);
const cwd = process.cwd();
process.chdir(gitRoot);
const message = husky(hooksDir);
process.chdir(cwd);

let hooksPath = "";
try {
  hooksPath = execFileSync("git", ["config", "--get", "core.hooksPath"], {
    cwd: gitRoot,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "ignore"],
  }).trim();
} catch {
  hooksPath = "";
}

if (hooksPath !== `${hooksDir}/_`) {
  console.error(
    `git hooks were not installed: ${message || `core.hooksPath is "${hooksPath}"`}`,
  );
  process.exit(1);
}
