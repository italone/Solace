# Project Status

[简体中文](./project-status.zh-CN.md)

This document summarizes the current completion level of Solace as an open-source frontend framework. It separates implemented runtime capabilities, validation coverage, documentation readiness, known gaps, and release coordination state.

## Summary

Solace is an alpha runtime whose latest published npm package is `@italone/solace@0.0.4`, with repository release preparation currently at `0.0.5`. It provides a working public API, package exports, examples, tests, benchmarks, and release checks. It is suitable as a compact educational and experimental frontend framework, but it should not be described as a mature production replacement for React, Vue, Svelte, or similar ecosystems.

Current repository state:

- Package name: `@italone/solace`
- Repository package version: `0.0.5`
- Published npm version: `0.0.4`
- npm dist-tag: `latest` points to `0.0.4`
- Public package metadata: `"private": false`
- Current branch: `main`
- Remote state: the local `main` release baseline has been synchronized with `origin/main` as of
  2026-07-30. Recheck with `git fetch origin main`, `git status --short --branch`, and
  `git rev-list --left-right --count origin/main...HEAD` before any future release, publish, or
  synchronization claim.
- Phase: alpha released; beta contract stabilization, SSR/hydration minimum loop, and first
  browser DevTools extension timeline panel implemented in the repository

## Completion Map

| Area             | Status                         | Evidence                                                                                                                                                                                                                                                                                                                                                                                                         |
| ---------------- | ------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| App API          | Implemented                    | `createApp`, `mount`, `use`, and app-level `provide` are exported from the package root and documented in `docs/api.md`.                                                                                                                                                                                                                                                                                         |
| Reactivity       | Implemented                    | `reactive`, `ref`, `computed`, `effect`, `watch`, and `watchEffect` are exported and covered by unit tests.                                                                                                                                                                                                                                                                                                      |
| Scheduler        | Implemented                    | `nextTick` and batched component updates are implemented with scheduler tests and integration coverage.                                                                                                                                                                                                                                                                                                          |
| Rendering        | Implemented                    | VNode rendering, DOM patching, Fragment support, keyed diffing, and move-path instrumentation exist in `src/renderer/**`.                                                                                                                                                                                                                                                                                        |
| Components       | Implemented                    | Function components, setup context, props, emit, slots, lifecycle hooks, provide/inject, and async components are documented and tested.                                                                                                                                                                                                                                                                         |
| Store            | Implemented                    | `createStore` combines reactive state, computed getters, and named actions, with DevTools action summaries.                                                                                                                                                                                                                                                                                                      |
| JSX              | Implemented                    | Package exports include `jsx-runtime` and `jsx-dev-runtime`, with JSX examples and typecheck coverage.                                                                                                                                                                                                                                                                                                           |
| SFC compiler     | Alpha public contract narrowed | `.solace` parsing, template code generation, runtime-helper style injection, `@italone/solace/sfc`, `@italone/solace/vite`, rejected plugin options, and rejected `.solace?*` query transforms are documented and covered by package-boundary tests.                                                                                                                                                             |
| Router           | Beta first slice stabilized    | Matcher, history adapters, query helpers, components, root exports, deferred API boundaries, routes list guards, route record path guards, object location shape guards, package export coverage, packed-consumer smoke, and `router-basic` e2e coverage exist.                                                                                                                                                  |
| SSR/hydration    | Minimum loop implemented       | `renderToString()` renders synchronous trees, rejects async/thenable SSR sources, and collects `useStyle()` output, while `generateStaticSite()` enforces explicit string route paths and `createApp(App).hydrate(container)` attaches behavior, dedupes matching style tags, reports structured hydration mismatches, cleans up failed root hydration effects, and supports explicit `{ recover: true }` deopt. |
| DevTools subpath | Implemented with example panel | `@italone/solace/devtools` exposes listener and recorder APIs, and `examples/devtools-extension` consumes that public subpath through a browser DevTools timeline panel without changing runtime payloads.                                                                                                                                                                                                       |
| Examples         | Implemented                    | Basic counter, todo app, large list, performance benchmark, router, SFC, and DevTools extension examples exist under `examples/**`.                                                                                                                                                                                                                                                                              |
| Package output   | Implemented                    | Rollup builds ESM, CJS, and type declarations; package export tests and packed-consumer smoke tests validate public entries.                                                                                                                                                                                                                                                                                     |
| Documentation    | Mostly complete                | English and Chinese README files, API docs, package usage, release, performance, architecture, DevTools, contributing, and security docs exist.                                                                                                                                                                                                                                                                  |
| Release gates    | Implemented                    | `release:readiness`, `quality`, `release:check`, package smoke tests, benchmarks, and e2e scripts are configured; `release:check` starts with release readiness.                                                                                                                                                                                                                                                 |

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

