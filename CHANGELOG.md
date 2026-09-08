# @italone/solace

## 0.1.0-beta.9

### Patch Changes

- 77c9d46: Keep the out-of-order SSR stream open when a successfully loaded boundary subtree fails to render: the boundary now keeps its fallback and emits a failure comment (same semantics as loader rejections) instead of erroring the whole stream after partial HTML.
- 929396a: Add an opt-in `timeoutMs` option to `renderToStringAsync()`, `renderToStream()`, and `generateStaticSiteAsync()` (site-level with route-level override) so never-settling async renders reject with the new `SolaceTimeoutError` (exported from the package root and `@italone/solace/server`) instead of hanging. Out-of-order stream boundaries time out individually: the fallback is kept and a failure comment is emitted while the stream stays open.

## 0.1.0-beta.8

### Minor Changes

- e792edd: Make `reactive()` deep: nested plain objects and arrays are lazily wrapped in identity-stable cached reactive proxies, so nested mutations trigger updates. The previous shallow behavior is preserved via the new `shallowReactive()` root export. Non-plain values (Date, RegExp, class instances) are returned as-is.
- e72631e: Extend the DevTools event contract (version 1, additive): new `router:navigation` events (start/success/redirect/error/cancelled with fullPath summaries), `scheduler:flush` gains `skippedStaleJobs` and `distinctCauses`, `reactivity:trigger` gains `correlationId`, and `component:update` optionally carries the matching id so triggers can be linked to the updates they caused. `DEVTOOLS_CONTRACT_VERSION` is exported from `@italone/solace/devtools`, and the example DevTools panel gains the router family, correlation display, and a versioned panel handshake (`contractVersion`).
- d46e79a: Harden the hydration mismatch policy: hydration now detects attribute mismatches between client props and server HTML (one-directional comparison with structured `attribute-mismatch` errors carrying `attributeName`), and supports `hydrate(container, { textComparison: "normalized-collapsing" })` to tolerate foldable whitespace differences in text nodes (default remains exact comparison).
- e23b955: Add router-aware SSG: `generateStaticSiteAsync()` async route entries accept an optional `router` option (`{ routes, identifyRecord, configure? }`, with the route's `path` used as the url). Router-backed routes settle a request-scoped memory router, inject its server context `provides`, and append the serialized route snapshot script to the rendered body for verify-before-hydration pairing with `hydrateAsync(container, { router, routerIdentifyRecord })`. The synchronous `generateStaticSite()` still rejects route-level `router` fields.
- caa5e83: Add synchronous-entry router support: `renderToString()` accepts a `router` option (`{ url, routes, identifyRecord, configure? }`) backed by a new synchronous router settlement fast path (`router.isReadySync()`) that requires synchronous guards (thenable guard results throw a `TypeError` pointing at the async entries), follows redirects synchronously, injects the router server context, and appends the same route snapshot script as the async path. `generateStaticSite()` accepts the same route-level `router` option as `generateStaticSiteAsync()`.

### Patch Changes

- aa3caf0: Fix component-update benchmark methodology: hoist reactive setup and mount out of the timed task, add warmup iterations, and move assertions after measurement so the recorded numbers reflect the batched update flush instead of mount plus JIT warmup.
- 078c7ab: Performance: reduce hot-path allocations — `flattenChildren` returns the original array when children are already flat, `trigger()` snapshots dependencies as a plain array instead of copying into a new `Set` per trigger, keyed-diff key maps are built only when new children carry keys, and the scheduler allocates its devtools cause set lazily. The unmount delete path was profiled and confirmed DOM-bound; the existing batched `DocumentFragment` removal is already optimal and no change was needed. No public API changes.
- cd0397e: Flatten nested array children (for example JSX-mapped lists interleaved with standalone children) instead of silently dropping them at render time.
- 951c6f8: Collect keyed reorder move batches with array push instead of unshift, removing the quadratic collection cost for full-list reversals. Shipped as a complexity fix only: the jsdom keyed-reorder scenario is DOM-bound (see docs/performance.md), so no same-session speedup is claimed.
- 7b0ae70: Apply consumer backpressure in `renderToStream()`: chunk production parks when the `ReadableStream` queue is full and resumes on pull, instead of eagerly buffering the whole document. Byte order and chunk content are unchanged.

## 0.1.0-beta.7

### Patch Changes

- 1e2e30a: Add a same-runner base/head performance regression gate with commit and environment evidence while keeping 1.0 history requirements separate.
- e1718c5: Freeze the documented stable, beta, and experimental public entry boundaries and enforce them in the release contract gate.
- ab9f251: Harden beta.6 release evidence with machine-readable adoption, DevTools distribution, and public contract validation while preserving the beta and experimental API boundaries.
- 30156f4: Export `SolaceHydrationError` from the package root so client hydration recovery can match it with `instanceof` instead of `error.name`, and document that `reactive()` is a shallow proxy whose nested and array mutations require immutable replacement.

## 0.1.0-beta.6 (2026-08-27)

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
