# DevTools Public Boundary Guard Design

## Context

Solace has internal DevTools instrumentation, an event serializer, and a recorder for examples and experiments. These
helpers are intentionally internal. Before designing a public integration surface, the package export tests should lock
the current boundary so internals do not leak from the root package or an accidental `solace/devtools` subpath.

## Goals

- Assert internal DevTools helpers are not exposed from the `solace` package root.
- Assert `solace/devtools` is not an available package subpath.
- Keep `package.json` exports unchanged.
- Keep all DevTools helpers internal.

## Non-Goals

- Do not add a public DevTools API.
- Do not add a `solace/devtools` export.
- Do not change runtime instrumentation behavior.
- Do not add browser extension, inspector UI, or production build flags.

## Design

Extend `tests/integration/package-exports.test.ts`:

- Add DevTools helper names to the existing root internal-helper negative assertions.
- Add a dedicated dynamic import check that `import("solace/devtools")` rejects.

The dynamic import uses a variable subpath so TypeScript does not require a declared module for an intentionally missing
export.

## Testing

- Run `pnpm test:package` to build package artifacts and validate package exports.
- Run full quality gates because this is package boundary coverage.

## Risks

- The subpath import rejection assertion is intentionally broad; if a future public DevTools API is introduced, this test
  must be updated alongside the explicit package export design.
