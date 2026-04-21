#!/usr/bin/env node

/**
 * One-shot repair for already-published GitHub releases whose bodies contain a
 * broken shields.io version-specific badge (see issue #98).
 *
 * The badge URL template is /badge/<label>-<message>-<color>, so a raw tag
 * like "js-v1.7.12" or "rust-v0.3.4" broke the URL boundaries and rendered
 * as "404: badge not found" on github.com/.../releases/tag/js-v1.7.12.
 *
 * This script walks every release in the repository, rewrites any badge URL
 * of the form
 *
 *   https://img.shields.io/badge/npm-<tag-with-dashes>-blue.svg
 *   https://img.shields.io/badge/crates.io-<tag-with-dashes>-orange.svg
 *
 * and the matching package link in the markdown link target, replacing
 * <tag-with-dashes> with the bare numeric version. It also updates the
 * release title to the [JavaScript] / [Rust] prefix format so the release
 * name unambiguously identifies the language.
 *
 * Usage:
 *   GH_TOKEN=... node scripts/fix-existing-release-badges.mjs \
 *     --repository link-assistant/web-capture [--dry-run]
 */

// Load use-m dynamically
const { use } = eval(
  await (await fetch('https://unpkg.com/use-m/use.js')).text()
);

const { $ } = await use('command-stream');
const { makeConfig } = await use('lino-arguments');

const config = makeConfig({
  yargs: ({ yargs, getenv }) =>
    yargs
      .option('repository', {
        type: 'string',
        default: getenv('REPOSITORY', ''),
        describe: 'GitHub repository (owner/repo)',
      })
      .option('dry-run', {
        type: 'boolean',
        default: false,
        describe: 'Preview changes without calling the GitHub API',
      }),
});

const { repository, dryRun } = config;

if (!repository) {
  console.error('Error: --repository is required');
  process.exit(1);
}

function normalizeVersion(raw) {
  return String(raw)
    .replace(/^[a-z]+-/i, '')
    .replace(/^v/i, '');
}

function rewriteBody(body, tag) {
  const version = normalizeVersion(tag);
  const escapedTag = tag.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  let out = body;

  // Fix the shields.io badge URL: /badge/npm-<tag>-blue.svg -> /badge/npm-<version>-blue.svg
  out = out.replace(
    new RegExp(`img\\.shields\\.io/badge/npm-${escapedTag}-blue\\.svg`, 'g'),
    `img.shields.io/badge/npm-${version}-blue.svg`
  );

  // Fix the shields.io badge URL: /badge/crates.io-<tag>-orange.svg -> .../crates.io-<version>-orange.svg
  out = out.replace(
    new RegExp(
      `img\\.shields\\.io/badge/crates\\.io-${escapedTag}-orange\\.svg`,
      'g'
    ),
    `img.shields.io/badge/crates.io-${version}-orange.svg`
  );

  // Fix the npm package link target: /package/<name>/v/<tag> -> /v/<version>
  out = out.replace(
    new RegExp(`(npmjs\\.com/package/[^)]*?/v/)${escapedTag}`, 'g'),
    `$1${version}`
  );

  return out;
}

function rewriteName(name, tag) {
  const version = normalizeVersion(tag);
  if (tag.startsWith('js-v') || /^JS v/i.test(name)) {
    return `[JavaScript] v${version}`;
  }
  if (tag.startsWith('rust-v') || /^Rust v/i.test(name)) {
    return `[Rust] v${version}`;
  }
  return name;
}

const listResult =
  await $`gh api "repos/${repository}/releases?per_page=100"`.run({
    capture: true,
    mirror: false,
  });
const releases = JSON.parse(listResult.stdout);

let touched = 0;
for (const release of releases) {
  const { id, tag_name: tag, name = '', body = '' } = release;
  const newBody = rewriteBody(body, tag);
  const newName = rewriteName(name, tag);

  if (newBody === body && newName === name) {
    continue;
  }

  touched += 1;
  console.log(
    `- ${tag}: name "${name}" -> "${newName}"${newBody !== body ? ', body patched' : ''}`
  );

  if (dryRun) {
    continue;
  }

  const payload = JSON.stringify({ name: newName, body: newBody });
  await $`gh api repos/${repository}/releases/${id} -X PATCH --input -`.run({
    stdin: payload,
  });
}

console.log(
  dryRun
    ? `Dry run: ${touched} release(s) would be updated.`
    : `Updated ${touched} release(s).`
);
