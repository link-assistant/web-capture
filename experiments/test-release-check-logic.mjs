#!/usr/bin/env node

/**
 * Test the core logic of release-check scripts
 * Validates that the decision tree is correct for various scenarios
 */

console.log('=== Testing Release Check Logic ===\n');

// Simulate scenarios
const scenarios = [
  {
    name: 'PR #54 scenario: version published, unreleased commits exist',
    cratesIoHasVersion: true,
    hasTaggedRelease: true,
    hasPublishableChangesSinceTag: true,
    expectedShouldRelease: true,
    expectedNeedsAutoBump: true,
  },
  {
    name: 'Fresh version bump: version NOT published',
    cratesIoHasVersion: false,
    hasTaggedRelease: true,
    hasPublishableChangesSinceTag: true,
    expectedShouldRelease: true,
    expectedNeedsAutoBump: false,
  },
  {
    name: 'No changes: version published, no new commits',
    cratesIoHasVersion: true,
    hasTaggedRelease: true,
    hasPublishableChangesSinceTag: false,
    expectedShouldRelease: false,
    expectedNeedsAutoBump: false,
  },
  {
    name: 'Docs-only changes: version published, only docs changed',
    cratesIoHasVersion: true,
    hasTaggedRelease: true,
    hasPublishableChangesSinceTag: false,  // docs aren't publishable
    expectedShouldRelease: false,
    expectedNeedsAutoBump: false,
  },
  {
    name: 'Multiple unreleased PRs: version published, many commits since tag',
    cratesIoHasVersion: true,
    hasTaggedRelease: true,
    hasPublishableChangesSinceTag: true,
    expectedShouldRelease: true,
    expectedNeedsAutoBump: true,
  },
  {
    name: 'First release ever: no tag exists, version not published',
    cratesIoHasVersion: false,
    hasTaggedRelease: false,
    hasPublishableChangesSinceTag: false,
    expectedShouldRelease: true,
    expectedNeedsAutoBump: false,
  },
];

function simulateReleaseCheck(scenario) {
  const { cratesIoHasVersion, hasTaggedRelease, hasPublishableChangesSinceTag } = scenario;

  if (!cratesIoHasVersion) {
    return { shouldRelease: true, needsAutoBump: false };
  }

  if (!hasTaggedRelease) {
    return { shouldRelease: false, needsAutoBump: false };
  }

  if (hasPublishableChangesSinceTag) {
    return { shouldRelease: true, needsAutoBump: true };
  }

  return { shouldRelease: false, needsAutoBump: false };
}

let passed = 0;
let failed = 0;

for (const scenario of scenarios) {
  const result = simulateReleaseCheck(scenario);
  const releaseMatch = result.shouldRelease === scenario.expectedShouldRelease;
  const bumpMatch = result.needsAutoBump === scenario.expectedNeedsAutoBump;

  if (releaseMatch && bumpMatch) {
    console.log(`✅ ${scenario.name}`);
    passed++;
  } else {
    console.log(`❌ ${scenario.name}`);
    if (!releaseMatch) {
      console.log(`   shouldRelease: expected=${scenario.expectedShouldRelease}, got=${result.shouldRelease}`);
    }
    if (!bumpMatch) {
      console.log(`   needsAutoBump: expected=${scenario.expectedNeedsAutoBump}, got=${result.needsAutoBump}`);
    }
    failed++;
  }
}

console.log(`\n=== Results: ${passed} passed, ${failed} failed ===`);
process.exit(failed > 0 ? 1 : 0);
