# Project Status

[简体中文](./project-status.zh-CN.md)

This document summarizes the current completion level of Solace as an open-source frontend framework. It separates implemented runtime capabilities, validation coverage, documentation readiness, known gaps, and release coordination state.

## Summary

Solace is now on the `0.1.0` beta line whose repository package version is `0.1.0-beta.1`. npm
`latest` remains the stable `@italone/solace@0.0.5` line, while npm `beta` is the beta install line.
It provides a working public API, package exports, examples, tests, benchmarks, and release checks.
It is suitable as a compact educational and experimental frontend framework, but it should not be
described as a mature production replacement for React, Vue, Svelte, or similar ecosystems.

Current repository state:

- Package name: `@italone/solace`
- Repository package version: `0.1.0-beta.1`
- Published npm `latest`: `0.0.5`
- Published npm `beta`: `0.1.0-beta.1`
- npm dist-tags: `latest` points to `0.0.5`; `beta` points to `0.1.0-beta.1`
- Public package metadata: `"private": false`
- Current branch: `main`
- Remote state: recheck with `git fetch origin main`, `git status --short --branch`, and
  `git rev-list --left-right --count origin/main...HEAD` before any future release, publish, or
  synchronization claim.
- Phase: published beta line; initial runtime scope remains complete, the Router stable slice has
  landed, but the overall project is not a full production contract. The SSR/hydration minimum loop
  and the first browser DevTools extension timeline panel are implemented in the repository.

## Completion Map

| Area             | Status                         | Evidence                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| ---------------- | ------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| App API          | Implemented                    | `createApp`, `mount`, `use`, and app-level `provide` are exported from the package root and documented in `docs/api.md`.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| Reactivity       | Implemented                    | `reactive`, `ref`, `computed`, `effect`, `watch`, and `watchEffect` are exported and covered by unit tests.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| Scheduler        | Implemented                    | `nextTick` and batched component updates are implemented with scheduler tests and integration coverage.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| Rendering        | Implemented                    | VNode rendering, DOM patching, Fragment support, keyed diffing, and move-path instrumentation exist in `src/renderer/**`.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| Components       | Implemented                    | Function components, setup context, props, emit, slots, lifecycle hooks, provide/inject, and async components are documented and tested.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| Store            | Implemented                    | `createStore` combines reactive state, computed getters, and named actions, with DevTools action summaries.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| JSX              | Implemented                    | Package exports include `jsx-runtime` and `jsx-dev-runtime`, with JSX examples and typecheck coverage.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| SFC compiler     | Narrow compiler surface        | `.solace` parsing, template code generation, runtime-helper style injection, `@italone/solace/sfc`, `@italone/solace/vite`, Vite transform diagnostics, explicit `map: null` source-map policy, rejected plugin options, and rejected `.solace?*` query transforms are documented and covered by package-boundary tests.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| Router           | Beta stable slice complete     | Matcher, history adapters with location-based listener deduplication, query helpers, nested route chains, parent-to-child redirects, global and route-level guards, initial history navigation pipeline, duplicate current-route navigation, redirect-to-current, and current history-listener guard skip/no-op handling, stale async navigation result protection, rejected-guard history recovery, invalid history location recovery, invalid initial history fallback, creation-time options/history adapter and route record/component validation, global `beforeEach()` registration validation, route `redirect-rejected` errors, `lazyRoute()` components, surfaced `lazy-load-failed` errors, route names, aliases, route props, named locations, `createMemoryHistory()`, history-aware `RouterLink` href coverage, browser-owned `RouterLink` targets/downloads, nested `RouterView`, root exports, deferred API boundaries, package export coverage, packed-consumer smoke, and expanded `router-basic` e2e coverage exist. |
| SSR/hydration    | Minimum loop implemented       | `renderToString()` renders synchronous trees, rejects async/thenable SSR sources, and collects `useStyle()` output, while `generateStaticSite()` enforces explicit string route paths, accepts manifest asset tags, and `createApp(App).hydrate(container)` attaches behavior, dedupes matching style tags, reports structured hydration mismatches, cleans up failed root hydration effects, and supports explicit `{ recover: true }` deopt. `resolveStaticAssets()` and `createStaticRoutesFromRouter()` are available from `@italone/solace/server`.                                                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| DevTools subpath | Implemented with example panel | `@italone/solace/devtools` exposes listener and recorder APIs, and `examples/devtools-extension` consumes that public subpath through a browser DevTools timeline panel without changing runtime payloads.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| Examples         | Implemented                    | Basic counter, todo app, large list, performance benchmark, router, SFC, and DevTools extension examples exist under `examples/**`.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| Package output   | Implemented                    | Rollup builds ESM, CJS, and type declarations; package export tests and packed-consumer smoke tests validate public entries.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| Documentation    | Mostly complete                | English and Chinese README files, API docs, package usage, release, performance, architecture, DevTools, contributing, and security docs exist.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| Release gates    | Implemented                    | `release:readiness`, `quality`, `release:check`, package smoke tests, benchmarks, and e2e scripts are configured; `release:check` starts with release readiness.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       |

