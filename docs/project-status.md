# Project Status

[简体中文](./project-status.zh-CN.md)

This document summarizes the current completion level of Solace as an open-source frontend framework. It separates implemented runtime capabilities, validation coverage, documentation readiness, known gaps, and release coordination state.

## Summary

Solace is an alpha runtime that has been published to npm as `@italone/solace@0.0.3`. It provides a working public API, package exports, examples, tests, benchmarks, and release checks. It is suitable as a compact educational and experimental frontend framework, but it should not be described as a mature production replacement for React, Vue, Svelte, or similar ecosystems.

Current repository state:

- Package name: `@italone/solace`
- Published version: `0.0.3`
- npm dist-tag: `latest`
- Public package metadata: `"private": false`
- Current branch: `main`
- Remote state: in sync with `origin/main`
- Phase: alpha released; transitioning to beta planning

## Completion Map

| Area             | Status                       | Evidence                                                                                                                                        |
| ---------------- | ---------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| App API          | Implemented                  | `createApp`, `mount`, `use`, and app-level `provide` are exported from the package root and documented in `docs/api.md`.                        |
| Reactivity       | Implemented                  | `reactive`, `ref`, `computed`, `effect`, `watch`, and `watchEffect` are exported and covered by unit tests.                                     |
| Scheduler        | Implemented                  | `nextTick` and batched component updates are implemented with scheduler tests and integration coverage.                                         |
| Rendering        | Implemented                  | VNode rendering, DOM patching, Fragment support, keyed diffing, and move-path instrumentation exist in `src/renderer/**`.                       |
| Components       | Implemented                  | Function components, setup context, props, emit, slots, lifecycle hooks, provide/inject, and async components are documented and tested.        |
| Store            | Implemented                  | `createStore` combines reactive state, computed getters, and named actions, with DevTools action summaries.                                     |
| JSX              | Implemented                  | Package exports include `jsx-runtime` and `jsx-dev-runtime`, with JSX examples and typecheck coverage.                                          |
| DevTools subpath | Implemented as low-level API | `@italone/solace/devtools` exposes listener and recorder APIs, not a browser extension or UI.                                                   |
| Examples         | Implemented                  | Basic counter, todo app, large list, and performance benchmark examples exist under `examples/**`.                                              |
| Package output   | Implemented                  | Rollup builds ESM, CJS, and type declarations; package export tests and packed-consumer smoke tests validate public entries.                    |
| Documentation    | Mostly complete              | English and Chinese README files, API docs, package usage, release, performance, architecture, DevTools, contributing, and security docs exist. |
| Release gates    | Implemented                  | `release:readiness`, `quality`, `release:check`, package smoke tests, benchmarks, and e2e scripts are configured.                               |

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
- Browser e2e tests: `pnpm test:e2e`
- Full local gate: `pnpm release:check`

Recent local release checks have covered the full gate, including package smoke, coverage, browser benchmark, and e2e. Run the commands again before any future completion, merge, or release claim.

## Public API Boundary

Supported public entries:

- `@italone/solace`
- `@italone/solace/jsx-runtime`
- `@italone/solace/jsx-dev-runtime`
- `@italone/solace/devtools`

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

- A template compiler or single-file component compiler.
- A first-party router.
- SSR, SSG, streaming rendering, or hydration.
- A first-party UI component library.
- A browser extension DevTools panel.
- A stable plugin ecosystem.
- A long-term compatibility policy for internal modules.
- Production adoption guidance for large applications.

These gaps should stay visible in promotional material so the project is positioned honestly as an alpha runtime.

## Release Coordination State

`@italone/solace@0.0.3` has been published to npm. Future releases should follow the same checklist:

1. Confirm `origin/main` is in sync with the local release branch.
2. Confirm the target version is not already published.
3. Run `pnpm release:readiness -- --publishable`.
4. Run `pnpm release:check`.
5. Run `npm publish --dry-run --access public --cache /private/tmp/npm-cache` if using the known working temporary npm cache.
6. Publish only after npm authentication, organization access, public access, and any one-time password requirement are ready.

## Recommended Next Work

1. **Stabilize the public API surface** before expanding compiler, router, SSR, hydration, or DevTools UI work.
2. **Keep package export tests and packed-consumer smoke tests mandatory** for any public API change.
3. **Collect browser benchmark history** for keyed reorder and large-list scenarios before making performance claims.
4. **Add `license` and `author` fields to `package.json`** before the next release.
5. **Begin beta work** from `docs/roadmap.md` in priority order: template/SFC compiler exploration, first-party router design, SSR/SSG/hydration, browser DevTools extension UI, and production adoption guidance.
6. **Update `package.json` metadata** and READMEs as the project matures.
