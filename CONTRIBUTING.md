# Contributing

Thanks for contributing to Solace. This project is an early alpha TypeScript frontend runtime, so
changes should stay focused and include validation that matches the affected area.

## Before You Start

- Check the current project status in [readme.md](./readme.md).
- Read the public API boundary in [docs/api.md](./docs/api.md).
- Keep public API changes intentional and documented.
- **Public API freeze is in effect for the alpha release.** Any change to the supported public entries
  (`@italone/solace`, `@italone/solace/jsx-runtime`, `@italone/solace/jsx-dev-runtime`,
  `@italone/solace/devtools`) must include updates to the package-exports tests in
  `tests/integration/package-exports.test.ts` and the packed-consumer smoke test in
  `scripts/package-smoke-test.mjs`.
- Do not import from `src/**` or `dist/**` in consumer-facing examples.

## Development Setup

```bash
pnpm install
```

Run the default example:

```bash
pnpm dev
```

## Validation

Use the narrowest command that proves your change first, then run broader gates before opening a
pull request.

Common commands:

```bash
pnpm format:check
pnpm typecheck
pnpm typecheck:jsxdev
pnpm lint
pnpm test
pnpm build
```

Before a release-facing change, run:

```bash
pnpm release:check
```

## Pull Requests

- Keep each pull request scoped to one runtime, tooling, documentation, or benchmark concern.
- Add or update tests before changing runtime behavior.
- Update docs when public APIs, package entries, examples, or release workflows change.
- For performance work, include the benchmark command and the relevant trend summary.
- Do not commit `.benchmark-history/**`, local logs, package tarballs, or build artifacts unless a
  tracked fixture explicitly requires them.

## Release Changes

Solace uses Changesets for version notes. For user-visible changes, create a changeset:

```bash
pnpm changeset
```

The package is published publicly as `@italone/solace`. Future publishing requires an explicit
maintainer decision and the checks documented in [docs/release.md](./docs/release.md).
