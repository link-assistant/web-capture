#!/usr/bin/env node
// Registry checks support explicit, live GitHub issue blockers rather than ignores.
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

export async function checkVersions(
  dependencies,
  blockers,
  getLatest,
  getIssue,
) {
  const problems = [];
  for (const { name, current } of dependencies) {
    const latest = await getLatest(name);
    if (current === latest) {
      continue;
    }
    const blocker = blockers[name];
    if (
      typeof blocker?.reason !== "string" ||
      !blocker.reason.trim() ||
      !/^https:\/\/github\.com\/[^/]+\/[^/]+\/issues\/\d+$/.test(
        blocker.issue || "",
      )
    ) {
      problems.push(
        `${name}: ${current} is behind ${latest}; update or document an open issue blocker`,
      );
      continue;
    }
    const issue = await getIssue(blocker.issue);
    if (issue.state !== "open") {
      problems.push(`${name}: blocker ${blocker.issue} is closed`);
    } else {
      console.log(
        `${name}: ${current} -> ${latest} blocked by ${blocker.issue}: ${blocker.reason}`,
      );
    }
  }
  if (problems.length) {
    throw new Error(problems.join("\n"));
  }
}

// A blocker pins a dependency on purpose, so Dependabot must not keep proposing
// the blocked upgrade (PR #176 merged browser-commander 0.22.0 past blocker #160).
export function checkDependabotIgnores(ecosystem, directory, blockers, config) {
  const ignored = new Set();
  for (const entry of config.split(/^\s*- package-ecosystem:/m).slice(1)) {
    const [name] = entry.trim().split(/\s/, 1);
    const directories = [...entry.matchAll(/['"]?(\/[\w./-]*)['"]?/g)].map(
      (match) => match[1],
    );
    if (
      name.replace(/['"]/g, "") !== ecosystem ||
      !directories.includes(directory)
    ) {
      continue;
    }
    for (const match of entry.matchAll(/dependency-name:\s*['"]?([^'"\s]+)/g)) {
      ignored.add(match[1]);
    }
  }
  const problems = Object.keys(blockers)
    .filter((name) => !ignored.has(name))
    .map(
      (name) =>
        `${name}: blocked by ${blockers[name].issue} but not ignored for ${ecosystem} ${directory} in .github/dependabot.yml`,
    );
  if (problems.length) {
    throw new Error(problems.join("\n"));
  }
}

function dependabotConfig() {
  return readFileSync(path.join(root, ".github/dependabot.yml"), "utf8");
}

async function json(url, authenticated = false) {
  const headers = { "User-Agent": "web-capture-dependency-freshness" };
  if (authenticated && process.env.GITHUB_TOKEN) {
    headers.Authorization = `Bearer ${process.env.GITHUB_TOKEN}`;
  }
  const response = await fetch(url, {
    headers,
    signal: AbortSignal.timeout(30000),
  });
  if (!response.ok) {
    throw new Error(`${url}: HTTP ${response.status}`);
  }
  return response.json();
}
async function issue(url) {
  return json(
    url.replace("https://github.com/", "https://api.github.com/repos/"),
    true,
  );
}

export async function checkNpm() {
  const manifest = JSON.parse(
    readFileSync(path.join(root, "js/package.json"), "utf8"),
  );
  let outdated;
  try {
    outdated = execFileSync("npm", ["outdated", "--json"], {
      cwd: path.join(root, "js"),
      encoding: "utf8",
    });
  } catch (error) {
    if (error.status !== 1) {
      throw error;
    }
    outdated = error.stdout;
  }
  const blockers = manifest.dependencyBlockers || {};
  checkDependabotIgnores("npm", "/js", blockers, dependabotConfig());
  const data = JSON.parse(outdated || "{}");
  // npm includes production, development and optional direct dependencies.
  const dependencies = Object.entries(data).map(([name, value]) => ({
    name,
    current: value.current || "(missing)",
  }));
  await checkVersions(
    dependencies,
    blockers,
    async (name) => data[name].latest,
    issue,
  );
}

export async function checkCargo() {
  const manifestPath = path.join(root, "rust/Cargo.toml");
  const manifest = readFileSync(manifestPath, "utf8");
  const metadata = JSON.parse(
    execFileSync(
      "cargo",
      [
        "metadata",
        "--manifest-path",
        manifestPath,
        "--locked",
        "--all-features",
        "--format-version",
        "1",
      ],
      { encoding: "utf8", maxBuffer: 32 * 1024 * 1024 },
    ),
  );
  const packageById = new Map(metadata.packages.map((item) => [item.id, item]));
  const packageRoot = packageById.get(metadata.resolve.root);
  const node = metadata.resolve.nodes.find(
    (item) => item.id === packageRoot.id,
  );
  const dependencies = node.deps
    .map((dep) => packageById.get(dep.pkg))
    .filter((dep) => dep.source?.startsWith("registry+"))
    .map((dep) => ({ name: dep.name, current: dep.version }));
  const blockers = {};
  for (const line of manifest.split("\n")) {
    const match = line.match(
      /^([\w-]+)\s*=.*#\s*(https:\/\/github\.com\/[^/]+\/[^/]+\/issues\/\d+)\s+(.+)$/,
    );
    if (match) {
      blockers[match[1]] = { issue: match[2], reason: match[3] };
    }
  }
  checkDependabotIgnores("cargo", "/rust", blockers, dependabotConfig());
  await checkVersions(
    dependencies,
    blockers,
    async (name) =>
      (await json(`https://crates.io/api/v1/crates/${name}`)).crate
        .max_stable_version,
    issue,
  );
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  try {
    if (process.argv[2] === "npm") {
      await checkNpm();
    } else if (process.argv[2] === "cargo") {
      await checkCargo();
    } else {
      throw new Error("Usage: check-dependency-freshness.mjs npm|cargo");
    }
    console.log(
      "All direct dependencies are current or have an open issue blocker.",
    );
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}