The 2026-07-30 local release check covered the full gate for `0.0.5`, including release readiness, quality, coverage, package smoke, jsdom benchmark, Chromium production browser benchmark, and e2e. The DevTools extension e2e smoke also passed separately because it is not part of `release:check`. Run the commands again before any future completion, merge, or release claim.

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

The alpha compatibility promise applies to documented public entries only. Internal modules can change while the framework is still stabilizing.

## Known Gaps

Solace intentionally does not yet include:

- A stable template/SFC compiler contract beyond the current narrow alpha surface. The current `.solace` compiler and Vite plugin are documented for one `<template>`, optional `<script>`, optional `<style>`, Vite transform diagnostics, and `map: null`; syntax expansion remains deferred.
- A full first-party router contract. The current beta router covers static routes, dynamic params, wildcard fallback routes, query strings, web/hash history, `RouterLink`, `RouterView`, and composition helpers, but nested routes, guards, redirects, lazy route components, scroll behavior, memory history, SSR/hydration integration, auth, and permission routing remain deferred.
- Streaming SSR, async component SSR beyond explicit runtime rejection, production asset manifest
  integration, automatic hydration mismatch recovery beyond explicit `{ recover: true }`, and router
  SSR/SSG/hydration integration.
- A first-party UI component library.
- A production-grade DevTools browser extension distribution, component tree inspector, dependency
  graph, flame chart, persisted capture workflow, telemetry workflow, or SSR/SSG/hydration-specific
  DevTools panels.
- A stable plugin ecosystem.
- A long-term compatibility policy for internal modules.
- Production adoption guidance for large applications.

These gaps should stay visible in promotional material so the project is positioned honestly as an alpha runtime.

## Release Coordination State

`@italone/solace@0.0.4` has been published to npm. Repository `main` is prepared at
`0.0.5` and synchronized with `origin/main`, but npm publishing was explicitly skipped on
2026-07-30. npm still reports `@italone/solace@0.0.4` as the latest published version.

Before publishing `0.0.5` or any future version, follow the same checklist:

1. Confirm `origin/main` is in sync with the local release branch.
2. Confirm the target version is not already published.
3. Run `pnpm release:readiness -- --publishable`. This stricter mode fails when the local branch is ahead, behind, missing an upstream, or has a dirty worktree.
4. Run `pnpm release:check`.
5. Run `npm publish --dry-run --access public --cache /private/tmp/npm-cache` if using the known working temporary npm cache.
6. Publish only after npm authentication, organization access, public access, and any one-time password requirement are ready, and only after a maintainer explicitly confirms npm publishing.

## Recommended Next Work

1. **Keep the release baseline synchronized before any future publish**. Before the next release
   preparation, recheck `main` with `git fetch origin main`, `git status --short --branch`, and
   `git rev-list --left-right --count origin/main...HEAD`.
2. **Continue stabilizing the SFC/Vite contract without syntax expansion**: keep the public surface limited to `@italone/solace/sfc`, `@italone/solace/vite`, Vite transform diagnostics, and the documented alpha `.solace` block model.
3. **Continue narrowing the router beta API without adding deferred features**: keep nested routes, guards, redirects, lazy route components, scroll behavior, memory history, SSR/hydration integration, auth, and permissions out of the beta slice until separately designed.
4. **Keep public API gates mandatory**: `pnpm release:readiness`, `pnpm package:smoke`, and `pnpm test:e2e` must run for public API changes.
5. **Harden the first DevTools extension panel without widening runtime payloads**: keep the
   current timeline UI local to `examples/devtools-extension`, add richer inspector views only after
   their event contracts are designed, and keep SSR/SSG/hydration-specific panels deferred.
6. **Collect benchmark history** for jsdom and browser scenarios before making performance claims; use `--min-browser-count` and `--min-jsdom-count` when a trend window is required.
