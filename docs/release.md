# Release

Solace uses Changesets for version notes and package version updates.

Release readiness and publishing are separate states. The repository can contain a prepared local
version, documentation updates, or changelog entries that have not been pushed to GitHub or
published to npm. Use [project-status.md](./project-status.md) to record that boundary when
publishing is intentionally skipped.

## Local Release Gate

Run the full local gate before preparing a release:

```bash
pnpm release:check
```

This runs release readiness, format check, typecheck, JSX dev typecheck, lint, default tests,
package exports tests, coverage thresholds, package consumer smoke, jsdom benchmark smoke, Chromium
production browser benchmark, and browser e2e tests. The package consumer smoke includes packed
ESM/CJS import checks, TypeScript consumer checks, router public API checks, and a Vite production
build that transforms a `.solace` single-file component through the packed `@italone/solace/vite`
plugin.

For public API changes, `pnpm release:readiness`, `pnpm package:smoke`, and `pnpm test:e2e` are
mandatory gates. `pnpm release:check` includes them so release preparation and package-boundary
drift are checked together.

The GitHub Actions CI workflow keeps these checks split into named steps and also runs both benchmark commands: `pnpm benchmark` and `pnpm benchmark:browser`.

CI also runs `pnpm release:readiness` before the longer checks so package metadata and release script drift fail early.

## Release Readiness

Run the local metadata readiness check before publishing:

```bash
pnpm release:readiness
```

This command checks local package metadata, package entry points, release scripts, and Changesets public access configuration. It does not contact npm and does not publish.

The package is configured for public npm publishing. Verify the stricter publishable mode before
each release:

```bash
pnpm release:readiness -- --publishable
```

Publishable mode also checks the local Git state. It fails when the branch is ahead of or behind
its upstream, when no upstream is configured, or when the working tree is dirty. Use
`pnpm release:readiness -- --publishable --skip-git-check` only for metadata-only audits where a
maintainer has explicitly decided not to publish from the current checkout.

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
- the local branch is synchronized with its upstream and the worktree is clean,
- `pnpm release:check` passes,
- `pnpm package:smoke` passes after the final version update,
- Changesets versioning has been run for user-visible changes.

For beta prereleases, publish with the `beta` npm dist-tag so `latest` continues to point at the
latest stable public release:

```bash
pnpm release:publish:beta
```

After a maintainer decides the current version should become the default npm release, run:

```bash
pnpm release:publish
```

`release:publish:beta` and `release:publish` both run the full local release gate before
`changeset publish`. `release:publish:beta` passes `--tag beta`; `release:publish` uses Changesets'
default npm tag behavior.

If publishing is skipped, do not run `release:publish:beta`, `release:publish`, `changeset publish`,
or `npm publish`. Leave the local version state documented in `docs/project-status.md` until a
maintainer makes a separate release decision.
