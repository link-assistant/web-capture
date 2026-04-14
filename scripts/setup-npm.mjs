#!/usr/bin/env node

/**
 * Update npm for OIDC trusted publishing
 * npm trusted publishing requires npm >= 11.5.1
 * Node.js 20.x ships with npm 10.x, so we need to update
 *
 * Uses link-foundation libraries:
 * - use-m: Dynamic package loading without package.json dependencies
 * - command-stream: Modern shell command execution with streaming support
 */

import { execSync } from "child_process";

// Load use-m dynamically
const { use } = eval(
  await (await fetch("https://unpkg.com/use-m/use.js")).text(),
);

// Import command-stream for shell command execution
const { $ } = await use("command-stream");

/**
 * Run a shell command synchronously and return trimmed stdout.
 * Uses child_process directly to bypass potentially broken npm.
 */
function run(cmd) {
  return execSync(cmd, { encoding: "utf-8", stdio: ["pipe", "pipe", "pipe"] }).trim();
}

try {
  // Get current npm version
  const currentVersion = run("npm --version");
  console.log(`Current npm version: ${currentVersion}`);

  const majorVersion = parseInt(currentVersion.split(".")[0], 10);

  // Check if current npm version already supports OIDC (>= 11)
  if (majorVersion >= 11) {
    console.log(
      "Current npm version already supports OIDC trusted publishing, no update needed.",
    );
  } else {
    // Update npm for OIDC trusted publishing (requires >= 11.5.1)
    // Pin to npm@11 to avoid breaking changes from future major versions
    //
    // Known issue: Node.js 22.22.2 on GitHub Actions (ubuntu-24.04 image >= 20260329.72.1)
    // ships with a broken npm 10.9.7 that is missing the 'promise-retry' module,
    // causing `npm install -g` to fail with MODULE_NOT_FOUND.
    // See: https://github.com/actions/runner-images/issues/13883
    // See: https://github.com/nodejs/node/issues/62430
    // See: https://github.com/npm/cli/issues/9151
    //
    // Workaround strategies in order of preference:
    // 1. npm install -g npm@11 (standard approach)
    // 2. Download npm tarball directly via curl and extract to global node_modules
    //    (bypasses broken npm entirely — the most reliable workaround)
    // 3. npx npm@11 install -g npm@11 (uses npx to bootstrap)
    // 4. corepack as last resort
    let updated = false;

    // Strategy 1: Standard npm install
    try {
      run("npm install -g npm@11");
      updated = true;
      console.log("Strategy 1 succeeded: npm install -g npm@11");
    } catch (updateError) {
      console.warn(`Strategy 1 failed (npm install -g): ${updateError.message}`);

      // Strategy 2: Download and install npm tarball directly with curl
      // This completely bypasses the broken npm by downloading the tarball
      // and extracting it into the global node_modules directory.
      try {
        const nodeDir = run("dirname $(dirname $(which node))");
        const globalNpmDir = `${nodeDir}/lib/node_modules/npm`;
        console.log("Strategy 2: Downloading npm@11 tarball directly...");
        run(
          `curl -sL https://registry.npmjs.org/npm/-/npm-11.4.2.tgz | ` +
          `tar xz -C /tmp && ` +
          `rm -rf "${globalNpmDir}" && ` +
          `mv /tmp/package "${globalNpmDir}"`
        );
        updated = true;
        console.log("Strategy 2 succeeded: direct tarball install");
      } catch (curlError) {
        console.warn(`Strategy 2 failed (curl tarball): ${curlError.message}`);

        // Strategy 3: Use npx to bootstrap npm@11
        try {
          run("npx --yes npm@11 install -g npm@11");
          updated = true;
          console.log("Strategy 3 succeeded: npx bootstrap");
        } catch (npxError) {
          console.warn(`Strategy 3 failed (npx): ${npxError.message}`);

          // Strategy 4: corepack
          try {
            run("corepack enable");
            run("corepack prepare npm@11 --activate");
            updated = true;
            console.log("Strategy 4 succeeded: corepack");
          } catch (corepackError) {
            console.warn(`Strategy 4 failed (corepack): ${corepackError.message}`);
          }
        }
      }
    }

    if (!updated) {
      console.error(
        `ERROR: Could not update npm to >= 11.5.1 for OIDC trusted publishing.`,
      );
      console.error(
        `Current npm version ${currentVersion} does not support OIDC.`,
      );
      console.error(
        "npm publish will likely fail. See: https://github.com/actions/runner-images/issues/13883",
      );
      process.exit(1);
    }
  }

  // Get updated npm version
  const updatedVersion = run("npm --version");
  console.log(`Updated npm version: ${updatedVersion}`);
} catch (error) {
  console.error("Error updating npm:", error.message);
  process.exit(1);
}
