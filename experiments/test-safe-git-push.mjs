#!/usr/bin/env node

/**
 * Reproducible test for `scripts/safe-git-push.mjs` (issue #94).
 *
 * Simulates the race that broke the Rust release workflow:
 *   1. Create a bare "origin" repo with a single commit on main.
 *   2. Clone it twice — A and B — simulating two concurrent release workflows.
 *   3. Each clone commits a different change.
 *   4. Clone A pushes first (wins).
 *   5. Clone B runs `scripts/safe-git-push.mjs --branch main`.
 *
 * Expected: Clone B detects non-fast-forward, rebases, and pushes successfully.
 * Control:  Verify that a raw `git push origin main` in Clone B fails with
 *           "non-fast-forward", exactly as in the broken CI run.
 *
 * Usage:    node experiments/test-safe-git-push.mjs [--keep]
 *           --keep: leave the sandbox on disk for inspection
 */

import { execSync } from "node:child_process";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const REPO_ROOT = join(__dirname, "..");

const keep = process.argv.includes("--keep");

function sh(cmd, opts = {}) {
  return execSync(cmd, {
    stdio: ["ignore", "pipe", "pipe"],
    encoding: "utf8",
    shell: "/bin/sh",
    ...opts,
  });
}

function tryPush(dir) {
  try {
    sh("git push origin main", { cwd: dir });
    return { ok: true };
  } catch (err) {
    return {
      ok: false,
      stderr: (err.stderr || "").toString(),
      stdout: (err.stdout || "").toString(),
    };
  }
}

const sandbox = mkdtempSync(join(tmpdir(), "safe-git-push-"));
console.log(`Sandbox: ${sandbox}`);

try {
  const origin = join(sandbox, "origin.git");
  const seed = join(sandbox, "seed");
  const cloneA = join(sandbox, "clone-a");
  const cloneB = join(sandbox, "clone-b");
  const cloneControl = join(sandbox, "clone-control");

  // --- Build bare origin with a single main commit ---
  mkdirSync(origin);
  sh("git init --bare --initial-branch=main", { cwd: origin });
  mkdirSync(seed);
  sh("git init --initial-branch=main", { cwd: seed });
  sh(`git remote add origin ${origin}`, { cwd: seed });
  writeFileSync(join(seed, "README.md"), "# test repo\n");
  sh("git add README.md", { cwd: seed });
  sh('git -c user.email=t@t -c user.name=test commit -m "initial"', {
    cwd: seed,
  });
  sh("git push -u origin main", { cwd: seed });

  // --- Clone A and Clone B simulate two release workflows ---
  sh(`git clone ${origin} ${cloneA}`);
  sh(`git clone ${origin} ${cloneB}`);
  sh(`git clone ${origin} ${cloneControl}`);

  for (const c of [cloneA, cloneB, cloneControl]) {
    sh("git config user.email t@t", { cwd: c });
    sh("git config user.name tester", { cwd: c });
  }

  writeFileSync(join(cloneA, "a.txt"), "a\n");
  sh('git add a.txt && git commit -m "A bump"', {
    cwd: cloneA,
    shell: "/bin/sh",
  });
  writeFileSync(join(cloneB, "b.txt"), "b\n");
  sh('git add b.txt && git commit -m "B bump"', {
    cwd: cloneB,
    shell: "/bin/sh",
  });
  writeFileSync(join(cloneControl, "b.txt"), "b\n");
  sh('git add b.txt && git commit -m "B bump (control)"', {
    cwd: cloneControl,
    shell: "/bin/sh",
  });

  // --- A wins the race ---
  sh("git push origin main", { cwd: cloneA });
  console.log("A pushed OK");

  // --- Control: raw `git push` from B should fail with non-fast-forward ---
  const raw = tryPush(cloneControl);
  if (raw.ok) {
    console.error("FAIL: raw push from control clone unexpectedly succeeded");
    process.exit(1);
  }
  const rawStderr = (raw.stderr || "").toLowerCase();
  if (
    !rawStderr.includes("non-fast-forward") &&
    !rawStderr.includes("fetch first") &&
    !rawStderr.includes("updates were rejected")
  ) {
    console.error(
      "FAIL: raw push from control clone failed for the wrong reason:",
    );
    console.error(raw.stderr);
    process.exit(1);
  }
  console.log("Control reproduced the non-fast-forward rejection as expected.");

  // --- Under test: safe-git-push.mjs should recover via fetch-rebase-retry ---
  const scriptPath = join(REPO_ROOT, "scripts", "safe-git-push.mjs");
  sh(`node ${scriptPath} --branch main --verbose`, {
    cwd: cloneB,
    stdio: "inherit",
  });

  // --- Verify origin now has A's and B's commits ---
  const log = sh("git log --oneline origin/main", {
    cwd: cloneA + "",
  }).toString();
  console.log("\nFinal origin/main log (from A after fetch):");
  sh("git -C " + cloneA + " fetch origin");
  const finalLog = sh("git log --oneline origin/main", { cwd: cloneA });
  console.log(finalLog);
  if (!/A bump/.test(finalLog) || !/B bump/.test(finalLog)) {
    console.error("FAIL: expected both A and B commits on origin/main");
    process.exit(1);
  }
  console.log("PASS: safe-git-push.mjs recovered from the race.");
} finally {
  if (!keep) {
    rmSync(sandbox, { recursive: true, force: true });
  } else {
    console.log(`(kept sandbox at ${sandbox})`);
  }
}
