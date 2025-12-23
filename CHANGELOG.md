# web-capture

## 1.1.3

### Patch Changes

- 5421a50: docs: add comprehensive related resources section to README

  Added a categorized collection of useful links for web capture, screenshots, and HTML to Markdown conversion. The new "Related Resources" section includes NPM packages & libraries, screenshot API services (both commercial and free), HTML to Markdown services, and alternative tools.

## 1.1.2

### Patch Changes

- a9ebb49: fix: configure scoped package name @link-assistant/web-capture for npm publishing

  Updated package.json and all release scripts to use the correct scoped npm package name `@link-assistant/web-capture` instead of the incorrectly configured `my-package` and unscoped `web-capture` names.

## 1.1.1

### Patch Changes

- 155d3a6: Add comprehensive CI/CD pipeline based on js-ai-driven-development-pipeline-template
  - Add GitHub Actions workflow for automated testing, linting, and releases
  - Integrate changesets for version management and changelog generation
  - Add ESLint, Prettier, and JSCPD for code quality checks
  - Configure lint-staged and Husky for pre-commit hooks
  - Add e2e tests that work in CI with Playwright
  - Automated npm publishing via OIDC trusted publishing
  - GitHub release generation with formatted notes
