# @italone/solace

## Unreleased / 0.1.0-beta.6 candidate

### Patch Changes

- Harden the 1.0 evidence checklist and add a machine-readable public contract gate without
  promoting beta or experimental entries to stable.
- Add deterministic browser and jsdom performance regression budgets with distinct-run/date checks.
- Extract Router contract validation and keyed sequence helpers while preserving runtime behavior.

## 0.1.0-beta.5

### Patch Changes

- Add opt-in typed component emit, inferred JSX listener, and typed component slot contracts while
  preserving permissive legacy components and the existing runtime payload.
- Validate release candidates against both the long-term `0.1.0-beta.2` Operations Console
  baseline and the latest published `0.1.0-beta.4` baseline.
- Add independent packed CSR and SSR/hydration adoption checks and executable `1.0` admission
  evidence.
- Add composable router-aware SSR/hydration through `router.isReady()`, canonical snapshots, and
  `createRouterServerContext()` while keeping streaming and direct renderer-owned router options
  deferred.

## 0.1.0-beta.4

### Patch Changes

- Freeze the additive buffered async SSR, sequential async SSG, and prepare-then-commit async
  hydration contract while preserving synchronous API return types and explicit deferred boundaries
  for streaming and router-aware SSR/hydration.
- Protect the eight documented package entries through the `0.1.x` compatibility and deprecation
  policy, and validate the packed candidate against the exact published `0.1.0-beta.2` Operations
  Console baseline.

## 0.1.0-beta.2

### Patch Changes

- Stabilize the beta router contract for route names, aliases, route props, named locations, and
  `createMemoryHistory()` while keeping scroll behavior, auth, permissions, and router-aware
  SSR/SSG/hydration deferred.
- Define the JSX/TSX-first public runtime contract with automatic JSX runtime type guards and packed
  consumer coverage for the root, JSX runtime, server, Vite, SFC, and DevTools public entries.
- Harden the synchronous SSR and hydration boundary by explicitly rejecting deferred streaming
  hydration options and documenting the unsupported async and router-aware integrations.
- Add browser DevTools extension E2E coverage for the public event relay, timeline filtering,
  pause/resume behavior, and clear controls.

## 0.1.0-beta.1

### Patch Changes

- Refresh the beta package documentation so published tarballs describe the npm `beta` install line,
  npm `latest` boundary, and narrow SFC/Vite compatibility contract without treating the beta state
  as local-only.

## 0.1.0-beta.0

### Patch Changes

- Move the repository onto the beta line while keeping compatibility promises limited to documented public entries.

## 0.0.5

### Patch Changes

- Add a DevTools browser extension panel workflow with timeline filtering, pause/resume controls, sanitized public event relay, and extension e2e coverage.

## 0.0.4

### Patch Changes

- 8c1f4d7: Batch consecutive moved keyed children into DocumentFragment inserts and expand public readiness documentation.
- Harden public SFC/Vite, router, SSR, SSG, and hydration boundaries with explicit runtime rejections
  for deferred or malformed inputs.

## 0.0.3 — 2026-07-24

### Patch Changes

- Alpha runtime release.
- Reactive core, renderer, components, scheduler, store, JSX runtime, and DevTools API.
- Full test coverage and release gates passing.
- Align package usage and release documentation with the published public alpha package state.

## 0.0.2

### Patch Changes

- Prepare the public alpha package for npm publishing with README documentation alignment and publishable package metadata.

## 0.0.1

### Patch Changes

- ee2d9cd: Prepare the initial alpha runtime with reactivity, renderer, components, events, store, JSX runtime, package exports, examples, documentation, e2e coverage, and benchmark smoke tests.
- 913c156: Improve renderer performance and benchmark trend tooling with Fragment element batch mounts, element child array batch mounts, text-to-array child batch mounts, unkeyed append suffix batching, safe removed leaf suffix batching, stable child component update skips, unchanged keyed element patch skips, direct keyed mixed insert mounts, contiguous keyed insert segment batching, adjacent new keyed run batching, adjacent old keyed run batching during mixed placement, browser benchmark sample-size configuration, benchmark history summaries, an opt-in browser history minimum-count gate, latest browser history window summaries, and documented local browser benchmark trend results.
