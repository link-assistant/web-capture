#!/usr/bin/env node

// Guards issue #151: `web-capture` must not drag OpenSSL into a consumer's build.
//
// `cargo tree -i openssl-sys` prints the inverted tree — every path from
// `openssl-sys` up to the crates that pull it in. This script walks that tree and
// checks which of `web-capture`'s own dependencies sit on such a path.
//
// Anything reached through the crate's direct dependencies (reqwest, ...) is a
// defect here and fails the check. The one accepted route is
// `browser-commander -> fantoccini`, whose `default = ["native-tls"]` cannot be
// turned off downstream (Cargo unifies features as a union); that half is tracked
// upstream in link-foundation/browser-commander#77. Once it is fixed the allow
// list below should be emptied and this check becomes "openssl-sys is absent".

import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const repositoryRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
);
const manifestPath = path.join(repositoryRoot, "rust", "Cargo.toml");

// Direct dependencies of `web-capture` that are still allowed to reach OpenSSL,
// with the upstream issue that tracks removing them.
const knownUpstreamGaps = new Map([
  ["browser-commander", "link-foundation/browser-commander#77"],
]);

// --- Manifest assertions -----------------------------------------------------
// The dependency tree alone would go green again the moment an unrelated crate
// stopped pulling OpenSSL, so pin the manifest shape that produces it as well.

const manifest = readFileSync(manifestPath, "utf8");
const manifestProblems = [];

// The entry is an inline table, so it ends at the first closing brace.
const reqwestEntry = (manifest.match(/^reqwest = [^}]*\}/mu)?.[0] ?? "")
  .split(/\s+/u)
  .join(" ");

if (reqwestEntry === "") {
  manifestProblems.push("could not locate the `reqwest` dependency entry");
} else {
  if (!reqwestEntry.includes("default-features = false")) {
    manifestProblems.push(
      "reqwest must be taken with `default-features = false`, otherwise `native-tls` " +
        "and `openssl-sys` return to every consumer's tree",
    );
  }
  if (!reqwestEntry.includes('"rustls-tls"')) {
    manifestProblems.push("reqwest must select `rustls-tls` as its TLS backend");
  }
  // `charset` backs `Response::text()`; `cookies`, `gzip` and `http2` back the
  // transport behavior that was in place before default features were dropped.
  for (const feature of ["charset", "cookies", "gzip", "http2"]) {
    if (!reqwestEntry.includes(`"${feature}"`)) {
      manifestProblems.push(
        `reqwest must keep the \`${feature}\` feature that was part of its default set`,
      );
    }
  }
}

if (!manifest.includes('native-tls = ["dep:reqwest", "reqwest/native-tls"]')) {
  manifestProblems.push(
    "the system TLS stack must stay available as an opt-in `native-tls` feature",
  );
}

const defaultFeature = manifest.slice(
  manifest.indexOf("default = ["),
  manifest.indexOf("]", manifest.indexOf("default = [")),
);
if (defaultFeature.includes("native-tls")) {
  manifestProblems.push(
    "the `native-tls` feature must not be part of the default feature set",
  );
}

if (manifestProblems.length > 0) {
  for (const problem of manifestProblems) {
    console.error(`::error::${problem} (issue #151)`);
  }
  process.exit(1);
}

console.log(
  "Cargo.toml keeps reqwest on rustls with system TLS as an opt-in feature.",
);

// --- Dependency tree ---------------------------------------------------------

let tree = "";
try {
  tree = execFileSync(
    "cargo",
    [
      "tree",
      "--manifest-path",
      manifestPath,
      "--edges",
      "normal",
      "--invert",
      "openssl-sys",
      "--prefix",
      "depth",
    ],
    { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] },
  );
} catch (error) {
  // `cargo tree -i` exits non-zero when the package is not in the graph at all,
  // which is exactly the outcome this check wants.
  const message = `${error.stdout ?? ""}${error.stderr ?? ""}`;
  if (/did not match any packages/u.test(message)) {
    console.log("openssl-sys is absent from the default dependency tree.");
    process.exit(0);
  }
  throw error;
}

// Lines look like `2browser-commander v0.9.1`; the leading number is the depth.
const entries = tree
  .split("\n")
  .map((line) => line.match(/^(\d+)([^\s]+) v/u))
  .filter(Boolean)
  .map(([, depth, name]) => ({ depth: Number(depth), name }));

// Walk the inverted tree and record, for each `web-capture` occurrence, the
// dependency one level below it — the direct dependency that pulled OpenSSL in.
const offendingDependencies = new Set();
const stack = [];
for (const { depth, name } of entries) {
  stack.length = depth;
  stack[depth] = name;
  if (name === "web-capture" && depth > 0) {
    offendingDependencies.add(stack[depth - 1]);
  }
}

const unexpected = [...offendingDependencies].filter(
  (name) => !knownUpstreamGaps.has(name),
);

if (unexpected.length > 0) {
  console.error(
    `web-capture pulls openssl-sys through: ${unexpected.join(", ")}.\n` +
      "Take these dependencies with `default-features = false` and a rustls-based " +
      "TLS feature instead (see issue #151).",
  );
  process.exit(1);
}

for (const name of offendingDependencies) {
  console.log(
    `Known upstream gap: openssl-sys still reachable via ${name} (${knownUpstreamGaps.get(name)}).`,
  );
}
console.log(
  "No web-capture dependency introduces openssl-sys on its own account.",
);
