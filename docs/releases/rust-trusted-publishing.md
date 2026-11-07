# Rust trusted publishing

Both Rust publish paths live in `.github/workflows/rust.yml`. Register this caller
workflow, with repository owner `link-assistant`, repository `web-capture`, workflow
filename `rust.yml`, and no environment. Both automatic pushes and manual instant
releases publish only from `main`, after lint, tests, build, fresh consumer resolution
(via build), and dependency health pass. Changelog PR mode continues to create a
version PR without publishing.

The release jobs build after versioning and before requesting the short-lived token.
Authentication errors are allowed so publishing can use, in order:

1. The crates.io authentication action's OIDC token.
2. The `CARGO_REGISTRY_TOKEN` secret.
3. The legacy `CARGO_TOKEN` secret.

Keep the fallback secrets. Cargo receives the selected credential in its environment,
not command arguments. A GitHub release is created only when publishing succeeds
(including an already-published version). The pinned authentication action revokes
its temporary token in its post step.

GitHub releases target the checked-out HEAD after any version commit and rebase,
so their tags identify the version actually published rather than the original
workflow trigger commit.

## Verification

Run `npm ci` followed by `node --test tests/tools/rust-trusted-publishing.test.mjs`.
These checks validate workflow gates/order and run the real publishing script with
mocked Cargo and registry responses, verifying environment delivery, legacy fallback,
missing credentials, and credential redaction. They do not publish a crate.

Before the changes, the regression test fails for the manual branch/build gates and
because the token is passed in command arguments. After the changes it passes.
The existing Dependency Security and Tooling workflow runs these tests via `npm test`.

For live verification after registration and deployment to main, inspect a Rust
release run: authentication must succeed, `Publish to crates.io` must report
`publish_result=success` for a new version, and the GitHub release must succeed.
A successful publish after a failed authentication step demonstrates the secret
fallback, not OIDC. Record the run URL as evidence. Do not publish from a PR merely
to test authentication.

## External configuration status

As of 2026-11-07, this workspace has no `setup --migrate` implementation, executable,
or migration configuration and no authenticated crates.io owner session. The
crates.io publisher endpoint returned HTTP 403. GitHub reports no linked issue on
PR #180. Therefore publisher registration/migration and a live OIDC release are
unverified and remain external blockers; local tests and PR CI cannot establish
those criteria. No secrets have been deleted.

See the [crates.io setup instructions](https://crates.io/docs/trusted-publishing)
and [authentication action](https://github.com/rust-lang/crates-io-auth-action).
