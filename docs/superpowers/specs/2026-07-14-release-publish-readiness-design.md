# Release Publish Readiness Design

## Context

Solace already has a release toolchain:

- `changeset`, `release:version`, and `release:publish` scripts exist.
- `.changeset/config.json` uses public npm access.
- `pnpm release:check` runs quality, coverage, package smoke, benchmarks, and e2e checks.
- `docs/release.md` and `docs/package-usage.md` both state that `package.json` currently keeps
  `"private": true`.

The remaining release risk is not build mechanics. The unresolved decision is whether and when the
package should become publishable. Removing `"private": true` without documenting npm access, package
name ownership, and release checklist would make accidental publishing easier.

## Goal

Make release readiness explicit without publishing and without removing `"private": true`.

The next increment should:

- document the exact decision gate for making the package publishable,
- add a local dry-run/readiness command that never publishes,
- keep the current package private until a human explicitly changes the publish policy,
- align README, release docs, package usage docs, and project logs.

## Recommended Approach

Add a small Node-based readiness script and document it:

- `scripts/release-readiness-check.mjs` reads `package.json` and `.changeset/config.json`.
- The script verifies package metadata that can be checked locally:
  - package name and version are present,
  - `main`, `module`, `types`, `exports`, and `files` exist,
  - Changesets access is `public`,
  - release scripts are present,
  - package remains private unless an explicit publish mode flag is passed.
- Add `release:readiness` to `package.json`.
- Document that this command is a local readiness check, not a registry availability or permission
  check.

This gives maintainers a repeatable preflight check while preserving the current non-publishable
state.

## Publish Policy

Keep `"private": true` by default.

Before removing or changing it, a maintainer must explicitly confirm:

- the npm package name `solace` is available or controlled by the maintainer,
- npm authentication and organization access are configured,
- the intended access is public,
- `pnpm release:check` passes,
- `pnpm package:smoke` passes after the final version update,
- Changesets versioning has been run for user-visible changes.

The readiness script should fail in publish mode if `"private": true` is still set. In default mode,
it should report that the package is intentionally private and skip publishability approval.

## Script Behavior

Add a command:

```bash
pnpm release:readiness
```

Default mode:

- Exits 0 when local release metadata is coherent.
- Prints a concise summary.
- Explicitly says the package is private and not publishable yet.

Optional publish mode:

```bash
pnpm release:readiness -- --publishable
```

Publishable mode:

- Exits non-zero while `"private": true` remains set.
- Exits 0 only if local metadata is coherent and the package is not private.
- Still does not contact npm and does not publish.

## Documentation

Update:

- `docs/release.md` with the release readiness command and publish decision checklist.
- `docs/package-usage.md` with a pointer to the readiness command before registry install claims.
- `readme.md` future recommendations to replace the generic publish strategy bullet with a more
  concrete readiness gate.

## Validation

Use scoped validation:

- `pnpm release:readiness`
- `pnpm release:readiness -- --publishable` should fail while the package remains private.
- `pnpm typecheck`
- `pnpm lint`
- `pnpm format:check`

Run `pnpm release:check` only if release scripts or package exports behavior changes beyond this
readiness check.

## Non-Goals

- Do not remove `"private": true`.
- Do not run `changeset publish`.
- Do not contact the npm registry.
- Do not reserve or claim package names.
- Do not change package version.
- Do not add CI release automation.
