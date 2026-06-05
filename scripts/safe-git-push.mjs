#!/usr/bin/env node

/**
 * Safe git push with fetch-rebase-retry semantics.
 *
 * Problem this solves:
 *   When multiple release workflows (e.g. JavaScript and Rust) run concurrently
 *   on the same push-to-main event, each may commit a version bump and push.
 *   The second push fails with `! [rejected] main -> main (non-fast-forward)`.
 *
 *   See docs/case-studies/issue-94/README.md for the original incident.
 *
 * Behavior:
 *   1. Fetch `origin <branch>`.
 *   2. If local HEAD is behind `origin/<branch>`, rebase onto it.
 *   3. Try `git push origin <branch>` up to --max-attempts times (default 5).
 *   4. Between attempts, `git pull --rebase origin <branch>` to absorb
 *      concurrent pushes; if rebase fails cleanly, abort and exit non-zero.
 *
 * Usage:
 *   node scripts/safe-git-push.mjs [--branch <name>] [--max-attempts <n>] [--verbose]
 *
 * Environment:
 *   BRANCH, MAX_ATTEMPTS, DEBUG  (mirror the CLI flags)
 *
 * Exit codes:
 *   0 on successful push, 1 on unrecoverable failure.
 */

import { appendFileSync } from "fs";

const { use } = eval(
  await (await fetch("https://unpkg.com/use-m/use.js")).text(),
);

const { $ } = await use("command-stream");
const { makeConfig } = await use("lino-arguments");

const config = makeConfig({
  yargs: ({ yargs, getenv }) =>
    yargs
      .option("branch", {
        type: "string",
        default: getenv("BRANCH", "main"),
        describe: "Branch to push",
      })
      .option("max-attempts", {
        type: "number",
        default: Number(getenv("MAX_ATTEMPTS", "5")),
        describe: "Maximum number of push attempts",
      })
      .option("verbose", {
        type: "boolean",
        default: Boolean(getenv("DEBUG", "")),
        describe: "Verbose logging",
      }),
});

const { branch, maxAttempts, verbose } = config;

function log(msg) {
  console.log(`[safe-git-push] ${msg}`);
}

function logDebug(msg) {
  if (verbose) console.log(`[safe-git-push][debug] ${msg}`);
}

function setOutput(key, value) {
  const outputFile = process.env.GITHUB_OUTPUT;
  if (outputFile) appendFileSync(outputFile, `${key}=${value}\n`);
}

async function run(cmd, args, { capture = false } = {}) {
  const result = await $`${cmd} ${args}`.run({ capture: true });
  const stdout = (result.stdout || "").trim();
  const stderr = (result.stderr || "").trim();
  if (verbose) {
    if (stdout) logDebug(`stdout: ${stdout}`);
    if (stderr) logDebug(`stderr: ${stderr}`);
    logDebug(`exit: ${result.code}`);
  }
  if (capture) return { code: result.code, stdout, stderr };
  if (result.code !== 0) {
    const err = new Error(
      `Command failed (exit ${result.code}): ${cmd} ${args.join(" ")}\n${stderr || stdout}`,
    );
    err.code = result.code;
    err.stdout = stdout;
    err.stderr = stderr;
    throw err;
  }
  return { code: 0, stdout, stderr };
}

async function main() {
  log(`Pushing to origin/${branch} (up to ${maxAttempts} attempts)`);

  if (verbose) {
    await run("git", ["remote", "-v"], { capture: true }).then((r) =>
      logDebug(`remotes:\n${r.stdout}`),
    );
    await run("git", ["rev-parse", "HEAD"], { capture: true }).then((r) =>
      logDebug(`local HEAD: ${r.stdout}`),
    );
  }

  // Pre-sync: fetch and rebase if behind.
  try {
    await run("git", ["fetch", "origin", branch]);
  } catch (err) {
    log(`Warning: initial fetch failed: ${err.message}`);
  }

  let localHead = "";
  let remoteHead = "";
  try {
    localHead = (await run("git", ["rev-parse", "HEAD"], { capture: true }))
      .stdout;
    remoteHead = (
      await run("git", ["rev-parse", `origin/${branch}`], { capture: true })
    ).stdout;
  } catch (err) {
    log(`Warning: could not resolve HEADs before push: ${err.message}`);
  }

  if (localHead && remoteHead && localHead !== remoteHead) {
    // If local is strictly behind, rebasing is safe; if diverged, rebase still
    // replays our bump commit on top of remote.
    log(
      `Local (${localHead.slice(0, 7)}) differs from origin/${branch} (${remoteHead.slice(0, 7)}); rebasing before push`,
    );
    try {
      await run("git", ["rebase", `origin/${branch}`]);
    } catch (err) {
      log(`Initial rebase failed: ${err.message}`);
      try {
        await run("git", ["rebase", "--abort"], { capture: true });
      } catch (_) {
        /* ignore */
      }
      setOutput("pushed", "false");
      process.exit(1);
    }
  }

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    log(`Push attempt ${attempt}/${maxAttempts}…`);
    const pushResult = await run("git", ["push", "origin", branch], {
      capture: true,
    });
    if (pushResult.code === 0) {
      log(`Push succeeded on attempt ${attempt}`);
      setOutput("pushed", "true");
      setOutput("attempts", String(attempt));
      process.exit(0);
    }

    const combined = `${pushResult.stdout}\n${pushResult.stderr}`.toLowerCase();
    const isNonFastForward =
      combined.includes("non-fast-forward") ||
      combined.includes("fetch first") ||
      combined.includes("updates were rejected") ||
      combined.includes("tip of your current branch is behind");

    log(
      `Push attempt ${attempt} failed (exit ${pushResult.code})${
        isNonFastForward ? " — non-fast-forward" : ""
      }`,
    );
    if (pushResult.stderr) log(`stderr: ${pushResult.stderr}`);

    if (!isNonFastForward) {
      // Auth / network / hook rejection: retrying won't help; fail fast.
      setOutput("pushed", "false");
      process.exit(pushResult.code || 1);
    }

    if (attempt === maxAttempts) break;

    log(
      `Running git pull --rebase origin ${branch} to integrate remote changes…`,
    );
    const pullResult = await run(
      "git",
      ["pull", "--rebase", "origin", branch],
      { capture: true },
    );
    if (pullResult.code !== 0) {
      log(`pull --rebase failed (exit ${pullResult.code})`);
      if (pullResult.stderr) log(`stderr: ${pullResult.stderr}`);
      try {
        await run("git", ["rebase", "--abort"], { capture: true });
      } catch (_) {
        /* ignore */
      }
      setOutput("pushed", "false");
      process.exit(1);
    }
  }

  log(`Giving up after ${maxAttempts} push attempts`);
  setOutput("pushed", "false");
  process.exit(1);
}

main().catch((err) => {
  console.error(`[safe-git-push] fatal: ${err.message}`);
  if (verbose && err.stack) console.error(err.stack);
  process.exit(1);
});
