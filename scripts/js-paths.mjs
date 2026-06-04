#!/usr/bin/env node

/**
 * JavaScript package path detection utility.
 * Auto-detects JS root for single-language repos (package.json in root)
 * and multi-language repos (package.json in js/ subfolder).
 *
 * Exported functions:
 *   getJsRoot(options)          → '.' or 'js'
 *   getPackageJsonPath(options) → './package.json' or 'js/package.json'
 *   getPackageLockPath(options) → './package-lock.json' or 'js/package-lock.json'
 *   getChangesetDir(options)    → './.changeset' or 'js/.changeset'
 *   getCdPrefix(options)        → '' or 'cd js && '
 *   needsCd(options)            → boolean
 *   resetCache()                → void (for testing)
 *   parseJsRootConfig()         → string|undefined
 */

import { existsSync } from 'fs';
import { join } from 'path';

let cachedJsRoot = null;

export function getJsRoot(options = {}) {
  const { jsRoot: explicitRoot, verbose = false } = options;
  if (explicitRoot !== undefined && explicitRoot !== '') {
    if (verbose)
      console.log(
        `Using explicitly configured JavaScript root: ${explicitRoot}`
      );
    return explicitRoot;
  }
  if (cachedJsRoot !== null) return cachedJsRoot;
  if (existsSync('./package.json')) {
    if (verbose)
      console.log(
        'Detected single-language repository (package.json in root)'
      );
    cachedJsRoot = '.';
    return cachedJsRoot;
  }
  if (existsSync('./js/package.json')) {
    if (verbose)
      console.log(
        'Detected multi-language repository (package.json in js/)'
      );
    cachedJsRoot = 'js';
    return cachedJsRoot;
  }
  throw new Error(
    'Could not find package.json in expected locations.\n' +
      'Searched in: ./package.json, ./js/package.json\n' +
      'Fix: run from repo root, use --js-root, or set JS_ROOT env var'
  );
}

export function getPackageJsonPath(options = {}) {
  const jsRoot =
    options.jsRoot !== undefined ? options.jsRoot : getJsRoot(options);
  return jsRoot === '.' ? './package.json' : join(jsRoot, 'package.json');
}

export function getPackageLockPath(options = {}) {
  const jsRoot =
    options.jsRoot !== undefined ? options.jsRoot : getJsRoot(options);
  return jsRoot === '.'
    ? './package-lock.json'
    : join(jsRoot, 'package-lock.json');
}

export function getChangesetDir(options = {}) {
  const jsRoot =
    options.jsRoot !== undefined ? options.jsRoot : getJsRoot(options);
  return jsRoot === '.' ? './.changeset' : join(jsRoot, '.changeset');
}

export function getCdPrefix(options = {}) {
  const jsRoot =
    options.jsRoot !== undefined ? options.jsRoot : getJsRoot(options);
  return jsRoot === '.' ? '' : `cd ${jsRoot} && `;
}

export function needsCd(options = {}) {
  const jsRoot =
    options.jsRoot !== undefined ? options.jsRoot : getJsRoot(options);
  return jsRoot !== '.';
}

export function resetCache() {
  cachedJsRoot = null;
}

export function parseJsRootConfig() {
  const args = process.argv.slice(2);
  const idx = args.indexOf('--js-root');
  if (idx >= 0 && args[idx + 1]) return args[idx + 1];
  if (process.env.JS_ROOT) return process.env.JS_ROOT;
  return undefined;
}
