#!/usr/bin/env node

/**
 * Enforce JS/Rust parity for shared source and test changes.
 *
 * If a PR changes JavaScript source/tests, it must also change Rust
 * source/tests. If it changes Rust source/tests, it must also change
 * JavaScript source/tests. Documentation, release metadata, workflows, and
 * scripts are intentionally ignored by this guard.
 */

import { execFileSync } from "child_process";

const JS_PARITY_PATHS = ["js/src/", "js/tests/"];
const RUST_PARITY_PATHS = ["rust/src/", "rust/tests/"];

function git(args) {
  return execFileSync("git", args, { encoding: "utf8" }).trim();
}

function splitLines(output) {
  return output ? output.split("\n").filter(Boolean) : [];
}

function diffFiles(base, head) {
  return splitLines(git(["diff", "--name-only", `${base}...${head}`]));
}

function fallbackDiffFiles() {
  try {
    return splitLines(git(["diff", "--name-only", "HEAD^", "HEAD"]));
  } catch {
    return splitLines(git(["ls-tree", "--name-only", "-r", "HEAD"]));
  }
}

function changedFiles() {
  const baseSha = process.env.GITHUB_BASE_SHA;
  const headSha = process.env.GITHUB_HEAD_SHA || "HEAD";

  if (baseSha) {
    return diffFiles(baseSha, headSha);
  }

  const baseRef = process.env.GITHUB_BASE_REF || "main";
  try {
    git(["fetch", "origin", baseRef, "--depth=1"]);
    return diffFiles(`origin/${baseRef}`, headSha);
  } catch {
    return fallbackDiffFiles();
  }
}

function matchingFiles(files, prefixes) {
  return files.filter((file) =>
    prefixes.some((prefix) => file.startsWith(prefix)),
  );
}

function printFiles(title, files) {
  console.log(title);
  if (files.length === 0) {
    console.log("  (none)");
    return;
  }
  for (const file of files) {
    console.log(`  ${file}`);
  }
}

const files = changedFiles();
const jsFiles = matchingFiles(files, JS_PARITY_PATHS);
const rustFiles = matchingFiles(files, RUST_PARITY_PATHS);
const issues = [];

console.log("Checking JS/Rust source and test parity.\n");
printFiles("Changed files:", files);
console.log("");
printFiles("JS source/test changes:", jsFiles);
console.log("");
printFiles("Rust source/test changes:", rustFiles);
console.log("");

if (jsFiles.length > 0 && rustFiles.length === 0) {
  issues.push(
    "JavaScript source/tests changed without corresponding Rust source/tests.",
  );
}

if (rustFiles.length > 0 && jsFiles.length === 0) {
  issues.push(
    "Rust source/tests changed without corresponding JavaScript source/tests.",
  );
}

if (issues.length > 0) {
  for (const issue of issues) {
    console.error(`::error::${issue}`);
  }
  console.error(
    "Update the other implementation or add equivalent tests so both language packages stay in sync.",
  );
  process.exit(1);
}

console.log("JS/Rust source and test parity check passed.");
