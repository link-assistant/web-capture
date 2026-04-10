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

// Load use-m dynamically
const { use } = eval(
  await (await fetch('https://unpkg.com/use-m/use.js')).text()
);

// Import command-stream for shell command execution
const { $ } = await use('command-stream');

try {
  // Get current npm version
  const currentResult = await $`npm --version`.run({ capture: true });
  const currentVersion = currentResult.stdout.trim();
  console.log(`Current npm version: ${currentVersion}`);

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
  // Workaround: try corepack as a fallback when npm self-update fails.
  let updated = false;
  try {
    await $`npm install -g npm@11`;
    updated = true;
  } catch (updateError) {
    console.warn(`Warning: npm install -g failed: ${updateError.message}`);
    console.warn(
      'This is likely the Node.js 22.22.2 broken npm issue (actions/runner-images#13883).'
    );
    console.warn('Trying corepack as fallback...');

    try {
      await $`corepack enable`;
      await $`corepack prepare npm@11 --activate`;
      updated = true;
    } catch (corepackError) {
      console.warn(`Warning: corepack fallback also failed: ${corepackError.message}`);
      console.warn('Continuing with current npm version...');
      console.warn(
        'If OIDC publishing fails, the npm version may need to be >= 11.5.1'
      );
    }
  }

  // Get updated npm version
  const updatedResult = await $`npm --version`.run({ capture: true });
  const updatedVersion = updatedResult.stdout.trim();
  console.log(`Updated npm version: ${updatedVersion}`);
} catch (error) {
  console.error('Error updating npm:', error.message);
  process.exit(1);
}
