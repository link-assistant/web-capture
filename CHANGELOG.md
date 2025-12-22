# web-capture

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
