# SFC Vite Diagnostics And Source Map Design

## Goal

Stabilize the current `.solace` compiler and Vite plugin contract without expanding SFC syntax or
adding plugin options. This phase should make diagnostics predictable, keep source map behavior
explicit, and strengthen package-boundary coverage for the already-public `@italone/solace/vite` and
`@italone/solace/sfc` entries.

The implementation should remain a contract hardening pass. It should not introduce a public
compiler subpath, real source map generation, custom blocks, block attributes, or new template
features.

## Context

The repository already has:

- `compile()` in `src/compiler/index.ts`, returning generated JavaScript for one `<template>`,
  optional `<script>`, and optional `<style>`.
- `SolaceCompileError`, with `name`, `code`, `filename`, `loc`, and `cause` fields.
- Parser location reporting for template parse failures.
- `@italone/solace/vite`, which exposes `solacePlugin()` and transforms bare `.solace` imports.
- Vite plugin boundary checks that reject public options and `.solace?*` query transforms.
- Vite transform results that currently return `{ code, map: null }`.
- Unit, integration, and package tests covering the narrow SFC/Vite surface.

The weak point is that diagnostics and source map policy are currently implied by implementation and
scattered tests rather than documented as a deliberate contract.

## Public Contract

The public SFC/Vite contract stays limited to:

- `@italone/solace/vite` as the public Vite plugin entry.
- `@italone/solace/sfc` as the public TypeScript shim for `.solace` imports.
- Bare `.solace` file imports only.
- One `<template>` block, optional `<script>`, and optional `<style>`.
- No public Vite plugin options.
- No query transforms such as `.solace?raw`, `.solace?type=style`, or virtual submodules.
- Vite transform results with `map: null`.

The following remain private implementation details:

- `src/compiler/**` deep imports.
- Parser AST shapes.
- Generated JavaScript module shape.
- Internal helper function names.
- Hashing strategy for style scope IDs.
- Any future source map representation.

## Diagnostics

`SolaceCompileError` remains the internal compiler error type. Its current fields should stay stable
inside the repository because Vite formatting, tests, and future compiler work depend on them:

```ts
class SolaceCompileError extends Error {
  readonly code: "SFC_PARSE_ERROR" | "SFC_CODEGEN_ERROR" | "SFC_MISSING_TEMPLATE";
  readonly filename: string | undefined;
  readonly loc:
    | {
        offset: number;
        line: number;
        column: number;
      }
    | undefined;
  readonly cause: unknown;
}
```

The Vite plugin should keep throwing ordinary `Error` instances for compiler failures so consumers
see a normal Vite transform failure. The message format should be stable:

- With location: `[SFC_PARSE_ERROR] /app/src/App.solace:4:11 Unclosed interpolation expression`
- Without location: `[SFC_MISSING_TEMPLATE] /app/src/App.solace Missing <template> block`
- Without filename: `[SFC_MISSING_TEMPLATE] unknown Missing <template> block`

This gives users a predictable message while avoiding a public compiler error class contract.

## Source Map Policy

The `.solace` Vite transform should continue returning `map: null`.

This is intentional for the current contract:

- Generated JavaScript shape is still private.
- Template and script block source mapping would require a separate design for mixed template,
  script, and style regions.
- Incorrect source maps are worse than explicit absence because they mislead debugging tools.

The documentation should call this out as the current policy. Real source map generation can be a
future beta feature, but it must be designed separately with tests for template expressions, script
line offsets, style injection, and Vite production build output.

## Implementation Plan Scope

The implementation should focus on contract tests and documentation:

- Add or tighten compiler tests for `SolaceCompileError` fields on missing templates and parse
  errors.
- Add Vite plugin tests for all three diagnostic message shapes: with location, without location,
  and unknown filename if reachable through direct transform calls.
- Keep the transform result assertion for `map: null`.
- Keep option and query-transform rejection tests.
- Update package consumer smoke coverage only if public package behavior is not already covered.
- Update English and Chinese docs to explicitly describe diagnostic formatting and source map policy.
- Update project status or roadmap only if wording is stale after implementation.

Small implementation refactors are allowed when they make the diagnostic path easier to test, but
they should not expose new public APIs.

## Out Of Scope

- Source map generation.
- Vite plugin options.
- Custom SFC blocks.
- Block attributes such as `<template lang="html">`.
- Multiple templates, scripts, or styles.
- A public `@italone/solace/compiler` package subpath.
- Runtime changes outside `.solace` compilation.
- SSR/SSG-specific SFC transforms.

## Testing

Minimum validation for the implementation:

- `pnpm vitest run tests/unit/compiler/compile.test.ts tests/unit/vite/solace-plugin.test.ts`
- `pnpm vitest run tests/integration/sfc-compiler.test.ts tests/unit/vite/public-contract-types.test.ts`
- `pnpm package:smoke`

If package exports or docs that participate in release gates change, run:

- `pnpm quality`
- `pnpm release:readiness -- --publishable`

`pnpm test:e2e` is not required for this narrow compiler diagnostic pass unless the implementation
changes generated runtime behavior.

## Risks

- Treating `SolaceCompileError` as a public package API would prematurely lock compiler internals.
- Adding source maps without a full design could produce misleading debugger locations.
- Widening Vite plugin options would imply support for syntax or build modes that are not yet
  designed.
- Updating only docs without package-boundary tests would let the SFC/Vite contract drift again.

## Acceptance Criteria

- Missing-template and parse-error diagnostics have stable tests for code, filename, location, and
  message behavior.
- Vite transform diagnostics have stable message-format tests.
- Vite transform still returns `map: null` for `.solace` files.
- Vite plugin options and `.solace?*` query transforms remain rejected.
- Documentation states that source maps are intentionally disabled for the current SFC contract.
- Documentation states that Vite diagnostic messages are the public error surface for invalid
  `.solace` files.
- No new public package entry or SFC syntax is introduced.
