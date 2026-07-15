# DevTools Public API Lifecycle Design

## Context

Solace now exposes `solace/devtools` as a public package subpath and has a production artifact guard that prevents
JavaScript sourcemaps from publishing internal DevTools wiring. The remaining gap in `docs/devtools.md` is the public
API lifecycle: the document names the lifecycle, but it does not define how new DevTools exports, payload changes, or
removals should be handled.

Current package boundary tests verify that `createDevtoolsRecorder()` and `onDevtoolsEvent()` are available and that a
small set of internal helpers is absent. They do not lock the runtime export list exactly, so a future accidental export
could become public without a deliberate review.

## Goals

- Document the lifecycle policy for the `solace/devtools` public API.
- Lock the runtime DevTools public subpath to the exact intended JavaScript exports.
- Keep type-only exports available while preventing internal runtime helpers from becoming JavaScript exports.
- Preserve the existing production-build boundary: no JavaScript sourcemaps and no raw runtime objects in payloads.

## Non-Goals

- Do not add new DevTools runtime APIs.
- Do not change `DevtoolsEvent` payload shapes.
- Do not add a browser extension, inspector UI, transport, persistence, analytics, or telemetry.
- Do not change package versioning or Changesets behavior in this step.

## Design

Add a `## Public API Lifecycle` section to `docs/devtools.md` after the `## Public API` section. The section will state:

- `solace/devtools` is the only supported public DevTools entry point.
- New runtime exports require package boundary tests, packed consumer smoke coverage, documentation, and project log
  entries.
- Event payload additions must be small, serializable summaries and must update payload stability coverage.
- Renames/removals require an intentional breaking-change plan; they should not happen as incidental internal cleanup.
- Internal helpers remain private even if they are used by public APIs internally.

Update `tests/integration/package-exports.test.ts` so the DevTools public subpath assertion checks the exact JavaScript
export keys:

```ts
expect(Object.keys(devtools).sort()).toEqual(["createDevtoolsRecorder", "onDevtoolsEvent"]);
```

This complements the existing negative helper assertions and turns accidental public runtime exports into a failing
package boundary test.

Add a focused docs contract test in `tests/unit/devtools/devtools-docs.test.ts` that reads `docs/devtools.md` and checks
for the lifecycle section and its required policy phrases. This creates a RED test before the documentation is updated.

## Validation

- `pnpm test -- tests/unit/devtools/devtools-docs.test.ts`
- `pnpm test:package`
- `pnpm test`
- `pnpm typecheck`
- `pnpm lint`
- `pnpm build`
- `pnpm format:check`
