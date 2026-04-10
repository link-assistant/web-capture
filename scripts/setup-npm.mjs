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
  // Use a fresh install approach to avoid corrupting the running npm instance
  try {
    await $`npm install -g npm@11`;
  } catch (updateError) {
    // npm global self-update can fail on some Node.js versions due to
    // module resolution issues (e.g., 'promise-retry' not found).
    // This is a known issue with in-place npm upgrades on GitHub Actions runners.
    // See: https://github.com/npm/cli/issues/4028
    console.warn(`Warning: npm update failed: ${updateError.message}`);
    console.warn('Continuing with current npm version...');
    console.warn(
      'If OIDC publishing fails, the npm version may need to be >= 11.5.1'
    );
  }

  // Get updated npm version
  const updatedResult = await $`npm --version`.run({ capture: true });
  const updatedVersion = updatedResult.stdout.trim();
  console.log(`Updated npm version: ${updatedVersion}`);
} catch (error) {
  console.error('Error updating npm:', error.message);
  process.exit(1);
}
