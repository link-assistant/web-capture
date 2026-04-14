#!/usr/bin/env node

/**
 * Publish to npm using OIDC trusted publishing
 * Usage: node scripts/publish-to-npm.mjs [--should-pull]
 *   should_pull: Optional flag to pull latest changes before publishing (for release job)
 *
 * IMPORTANT: Update the PACKAGE_NAME constant below to match your package.json
 *
 * Uses link-foundation libraries:
 * - use-m: Dynamic package loading without package.json dependencies
 * - command-stream: Modern shell command execution with streaming support
 * - lino-arguments: Unified configuration from CLI args, env vars, and .lenv files
 */

import { readFileSync, appendFileSync } from 'fs';

const PACKAGE_NAME = '@link-assistant/web-capture';

// Load use-m dynamically
const { use } = eval(
  await (await fetch('https://unpkg.com/use-m/use.js')).text()
);

// Import link-foundation libraries
const { $ } = await use('command-stream');
const { makeConfig } = await use('lino-arguments');

// Parse CLI arguments using lino-arguments
const config = makeConfig({
  yargs: ({ yargs, getenv }) =>
    yargs.option('should-pull', {
      type: 'boolean',
      default: getenv('SHOULD_PULL', false),
      describe: 'Pull latest changes before publishing',
    }),
});

const { shouldPull } = config;
const MAX_RETRIES = 3;
const RETRY_DELAY = 10000; // 10 seconds

/**
 * Sleep for specified milliseconds
 * @param {number} ms
 */
function sleep(ms) {
  return new Promise((resolve) => globalThis.setTimeout(resolve, ms));
}

/**
 * Append to GitHub Actions output file
 * @param {string} key
 * @param {string} value
 */
function setOutput(key, value) {
  const outputFile = process.env.GITHUB_OUTPUT;
  if (outputFile) {
    appendFileSync(outputFile, `${key}=${value}\n`);
  }
}

