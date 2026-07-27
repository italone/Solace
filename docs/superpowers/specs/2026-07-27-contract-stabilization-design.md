# Contract Stabilization Design

## Goal

Stabilize Solace's current public contract before starting larger beta work. The scope is limited to
the existing SFC/Vite surface, the existing router beta slice, and the mandatory gates that must run
for public API changes.

This design does not implement SSR, SSG, hydration, or a browser DevTools extension UI. Those remain
next-phase projects after the public SFC/Vite and router contracts are clearer.

## Context

Solace is an alpha runtime published as `@italone/solace@0.0.3`. The local repository already has:

- A compact runtime with app, reactivity, scheduler, renderer, components, store, JSX, and DevTools
  event APIs.
- An alpha `.solace` compiler and `@italone/solace/vite` plugin.
- A beta first-party router slice exported from the package root.
- Package exports for `@italone/solace`, JSX subpaths, `@italone/solace/devtools`,
  `@italone/solace/sfc`, and `@italone/solace/vite`.
- Public API gates through `release:readiness`, `package:smoke`, `test:e2e`, and the full
  `release:check` script.

The current local branch is ahead of `origin/main`; GitHub synchronization is blocked by network
connectivity to `github.com:443`, not by local code state.

## SFC And Vite Contract

The public SFC contract should remain intentionally narrow:

- `@italone/solace/vite` is the only public compiler execution entry.
- `@italone/solace/sfc` is the public TypeScript type shim for `.solace` imports.
- `.solace` files support one `<template>`, optional `<script>`, and optional `<style>` block.
- Template expressions use JSX-like braces and identifiers provided by the script block.
- Vite transform errors are the public diagnostic surface for invalid `.solace` files.
- The compiler returns `map: null` while the package policy avoids production source maps.

The following remain implementation details:

- Parser internals in `src/compiler/**`.
- Generated JavaScript module shape.
- Scoped style hashing and injection details.
- Internal AST and diagnostic object shapes.

The stabilization work should improve documentation and package-boundary tests before expanding
syntax. Syntax additions should be separate, test-first changes.

## Router Beta Contract

The router beta contract should stay limited to the first SPA slice:

- Static routes.
- Dynamic params such as `/users/:id`.
- Wildcard fallback route `/:pathMatch(.*)*`.
- Query parsing/stringifying.
- Web and hash history adapters.
- `createRouter`, `createWebHistory`, `createWebHashHistory`.
- `RouterLink`, `RouterView`.
- `useRouter`, `useRoute`.
- Root package exports and `src/router/index.ts` barrel exports.

The following remain deferred:

- Nested routes and nested `RouterView` depth.
- Route names, aliases, redirects, route meta, and navigation guards.
- Lazy route component contracts.
- Scroll behavior.
- Memory history.
- SSR, SSG, and hydration integration.
- Auth and permission routing.

Router stabilization should focus on making the existing contract predictable, documented, and
covered by package tests. It should not add route features until SSR/hydration requirements are
designed.

## Public API Gates

Public API changes must run these gates:

- `pnpm release:readiness`
- `pnpm package:smoke`
- `pnpm test:e2e`

The full release gate is:

- `pnpm release:check`

`release:check` must include release readiness, quality checks, coverage, package smoke, jsdom
benchmark smoke, Chromium production browser benchmark, and browser e2e tests. The release readiness
script should fail when mandatory release scripts or public API gates drift.

## Documentation Updates

Contract stabilization should keep these files aligned:

- `docs/api.md`
- `docs/api.zh-CN.md`
- `docs/package-usage.md`
- `docs/release.md`
- `docs/project-status.md`
- `docs/project-status.zh-CN.md`
- `docs/roadmap.md`
- `readme.md`
- `readme.zh-CN.md`

Documentation should distinguish:

- Published npm state.
- Local repository state.
- Alpha implementation surfaces.
- Beta public surfaces.
- Deferred next-phase work.

## Next Phase Boundaries

SSR, SSG, hydration, and DevTools extension UI are separate projects.

SSR/SSG/hydration should be designed first because it can affect component lifecycle, renderer
output, router history, SFC generated code, and package entries.

The browser DevTools extension UI should build on the existing `@italone/solace/devtools` low-level
API after SSR/hydration planning is underway. It should not change the runtime event contract without
its own compatibility review.

## Risks

- Expanding SFC syntax before stabilizing the current plugin contract could make generated code
  hard to support.
- Expanding router features before SSR/hydration design could create API shapes that conflict with
  future server rendering.
- Treating `release:readiness` as a replacement for `package:smoke` or `test:e2e` would miss
  package-consumer and browser behavior regressions.
- Publishing while local `main` is ahead of `origin/main` would make release provenance unclear.

## Acceptance Criteria

- SFC/Vite public contract is documented as narrow and alpha.
- Router beta scope and deferred scope are documented consistently.
- Public package entries include `@italone/solace/sfc` and `@italone/solace/vite`.
- `release:check` includes `release:readiness`.
- `release:readiness` reports and validates public API gate commands.
- Project status records the current local/remote release boundary.
- `pnpm release:readiness`, `pnpm package:smoke`, `pnpm test:e2e`, `pnpm quality`, and
  `pnpm release:check` pass before claiming contract stabilization is complete.
