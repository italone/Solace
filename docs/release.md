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

This runs format check, typecheck, JSX dev typecheck, lint, default tests, package exports tests, coverage thresholds, package consumer smoke, jsdom benchmark smoke, Chromium production browser benchmark, and browser e2e tests. The package consumer smoke includes packed ESM/CJS import checks, TypeScript consumer checks, router public API checks, and a Vite production build that transforms a `.solace` single-file component through the packed `@italone/solace/vite` plugin.

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

After that decision, run:

```bash
pnpm release:publish
```

`release:publish` runs the full local release gate before `changeset publish`.

If publishing is skipped, do not run `release:publish`, `changeset publish`, or `npm publish`.
Leave the local version state documented in `docs/project-status.md` until a maintainer makes a
separate release decision.
