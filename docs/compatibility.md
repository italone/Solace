# Compatibility And Deprecation Policy

This policy describes the public compatibility boundary for `@italone/solace`. It applies to
published package entries and documented behavior, not to private implementation details.

## Compatibility Contract

The compatibility line for this policy is `0.1.x`. This policy takes effect after at least one published `0.1.x` release. Within this line, patch releases are additive or fix-only: they may add documented APIs,
fix bugs, improve diagnostics, or clarify documentation without changing stable behavior. Breaking
removals, incompatible signature changes, and changes that require consumer rewrites are no earlier than `0.2.0`.

The package may publish beta or experimental capabilities inside the `0.1.x` line, but maturity
labels describe behavior and support expectations. Protected entries remain available without silent entry removal. Every
protected entry remains resolvable throughout the compatibility line unless the deprecation process
below has completed at a breaking boundary.

`release/public-contract.json` is the machine-readable source for entry maturity. The
`pnpm release:contract:check` gate requires every package export to appear in that manifest and
prevents stable admission while any protected entry remains beta or experimental. A passing
manifest check means the declared boundary is internally consistent; it does not mean Solace 1.0
is ready.

## Protected Package Entries

The following eight export keys and import paths are protected public package entries:

| Export key          | Import path                       | Maturity              | Scope                                                                                           |
| ------------------- | --------------------------------- | --------------------- | ----------------------------------------------------------------------------------------------- |
| `.`                 | `@italone/solace`                 | Beta                  | Core app, reactivity, rendering, components, store, and router                                  |
| `./devtools`        | `@italone/solace/devtools`        | Beta                  | Instrumentation listener and recorder APIs                                                      |
| `./jsx-dev-runtime` | `@italone/solace/jsx-dev-runtime` | Stable tooling entry  | Development JSX runtime                                                                         |
| `./jsx-runtime`     | `@italone/solace/jsx-runtime`     | Stable tooling entry  | Automatic JSX runtime                                                                           |
| `./package.json`    | `@italone/solace/package.json`    | Stable metadata entry | Package metadata consumers explicitly need                                                      |
| `./server`          | `@italone/solace/server`          | Beta                  | SSR (buffered async and sequential `renderToStream()` streaming), SSG, and static asset helpers |
| `./sfc`             | `@italone/solace/sfc`             | Experimental          | Narrow `.solace` TypeScript type shim                                                           |
| `./vite`            | `@italone/solace/vite`            | Experimental          | Narrow `.solace` Vite transform plugin                                                          |

## Frozen Public Maturity Boundary

The current beta line freezes `./jsx-runtime`, `./jsx-dev-runtime`, and `./package.json` as stable
tooling and metadata entries. The root entry, `./server`, and `./devtools` remain beta; `./sfc` and
`./vite` remain experimental. `stableAdmission` remains `false`, so this boundary does not declare
Solace 1.0 ready.

A maturity promotion requires a separate design, synchronized English and Chinese documentation,
retained package-boundary tests, a changeset, and fresh release evidence. Promotion is an explicit
compatibility decision rather than a side effect of passing the manifest checker.

## Maturity And Deferred Features

Router behavior is beta and async rendering and hydration behavior is beta. SFC and Vite support is
experimental. These maturity labels require prominent documentation, explicit deferred boundaries,
and retained tests; they are not permission to change or remove a protected export silently.

Exact error messages are compatibility-protected only when the message is explicitly documented as
part of a public contract. Otherwise, consumers should rely on the error type and documented
condition rather than incidental wording.

## Private Implementation Details

Private `src/**`, generated `dist/**`, generated layout, deep subpaths, compiler internals, scheduler
queues, VNode internals, component instances, and other implementation internals are excluded from
this policy. They may be reorganized, regenerated, or removed without a public compatibility
guarantee. Consumers must import only the eight documented export keys above.

## Deprecation Process

Before removing a protected API or changing its public signature at a breaking boundary, maintainers
must provide all of the following:

1. A visible deprecation marker on the API and in the relevant documentation. When the public API
   type can express deprecation, its TypeScript type or declaration must also include an
   `@deprecated` marker/declaration.
2. A named replacement, with a migration example showing the old and new usage.
3. A changeset and release note describing the impact and the first breaking release.
4. Retained tests covering the old boundary, the deprecation behavior, and the replacement until
   the planned removal is made.
5. At least one published `0.1.x` release containing the deprecated contract before removal at the
   breaking boundary.

Deprecation notices must identify the affected export key and import path. A `0.1.x` patch may add a
replacement or deprecation marker, but it may not remove the protected entry or introduce a breaking
signature change. Removal and incompatible signature changes wait for `0.2.0` or a later breaking
release.

## Exceptions

A severe security/correctness exception may require an earlier breaking change or entry removal.
The release must state the exception prominently, explain the affected risk, provide prominent
migration guidance and a migration example, and include the replacement, changeset, release note,
and retained tests where feasible. The exception must be limited to the smallest public surface
necessary to restore security or correctness; maturity labels and normal deprecation expectations
remain in force for all unaffected entries.