## Strengths and Tradeoffs

Primary strengths:

- The core runtime loop is coherent. App APIs, reactivity, rendering, components, store, JSX, SSR/hydration minimum loop, SSG core, the DevTools public subpath, and the example browser extension now form a working end-to-end system.
- Public boundaries are explicit. `package.json` exports, API docs, package smoke tests, and deep subpath blocking tests work together to define the external contract.
- Validation coverage is comparatively strong for the project size. Format, typecheck, lint, unit and integration tests, package smoke, coverage, jsdom benchmarks, Chromium browser benchmarks, and browser e2e all have runnable scripts.
- The project positioning is honest. The docs distinguish the published beta line, npm `latest` and
  `beta` dist-tags, documented public entries, internal implementation details, and deferred
  production-grade capabilities.
- The codebase remains approachable for study and review. Compared with a mature ecosystem framework, Solace is better suited for understanding reactivity, VNode patching, component models, router guard pipelines, SSR/SSG, and DevTools event contracts.

Primary weaknesses and risks:

SFC remains a narrow compiler surface. Router names, aliases, props, and memory history are now in
the stable slice, but scroll behavior, auth, permissions, and SSR/hydration integration are still
explicit beta scope boundaries. SSR/hydration remains a minimum loop, not a full production
contract. The project is usable and documented today, but these subsystems are still intentionally
scoped short of a frozen production contract.

- Ecosystem capabilities are still thin. There is no first-party UI component library, stable plugin ecosystem, production-grade DevTools distribution, or large-application adoption guide.
- SFC/Vite remains a narrow compiler surface. The current compiler contract covers only
  `@italone/solace/vite`, the `@italone/solace/sfc` type entry, the documented block model, Vite
  transform diagnostics, and explicit `map: null`; syntax expansion and generated code shape should
  not be treated as stable.
- Router remains beta, but the stable slice has taken shape. The current slice covers basic SPA
  workflows and several guard/history boundaries, and route names, aliases, route props, named
  locations, and `createMemoryHistory()` are now part of the documented public contract. Scroll
  behavior, auth, permissions, and SSR/hydration integration remain outside it.
- SSR/hydration remains a minimum loop. Synchronous SSR, manifest asset tags, and explicit hydration recovery exist, but streaming SSR, async component SSR, router-aware hydration, and full production pipeline automation are deferred.
- Internal modules are unstable. Compatibility promises cover documented public entries only; `src/**`, `dist/**`, and internal diagnostics/instrumentation are not suitable external dependencies.

As a result, Solace is currently a good fit for learning, experiments, small demos, framework mechanism validation, and controlled internal prototypes. It is not yet a good fit as the foundation for large production applications or for consumers that depend on internals or undocumented deep subpaths.

## Validation Coverage

The repository includes these validation layers:

