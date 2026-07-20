# Release

Solace uses Changesets for version notes and package version updates.

## Local Release Gate

Run the full local gate before preparing a release:

```bash
pnpm release:check
```

This runs format check, typecheck, JSX dev typecheck, lint, default tests, package exports tests, coverage thresholds, package consumer smoke, jsdom benchmark smoke, Chromium production browser benchmark, and browser e2e tests.

The GitHub Actions CI workflow keeps these checks split into named steps and also runs both benchmark commands: `pnpm benchmark` and `pnpm benchmark:browser`.

CI also runs `pnpm release:readiness` before the longer checks so package metadata and release script drift fail early.

## Release Readiness

Run the local metadata readiness check before changing publishability:

```bash
pnpm release:readiness
```

This command checks local package metadata, package entry points, release scripts, and Changesets public access configuration. It does not contact npm and does not publish.

The package is now publishable. To verify the stricter publishable mode before publishing, run:

```bash
pnpm release:readiness -- --publishable
```

## Prepare A Version

Create a changeset for user-visible changes:

```bash
pnpm changeset
```

Apply pending changesets to `package.json` and changelog files:

```bash
pnpm release:version
```

## Publish

Before publishing, explicitly confirm:

- the npm package name `@italone/solace` is available or controlled by the maintainer,
- npm authentication and organization access are configured,
- public access is intended,
- `pnpm release:readiness -- --publishable` passes,
- `pnpm release:check` passes,
- `pnpm package:smoke` passes after the final version update,
- Changesets versioning has been run for user-visible changes.

After that decision, run:

```bash
pnpm release:publish
```

`release:publish` runs the full local release gate before `changeset publish`.