async function main() {
  try {
    if (shouldPull) {
      // Pull the latest changes we just pushed
      await $`git pull origin main`;
    }

    // Get current version
    const packageJson = JSON.parse(readFileSync('./package.json', 'utf8'));
    const currentVersion = packageJson.version;
    console.log(`Current version to publish: ${currentVersion}`);

    // Check if this version is already published on npm
    console.log(
      `Checking if version ${currentVersion} is already published...`
    );
    const checkResult =
      await $`npm view "${PACKAGE_NAME}@${currentVersion}" version`.run({
        capture: true,
      });

    // command-stream returns { code: 0 } on success, { code: 1 } on failure (e.g., E404)
    // Exit code 0 means version exists, non-zero means version not found
    if (checkResult.code === 0) {
      console.log(`Version ${currentVersion} is already published to npm`);
      setOutput('published', 'true');
      setOutput('published_version', currentVersion);
      setOutput('already_published', 'true');
      return;
    } else {
      // Version not found on npm (E404), proceed with publish
      console.log(
        `Version ${currentVersion} not found on npm, proceeding with publish...`
      );
    }

    // Publish to npm with retry logic using OIDC trusted publishing
    for (let i = 1; i <= MAX_RETRIES; i++) {
      console.log(`Publish attempt ${i} of ${MAX_RETRIES}...`);
      try {
        console.log('Publishing with OIDC trusted publishing...');
        console.log(`Node.js version: ${process.version}`);
        const npmVersionResult = await $`npm --version`.run({ capture: true });
        console.log(`npm version: ${(npmVersionResult.stdout || '').trim()}`);
        const publishResult = await $`npm publish --provenance --access public --verbose`.run({
          capture: true,
        });

        const combinedOutput = `${publishResult.stdout || ''}\n${publishResult.stderr || ''}`;

        // Detect 404 errors indicating the package doesn't exist on npm yet
        // (first-time publish requires manual setup of the package on npmjs.org)
        if (publishResult.code !== 0) {
          console.error(`\nnpm publish exited with code ${publishResult.code}`);
          console.error(`--- stdout ---\n${publishResult.stdout || '(empty)'}`);
          console.error(`--- stderr ---\n${publishResult.stderr || '(empty)'}`);
        }

        // Check for OIDC token exchange failure in verbose output
        const oidcTokenFailed = combinedOutput.includes('oidc Failed token exchange') ||
          combinedOutput.includes('OIDC token exchange error');
        const oidcTokenSucceeded = combinedOutput.includes('oidc Successfully retrieved and set token');

        if (oidcTokenFailed) {
          console.error(`\n\u274C OIDC token exchange failed. This usually means the trusted publisher configuration on npmjs.org does not match the workflow.`);
          console.error(`Check: repository name, workflow filename, and environment must match exactly (case-sensitive).`);
          console.error(`See: https://docs.npmjs.com/trusted-publishers#troubleshooting\n`);
        }
        if (publishResult.code === 0 && !oidcTokenSucceeded && !oidcTokenFailed) {
          console.log('Note: OIDC token exchange status not detected in output. Publish may have used fallback authentication.');
        }

        if (
          publishResult.code !== 0 &&
          (combinedOutput.includes('E404') ||
            combinedOutput.includes('Not Found') ||
            combinedOutput.includes('is not in this registry'))
        ) {
          if (oidcTokenFailed) {
            console.error(`\n\u274C OIDC token exchange failed with 404 for ${PACKAGE_NAME}.`);
            console.error(`The OIDC handshake was rejected by the npm registry. This is NOT a "package not found" error.`);
            console.error(`\nCommon causes:`);
            console.error(`  - Node.js version too old (use Node 24+, not 22 or 20)`);
            console.error(`  - Trusted publisher config mismatch (repo name, workflow filename, environment)`);
            console.error(`  - .npmrc file interfering with OIDC (check NPM_CONFIG_USERCONFIG)\n`);
            process.exit(1);
          }

          console.error(`\n\u274C OIDC trusted publishing failed with 404 for ${PACKAGE_NAME}.`);
          console.error(`\nThe first version of a package must be published manually to establish the package on the registry.`);
          console.error(`After manual publish, configure OIDC trusted publishing on npmjs.org for automated CI/CD releases.\n`);
          console.error(`To publish manually, run these commands locally:\n`);
          console.error(`  1. Log in to npm:`);
          console.error(`     npm login`);
          console.error(`  2. Navigate to the JS package directory:`);
          console.error(`     cd js`);
          console.error(`  3. Publish the package:`);
          console.error(`     npm publish --access public`);
          console.error(`  4. Configure OIDC trusted publishing on npmjs.org:`);
          console.error(`     - Go to https://www.npmjs.com/package/${PACKAGE_NAME}/access`);
          console.error(`     - Under "Publishing access", add a trusted publisher`);
          console.error(`     - Set repository to: ${process.env.GITHUB_REPOSITORY || 'link-assistant/web-capture'}`);
          console.error(`     - Set workflow to: js.yml`);
          console.error(`     - Set environment to: (leave empty or set to your environment name)\n`);
          process.exit(1);
        }

        if (publishResult.code !== 0) {
          throw new Error(`npm publish failed with exit code ${publishResult.code}: ${combinedOutput}`);
        }

        // Verify the version was actually published
        console.log('Verifying publish...');
        await sleep(5000);
        const verifyResult =
          await $`npm view "${PACKAGE_NAME}@${currentVersion}" version`.run({
            capture: true,
          });
        if (verifyResult.code !== 0) {
          throw new Error(
            `Publish verification failed: version ${currentVersion} not found on npm after publish`
          );
        }

        setOutput('published', 'true');
        setOutput('published_version', currentVersion);
        console.log(
          `\u2705 Published ${PACKAGE_NAME}@${currentVersion} to npm`
        );
        return;
      } catch (error) {
        if (i < MAX_RETRIES) {
          console.log(
            `Publish failed: ${error.message}, waiting ${RETRY_DELAY / 1000}s before retry...`
          );
          await sleep(RETRY_DELAY);
        }
      }
    }

    console.error(`\u274C Failed to publish after ${MAX_RETRIES} attempts`);
    process.exit(1);
  } catch (error) {
    console.error('Error:', error.message);
    process.exit(1);
  }
}

main();