- Format check: `pnpm format:check`
- TypeScript runtime typecheck: `pnpm typecheck`
- JSX development runtime typecheck: `pnpm typecheck:jsxdev`
- Lint: `pnpm lint`
- Unit and integration tests: `pnpm test`
- Package exports tests: included through `pnpm test:package`
- Coverage thresholds: `pnpm test:coverage`
- Packed package consumer smoke: `pnpm package:smoke`
- jsdom benchmark smoke: `pnpm benchmark`
- Chromium production browser benchmark: `pnpm benchmark:browser`
- Benchmark history quality gate: `pnpm benchmark:history -- --min-browser-count <count> --min-jsdom-count <count>`
- Browser e2e tests: `pnpm test:e2e`
- DevTools extension smoke: `pnpm test:e2e:devtools-extension`
- Full local gate: `pnpm release:check`, which includes `pnpm release:readiness`, `pnpm package:smoke`, and `pnpm test:e2e`

The 2026-07-30 local release check covered the full gate for `0.0.5`, including release readiness, quality, coverage, package smoke, jsdom benchmark, Chromium production browser benchmark, and e2e. The DevTools extension e2e smoke also passed separately because it is not part of `release:check`.

The 2026-08-03 router stabilization work refreshed the router-focused checks and `pnpm quality`
after adding the initial history navigation pipeline, stale async navigation result protection,
rejected-guard history recovery, invalid history location recovery, invalid initial history
fallback, location-based browser/hash history listener deduplication, creation-time options/history adapter and route record/component validation, global `beforeEach()` registration validation, route redirect `"redirect-rejected"` errors for thrown and invalid redirect results, history-aware `RouterLink` href coverage, browser-owned `RouterLink` target/download handling, the lazy route `"lazy-load-failed"` regression contract, including active-route error
locations when a shared lazy component fails after navigation, parent-to-child redirect precedence
before child guards, duplicate current-route navigation guard-skip/no-op handling,
redirect-to-current guard-skip/no-op handling, and current history-listener guard-skip/no-op
handling. It did not rerun coverage, package smoke outside `pnpm quality`,
benchmarks, browser e2e, DevTools extension e2e, or the full `release:check`. Run the commands again
before any future completion, merge, or release claim.

The 2026-08-03 npm publish for `@italone/solace@0.0.5` reran the full release gate before publishing:
`pnpm release:check` passed, including release readiness, quality, coverage, packed package smoke,
jsdom benchmark, Chromium browser benchmark, and browser e2e. `pnpm release:readiness -- --publishable`
also passed, `npm pack --dry-run --json` confirmed the publish tarball, and a post-publish registry
smoke installed `@italone/solace@0.0.5` from npm and verified the package root, public subpaths, and
private subpath blocking.

The 2026-08-05 beta publish for `@italone/solace@0.1.0-beta.0` used `pnpm release:publish:beta`,
which reran `pnpm release:check` before `changeset publish --tag beta`. Post-publish registry checks
confirmed npm reports `latest -> 0.0.5` and `beta -> 0.1.0-beta.0`, and the matching Git tag
`v0.1.0-beta.0` was pushed.

The 2026-08-05 beta documentation refresh publish for `@italone/solace@0.1.0-beta.1` also used
`pnpm release:publish:beta`, rerunning `pnpm release:check` before `changeset publish --tag beta`.
Post-publish registry checks confirmed npm reports `latest -> 0.0.5` and
`beta -> 0.1.0-beta.1`. A registry beta smoke imported the root, server, Vite, and DevTools public
entries from `@italone/solace@beta`, and the published beta.1 tarball README/docs were checked for
the updated beta install-line wording.

## Public API Boundary

Supported public entries:

- `@italone/solace`
- `@italone/solace/jsx-runtime`
- `@italone/solace/jsx-dev-runtime`
- `@italone/solace/devtools`
- `@italone/solace/server`
- `@italone/solace/sfc`
- `@italone/solace/vite`

Unsupported private areas:

- `src/**`
- `dist/**`
- scheduler queues
- renderer diagnostics and instrumentation internals
- component instances
- VNode factory internals
- DevTools internal emit helpers

The compatibility promise applies to documented public entries only. Internal modules remain implementation details and can change while the framework is still stabilizing.

## Known Gaps

Solace intentionally does not yet include:

