#!/usr/bin/env node

import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import path from "node:path";

const repositoryRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
);
const rustDirectory = path.join(repositoryRoot, "rust");
const forbiddenPackages = [
  "axum",
  "browser-commander",
  "openssl-sys",
  "reqwest",
  "tokio",
];

const tree = execFileSync(
  "cargo",
  [
    "tree",
    "--manifest-path",
    path.join(rustDirectory, "Cargo.toml"),
    "--no-default-features",
    "--features",
    "search",
    "--edges",
    "normal",
    "--prefix",
    "none",
  ],
  { encoding: "utf8" },
);

const selectedPackages = new Set(
  tree
    .split("\n")
    .map((line) => line.match(/^([^\s]+) v\d/iu)?.[1])
    .filter(Boolean),
);
const found = forbiddenPackages.filter((name) => selectedPackages.has(name));

if (found.length > 0) {
  console.error(
    `Minimal Rust search feature selected forbidden packages: ${found.join(", ")}`,
  );
  process.exit(1);
}

console.log(
  "Minimal Rust search feature excludes browser, server, HTTP, async runtime, and OpenSSL packages.",
);
