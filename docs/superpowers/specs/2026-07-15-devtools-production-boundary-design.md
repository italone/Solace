# DevTools Production Boundary Design

## Goal

Turn the DevTools production-build boundary from a documentation rule into a package test guard.

## Boundary

The public `solace/devtools` subpath remains available in production builds. It exposes only listener and recorder APIs:

- `createDevtoolsRecorder`
- `onDevtoolsEvent`
- DevTools event and recorder types

Internal emit, listener-state, cleanup, and serializer helpers remain private implementation details. Package exports already
block direct imports of those helpers, but published sourcemaps can still reveal source-level helper names and internal
module structure.

## Production Artifacts

Rollup production output should not emit `.map` files for the library package. The package is source-public in the
repository, but published production artifacts should avoid carrying source maps that expose internal runtime wiring or
invite consumers to depend on private module names.

This applies to all JavaScript build entries:

- `dist/index.js`
- `dist/index.cjs`
- `dist/jsx-runtime.js`
- `dist/jsx-runtime.cjs`
- `dist/jsx-dev-runtime.js`
- `dist/jsx-dev-runtime.cjs`
- `dist/devtools.js`
- `dist/devtools.cjs`
- shared Rollup chunks

Declaration files remain published because they are the stable public type contract. Declaration output must not export
internal DevTools helper names from `dist/devtools.d.ts`.

## Test Strategy

Extend `tests/integration/package-exports.test.ts` under the existing `pnpm test:package` path. That command already runs
`pnpm build` first, so the test can inspect real production artifacts.

The new test should fail before the Rollup change by finding `.map` files in `dist`. After the fix, it should pass and
prove production package artifacts no longer include source maps.

Keep existing ESM and CommonJS import-shape tests. They remain the API boundary guard for `solace` and `solace/devtools`.

## Documentation

Update `docs/devtools.md` to state that production package builds do not publish sourcemaps and that internals remain
source-level implementation details. The docs should not promise a DevTools UI or browser extension.

## Validation

Required validation:

- `pnpm test:package`
- `pnpm build`
- `pnpm typecheck`
- `pnpm lint`
- `pnpm test`
- `pnpm format:check`