- A stable template/SFC compiler contract beyond the current narrow compiler surface. The current `.solace` compiler and Vite plugin are documented for one `<template>`, optional `<script>`, optional `<style>`, Vite transform diagnostics, and explicit `map: null` source-map policy; syntax expansion remains deferred.
- A full first-party router contract. The current beta router covers static routes, dynamic params,
  wildcard fallback routes, query strings, web/hash history, nested routes, parent-to-child
  redirects, global and route-level guards, initial history navigation through the guard/redirect
  pipeline, duplicate current-route navigation, redirect-to-current, and current history-listener
  guard skip/no-op handling, stale async navigation result protection, rejected-guard history
  recovery, invalid history location recovery, invalid initial history fallback, creation-time
  options/history adapter and route record/component validation, global `beforeEach()` registration
  validation, route `redirect-rejected` errors, `lazyRoute()` components, surfaced
  `lazy-load-failed` errors, browser-owned `RouterLink` targets/downloads, `RouterView`, and
  composition helpers. Route names, aliases, route props, named locations, `createMemoryHistory()`,
  history-aware `RouterLink` href coverage, and alias/canonical matching are now in the stable
  slice, but scroll behavior, SSR/hydration integration, auth, and permissions remain deferred.
- Streaming SSR, async component SSR beyond explicit runtime rejection, automatic hydration
  mismatch recovery beyond explicit `{ recover: true }`, router-aware SSR/SSG/hydration, and fully
  automated production SSR pipelines.
- A first-party UI component library.
- A production-grade DevTools browser extension distribution, component tree inspector, dependency
  graph, flame chart, persisted capture workflow, telemetry workflow, or SSR/SSG/hydration-specific
  DevTools panels.
- A stable plugin ecosystem.
- A long-term compatibility policy for internal modules.
- Production adoption guidance for large applications.

These gaps should stay visible in promotional material so the project is positioned honestly as a beta-line runtime with deferred production-grade capabilities.

## Release Coordination State

`@italone/solace@0.0.5` has been published to npm with the `latest` dist-tag.
`@italone/solace@0.1.0-beta.1` has been published to npm with the `beta` dist-tag. Post-publish
registry checks confirmed npm reports `latest -> 0.0.5` and `beta -> 0.1.0-beta.1`, and the matching
Git tag is `v0.1.0-beta.1`. Recheck Git state and the published registry before any future publish
or synchronization claim.

Before publishing any future version, follow the same checklist:

1. Confirm `origin/main` is in sync with the local release branch.
2. Confirm the target version is not already published.
3. Run `pnpm release:readiness -- --publishable`. This stricter mode fails when the local branch is ahead, behind, missing an upstream, or has a dirty worktree.
4. Run `pnpm release:check`.
5. Run `npm pack --dry-run --json` or `npm publish --dry-run --access public` to inspect the tarball.
6. Publish only after npm authentication, organization access, public access, and any one-time password requirement are ready, and only after a maintainer explicitly confirms npm publishing.

## Recommended Next Work

1. **Keep the release baseline synchronized before any future publish**. Before the next release
   preparation, recheck `main` with `git fetch origin main`, `git status --short --branch`, and
   `git rev-list --left-right --count origin/main...HEAD`.
2. **Continue stabilizing the SFC/Vite contract without syntax expansion**: keep the public surface
   limited to `@italone/solace/sfc`, `@italone/solace/vite`, Vite transform diagnostics, explicit
   `map: null`, and the documented `.solace` block model.
3. **Continue narrowing the router beta API without adding still-deferred features**: keep scroll
   behavior, SSR/hydration integration, auth, and permissions deferred until separately designed.
4. **Keep public API gates mandatory**: `pnpm release:readiness`, `pnpm package:smoke`, and `pnpm test:e2e` must run for public API changes.
5. **Harden the first DevTools extension panel without widening runtime payloads**: keep the
   current timeline UI local to `examples/devtools-extension`, add richer inspector views only after
   their event contracts are designed, and keep SSR/SSG/hydration-specific panels deferred.
6. **Collect benchmark history** for jsdom and browser scenarios before making performance claims; use `--min-browser-count` and `--min-jsdom-count` when a trend window is required.
