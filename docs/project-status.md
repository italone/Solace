# Project Status

[简体中文](./project-status.zh-CN.md)

This document summarizes the current completion level of Solace as an open-source frontend framework. It separates implemented runtime capabilities, validation coverage, documentation readiness, known gaps, and release coordination state.

## Summary

Solace is now on the `0.1.0` beta line. This working tree prepares a local `0.1.0-beta.6`
candidate; it is not published. npm `latest` remains the stable `@italone/solace@0.0.5` line, while
published npm `beta` is `0.1.0-beta.5`.
It provides a working public API, package exports, examples, tests, benchmarks, and release checks.
Its primary authoring path is JSX/TSX-first function components backed by explicit runtime APIs. It
is suitable as a compact educational and experimental frontend framework, but it should not be
described as a mature production replacement for React, Vue, Svelte, or similar ecosystems.

Current repository state:

- Package name: `@italone/solace`
- Repository package version: local `0.1.0-beta.6` candidate
- Published npm `latest`: `0.0.5`
- Published npm `beta`: `0.1.0-beta.5`
- npm dist-tags: `latest` points to `0.0.5`; `beta` points to `0.1.0-beta.5`
- Public package metadata: `"private": false`
- Current branch: `main`
- Remote state: recheck with `git fetch origin main`, `git status --short --branch`, and
  `git rev-list --left-right --count origin/main...HEAD` before any future release, publish, or
  synchronization claim.
- Phase: published beta.5 contract and adoption release. The Router stable slice,
  buffered async initial SSR/hydration, sequential async SSG, and the first browser DevTools
  extension timeline panel are implemented, but the project is not a full production contract.

The 2026-08-18 next-steps work completed Tasks 1, 2, 3, 5, and 6 without widening the beta
contract: the DevTools browser extension QA and inspected-origin checklists were recorded, the
router stable-slice lazy-failure and snapshot-mismatch boundaries gained integration coverage,
the JSX/TSX typed named-slot contract was hardened with the `v-slots` producer path, benchmark
history evidence was refreshed, and the public contract docs were synchronized. No new runtime
APIs were added and the published beta.5 release state is unchanged.

## Completion Map

| Area             | Status                                                        | Evidence                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| ---------------- | ------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| App API          | Implemented                                                   | `createApp`, `mount`, `use`, and app-level `provide` are exported from the package root and documented in `docs/api.md`.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| Reactivity       | Implemented                                                   | `reactive`, `ref`, `computed`, `effect`, `watch`, and `watchEffect` are exported and covered by unit tests.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| Scheduler        | Implemented                                                   | `nextTick` and batched component updates are implemented with scheduler tests and integration coverage.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| Rendering        | Implemented                                                   | VNode rendering, DOM patching, Fragment support, keyed diffing, and move-path instrumentation exist in `src/renderer/**`.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| Components       | Implemented                                                   | Function components, setup context, props, emit, slots, lifecycle hooks, provide/inject, and async components are documented and tested.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| Store            | Implemented                                                   | `createStore` combines reactive state, computed getters, and named actions, with DevTools action summaries.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| JSX/TSX          | Primary authoring path with typed component contract          | Package exports include `jsx-runtime` and `jsx-dev-runtime`, with JSX examples and typecheck coverage. Function components and TSX are the main public component authoring model, with typed slots, typed events, generic components, and the JSX `v-slots` named-slot path hardened by the 2026-08-17/18 regression matrix.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               |     |
| SFC compiler     | Optional experimental surface                                 | `.solace` parsing, template code generation, runtime-helper style injection, `@italone/solace/sfc`, `@italone/solace/vite`, Vite transform diagnostics, explicit `map: null` source-map policy, rejected plugin options, and rejected `.solace?*` query transforms are documented and covered by package-boundary tests. The SFC path remains auxiliary, not Solace's main framework identity.                                                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| Router           | Beta stable slice complete                                    | Matcher, history adapters, query helpers, nested route chains, redirects, global/route guards, single-flight `isReady()` initial settlement, stale navigation protection, structured errors, lazy routes, names, aliases, props, named locations, `createMemoryHistory()`, `scrollBehavior`, canonical route snapshots, history-aware `RouterLink`, nested `RouterView`, root exports, package export coverage, packed-consumer smoke, and expanded browser coverage exist.                                                                                                                                                                                                                                                                                                                                                                                                |
| SSR/hydration    | Buffered async, sequential streaming, plus router composition | `renderToStringAsync()` resolves complete async initial trees into buffered HTML/styles, while `hydrateAsync()` prepares before touching server DOM and supports explicit DOM mismatch recovery. Existing synchronous APIs retain synchronous return types and reject unresolved async values. `renderToStream()` implements sequential streaming SSR (beta): byte order matches `renderToStringAsync().html`, completed prefixes flush before async components resolve, and styles emit inline at first registration; it starts eagerly and does not handle consumer backpressure. `createRouterServerContext()` adds request-scoped memory-router settlement, canonical snapshot serialization, and verify-before-hydrate composition. Direct `router` option rejections remain unchanged; out-of-order streaming and renderer-owned router integration remain deferred. |
| DevTools subpath | Implemented with example panel                                | `@italone/solace/devtools` exposes listener and recorder APIs, and `examples/devtools-extension` consumes that public subpath through a browser DevTools timeline panel that now includes the store action timeline and a Components tree tab built from the `parentId`-extended component mount/update/unmount event summaries, plus the inspected-origin and QA checklists in `docs/devtools.md`, without changing the runtime payload policy.                                                                                                                                                                                                                                                                                                                                                                                                                           |
| Examples         | Implemented                                                   | Basic counter, todo app, large list, performance benchmark, router, SFC, and DevTools extension examples exist under `examples/**`.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| Package output   | Implemented                                                   | Rollup builds ESM, CJS, and type declarations; package export tests and packed-consumer smoke tests validate public entries.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| Documentation    | Mostly complete                                               | English and Chinese README files, API docs, package usage, release, performance, architecture, DevTools, large-app adoption, ecosystem direction in `docs/ecosystem.md`, contributing, and security docs exist.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| Release gates    | Implemented, evidence-blocked candidate                       | `release:readiness`, `quality`, `release:check`, public contract, performance regression, package smoke, benchmark, and e2e scripts are configured; stable publish additionally requires the 1.0 evidence checklist.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       |

## Strengths and Tradeoffs

Primary strengths:

- The core runtime loop is coherent. App APIs, reactivity, rendering, function components, store,
  JSX/TSX, buffered async initial SSR/hydration, sequential async SSG, the DevTools public subpath,
  and the example browser extension now form a working end-to-end system.
- The primary authoring story is clear: Solace leads with JSX/TSX-first function components and explicit runtime APIs instead of trying to become a Vue-style SFC framework.
- Public boundaries are explicit. `package.json` exports, API docs, package smoke tests, and deep subpath blocking tests work together to define the external contract.
- SSR, hydration, and SSG option objects reject unknown own fields with field-specific `TypeError`
  messages instead of silently accepting misspelled configuration.
- Validation coverage is comparatively strong for the project size. Format, typecheck, lint, unit and integration tests, package smoke, coverage, jsdom benchmarks, Chromium browser benchmarks, and browser e2e all have runnable scripts.
- The project positioning is honest. The docs distinguish the published beta line, npm `latest` and
  `beta` dist-tags, documented public entries, internal implementation details, and deferred
  production-grade capabilities.
- The codebase remains approachable for study and review. Compared with a mature ecosystem framework, Solace is better suited for understanding reactivity, VNode patching, component models, router guard pipelines, SSR/SSG, and DevTools event contracts.

Primary weaknesses and risks:

SFC remains an optional, narrow, experimental compiler surface rather than the primary framework
direction. Router names, aliases, props, memory history, scroll behavior, readiness, canonical
snapshots, and request-scoped SSR context are now in the stable slice, but auth, permissions, and
direct renderer-owned router integration remain explicit beta scope boundaries.
SSR/hydration now includes buffered async initial rendering and sequential streaming SSR (beta), but it is not a full production
contract. The project is usable and documented today, while these subsystems remain intentionally
scoped short of out-of-order streaming, renderer-owned router integration, and async scheduling after initial hydration.

These exclusions are deliberate scope decisions for a readable, teaching-oriented runtime — not incomplete work. Revisit criteria are recorded in `docs/roadmap.md`; each would require a dedicated design doc before implementation.

- Ecosystem capabilities are still thin. There is no first-party UI component library, stable plugin ecosystem, or production-grade DevTools distribution. The large-app adoption guide is still early-stage guidance rather than a field-tested ecosystem layer, and `docs/ecosystem.md` keeps the beta-line UI library and plugin decisions explicit. The checked-in DevTools extension example is now restricted to the local 6174 demo origins; a production distribution still needs explicit inspected-origin review.
- SFC/Vite remains an optional experimental compiler surface. The current compiler contract covers only
  `@italone/solace/vite`, the `@italone/solace/sfc` type entry, the documented block model, Vite
  transform diagnostics, and explicit `map: null`; syntax expansion and generated code shape should
  not be treated as stable, and SFC expansion is not the near-term framework direction.
- Router remains beta, but the stable slice has taken shape. The current slice covers basic SPA
  workflows and several guard/history boundaries, and route names, aliases, route props, named
  locations, `createMemoryHistory()`, `scrollBehavior`, `isReady()`, canonical snapshots, and
  request-scoped server context are now part of the documented public contract. Auth and permissions
  remain outside it, with router options and route record fields explicitly rejected. This ensures
  route `meta` is not mistaken for enforcement. Direct renderer options remain deferred.
- SSR/hydration now covers buffered async initial rendering plus the sequential streaming slice.
  `renderToStringAsync()`,
  `generateStaticSiteAsync()`, and `hydrateAsync()` cover async initial trees, and `renderToStream()`
  streams the same byte order sequentially with inline first-registration styles, eager start, and no
  consumer backpressure, but out-of-order streaming,
  direct renderer-owned router integration, Suspense/selective hydration, ambient instance APIs after async
  suspension, async update scheduling after initial hydration, and full production pipeline
  automation remain deferred. Explicit router-aware SSR and router-aware hydration now use
  readiness, server context, and snapshot verification composition.
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
- Operations Console packed candidate smoke: `pnpm stable:app`
- jsdom benchmark smoke: `pnpm benchmark`
- Chromium production browser benchmark: `pnpm benchmark:browser`
- CI same-runner cross-commit comparison: `pnpm performance:compare:ci`
- Benchmark history quality gate: `pnpm benchmark:history -- --min-browser-count <count> --min-jsdom-count <count>`
- Checked-in benchmark readiness evidence: `pnpm benchmark:history:evidence -- --output release/performance-history.json`
- Browser e2e tests: `pnpm test:e2e`
- DevTools extension smoke: `pnpm test:e2e:devtools-extension`
- Full local gate: `pnpm release:check`, which includes `pnpm release:readiness`,
  `pnpm package:smoke`, `pnpm stable:app`, `pnpm test:e2e`, and
  `pnpm test:e2e:devtools-extension`

The 2026-07-30 local release check covered the then-current full gate for `0.0.5`, including
release readiness, quality, coverage, package smoke, jsdom benchmark, Chromium production browser
benchmark, and browser e2e. DevTools extension e2e was later added to the current `release:check`
gate, so rerun the gate before making fresh release claims.

The 2026-08-12 full local `pnpm release:check` passed for the beta.4 release state. It recorded
71 Vitest files / 626 tests and fresh coverage of 94.28% statements /
89.18% branches / 96.28% functions / 94.32% lines. The Operations Console packed candidate and
pinned baseline upgrade smokes passed, and the ordinary
browser inventory and run covered 24 browser e2e tests across Chromium, Firefox, and WebKit; the
separate DevTools extension inventory and gate contain 2 Chromium-only DevTools extension e2e
tests. The separately required pinned upgrade smoke installed exact npm baseline
`@italone/solace@0.1.0-beta.2` and passed the Operations Console comparison against the local packed
beta.4 candidate. The guarded publish command reran this complete gate before publishing.

The final 2026-08-14 beta.5 local `pnpm release:check` passed after the contract, adoption, and
performance-evidence work. It recorded 81 Vitest files / 702 tests and coverage of 92.97% statements /
88.11% branches / 95.21% functions / 93.25% lines, plus 16 package tests, 24 browser e2e tests across Chromium,
Firefox, and WebKit, and 2 Chromium-only DevTools extension e2e tests. Packed package smoke,
package-only CSR plus SSR/hydration adoption smoke, Operations Console smoke, jsdom benchmark, and
Chromium production browser benchmark also passed. The optional three-browser adoption runner passed
for the local beta.5 tarball. The stricter 2026-08-18 evaluator now names this result the
`Solace 1.0 evidence checklist` and reports `INCOMPLETE`; the source record remains
`release/adoption-evidence.md`. The two external React/Vite applications
prove package compatibility only; they are not Solace-primary production adoption. Production
rollback rehearsal, distributable DevTools evidence, stable contract admission, and five distinct
dates for every browser scenario are also still missing. `READY` therefore means only that every
checked evidence item is present; it is not a 1.0 release decision.

The 2026-08-18 beta.5 baseline re-validation reran the full local `pnpm release:check` on the
published beta.5 state and passed. It recorded 82 Vitest files / 708 tests and coverage of 93.00%
statements / 88.16% branches / 95.21% functions / 93.28% lines, with the same 24 browser e2e tests
and 2 DevTools extension e2e tests passing. No source code changed; this run confirms the release
baseline remains green.

The 2026-08-18 next-steps tasks (DevTools store action timeline and checklists, router
stable-slice edge coverage, JSX typed named-slot hardening, and benchmark history evidence
refresh) each reran the relevant focused checks and `pnpm quality` before commit. They did not
rerun coverage, package smoke, benchmarks, browser e2e, or the full `release:check`; rerun the
full gate before any future release claim. The published beta.5 release state is unchanged.

The 2026-08-18 local beta.6 candidate passed a fresh `pnpm release:check` after structured 1.0
evidence binding. It recorded 86 Vitest files / 742 tests, coverage of 92.34% statements / 87.24%
branches / 95.54% functions / 92.73% lines, and 16 package tests. Packed package, adoption, and
Operations Console smokes passed; jsdom and Chromium production benchmarks passed; ordinary browser
e2e passed 24/24 across Chromium, Firefox, and WebKit; DevTools extension e2e passed 4/4. Beta
regression requires five runs backed by at least two distinct calendar dates.

`release/adoption-evidence.json` now binds each declared application to matching package version,
renderer, workflow, upgrade, and rollback records; `release/adoption-evidence.md` remains the
human-readable validation log. The external React/Vite applications remain compatibility-only, so
they do not count toward independent Solace-primary adoption. Likewise,
`release/devtools-distribution-evidence.json` binds the local extension record to the checked-in
manifest permissions, but deliberately records no production distribution or tested production
origins. `pnpm release:one-zero:check` therefore remains `INCOMPLETE` for independent adoption,
five distinct dates per keyed browser scenario, distributable DevTools evidence, and stable contract
admission. Local Git was ahead of `origin/main` when that record was written; the two
DevTools packaging-gate docs commits were pushed on 2026-08-20 and `origin/main` is now
synchronized, so that publish blocker is cleared while the evidence blockers remain.

The CI cross-commit performance gate is now configured through
`pnpm performance:compare:ci`. It compares base and candidate minimums (best-of-three samples) on the
same runner, because medians of short millisecond-scale metrics false-positived on scheduler and GC
jitter even for identical source trees. The gate enforces a 1.2 maximum ratio plus a 3ms
`absoluteDeltaFloorMs` guard so sub-floor absolute deltas on micro-metrics cannot fail the gate, and
it retains commit and environment fingerprints in diagnostic artifacts. It does not count toward the five-date 1.0 evidence requirement.
The gate does not update `release/performance-history.json` and does not change the current
`INCOMPLETE` admission result.

The 2026-08-19 verification first exposed a coverage regression after release-script configuration
was inlined into CLI entry points. Splitting reusable configuration back into testable pure modules
and keeping the CLI files thin restored the gate. The same cleanup removed the renderer's
`diff.ts -> children.ts -> diff.ts` circular dependency. A fresh full `pnpm release:check` then passed
91 Vitest files / 814 tests, 16 package tests, and coverage of 90.40% statements / 86.33% branches /
93.23% functions / 90.94% lines. It also passed package and adoption smoke, the packed Operations
Console check, jsdom and Chromium benchmarks, 24 browser E2E tests, and 4 DevTools extension E2E
tests. This validates the beta.6 candidate gates, but does not supply the missing 1.0 adoption,
five-date history, DevTools distribution, or stable-admission evidence.

The 2026-08-20 baseline refresh pushed the two outstanding DevTools packaging-gate docs commits to
`origin/main` (synchronizing `main` with the remote) and reran the full `pnpm release:check` on the
synchronized tree. The gate passed: 91 Vitest files / 816 tests, 16 package tests, coverage of
90.10% statements / 86.22% branches / 93.12% functions / 90.66% lines, package and adoption smoke,
the packed Operations Console check, jsdom and Chromium benchmarks (performance regression: PASS),
24 browser E2E tests across Chromium, Firefox, and WebKit, and 4 DevTools extension E2E tests. No
runtime code changed; the 1.0 evidence blockers (independent adoption, five-date history, DevTools
distribution, stable admission) are unchanged.

The same 2026-08-19 hardening made the packed adoption consumer a routine check: routine Node 20/22
CI now runs `pnpm adoption:smoke`. A separate scheduled
`.github/workflows/performance-history.yml` restores the latest successful history cache and appends
one jsdom and Chromium collection per UTC day. It still needs successful runs on enough future dates;
the checked-in browser evidence remains below five dates for six keyed-reorder scenarios. DevTools
now has `pnpm package:devtools-extension`, which creates a deterministic ZIP for explicit exact HTTPS
origins, verifies the generated minimal manifest, and reports SHA-256. The command was validated with
a non-production example origin, but no real production origin has been verified. The two external
applications remain React-primary compatibility checks, with no Solace-primary upgrade and rollback
rehearsal, so they still do not count toward independent adoption. The hardened evaluator now requires
exact npm upgrade and rollback versions, matching evidence records and paths, and a verified rollback
rehearsal. Performance evidence exposes sorted unique `runAt[]`, rejects future or older-than-30-day
runs, and recomputes run and UTC-date counts. DevTools evidence binds the ZIP and manifest SHA-256,
exact HTTPS origins, and QA result to the same artifact digest. These checks prevent unsupported
claims; they do not manufacture the three missing production evidence sets.

Independent adopters can now bind reviewed baseline, candidate, and rollback records with
`pnpm adoption:evidence`. The loader rebuilds each declared bundle and verifies its SHA-256; the 1.0
evaluator independently matches exact versions, application identity, repository, production origin,
workflows, reviewer approval, and rollback restoration. No current application declares a real
production bundle, so independent adoption remains 0/2.

The 2026-08-17 public component regression matrix also verifies required typed slots, typed events,
and generic components across the automatic JSX runtime, direct `h()` and JSX runtime calls,
`createApp`, Router records, server rendering sources, and a packed consumer. Runtime containers use
an internal metadata-erased component transport while JSX/TSX and `h()` authoring boundaries remain
strict. `tests/integration/router-ssr-hydration.test.ts` adds composed coverage for stale navigation,
guard rejection, snapshot mismatch, lazy route failure, and reactive updates after async hydration
without adding Router or SSR APIs.

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

The 2026-08-11 beta.2 publish for `@italone/solace@0.1.0-beta.2` used
`pnpm release:publish:beta`, rerunning `pnpm release:check` before `changeset publish --tag beta`.
Post-publish registry checks confirmed npm reports `latest -> 0.0.5` and
`beta -> 0.1.0-beta.2`. A registry beta smoke imported the root, server, Vite, and DevTools public
entries and rendered a server-side paragraph; the published beta.2 tarball contained 48 files.
The local and remote `v0.1.0-beta.2` tags are present and point to the beta.2 release commit.

The 2026-08-12 beta.4 publish for `@italone/solace@0.1.0-beta.4` used
`pnpm release:publish:beta`, rerunning the full release gate before `changeset publish --tag beta`.
Registry checks confirm `latest -> 0.0.5` and `beta -> 0.1.0-beta.4`. The registry smoke imported
all eight protected public entries, rendered `<p>beta.4 registry smoke</p>`, and confirmed that the
private `@italone/solace/dist/index.js` deep path remains blocked. The published tarball contains 50
files and is immutable; its README/status files retain the prepublish candidate wording. The local
and remote annotated `v0.1.0-beta.4` tags are present, and the remote peeled ref resolves to release
commit `fbe6984`.

The 2026-08-14 beta.5 publish for `@italone/solace@0.1.0-beta.5` used
`pnpm release:publish:beta`, rerunning the full release gate before `changeset publish --tag beta`.
The gate passed 81 Vitest files / 702 tests, 16 package tests, 24 browser e2e tests, and 2 DevTools
extension e2e tests with coverage of 92.97% statements / 88.11% branches / 95.21% functions /
93.25% lines. Registry checks confirm `latest -> 0.0.5` and `beta -> 0.1.0-beta.5`; the registry
smoke imported all eight protected public entries, rendered through the server entry, and confirmed
that the private deep path remains blocked. The local `v0.1.0-beta.5` tag points to release commit `afe459e`.
Remote `v0.1.0-beta.5` tag verification remains pending because live GitHub connectivity was
unavailable during the post-publish audit.

## Public API Boundary

Supported public entries:

- `@italone/solace`
- `@italone/solace/jsx-runtime`
- `@italone/solace/jsx-dev-runtime`
- `@italone/solace/devtools`
- `@italone/solace/server`
- `@italone/solace/sfc`
- `@italone/solace/vite`
- `@italone/solace/package.json`

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

- A stable template/SFC compiler contract beyond the current optional experimental surface. The current `.solace` compiler and Vite plugin are documented for one `<template>`, optional `<script>`, optional `<style>`, Vite transform diagnostics, and explicit `map: null` source-map policy; syntax expansion remains deferred and is not required for the JSX/TSX-first framework direction.
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
  slice, and scroll behavior now runs after successful navigations. Explicit readiness, server
  context, and snapshot verification composition is supported.
  Direct renderer-owned SSR/hydration integration remains deferred. Auth and permissions remain
  deferred.
- Out-of-order streaming SSR (sequential streaming is implemented as `renderToStream()`),
  automatic hydration mismatch recovery beyond explicit `{ recover: true }`,
  direct renderer-owned router options for SSR/SSG/hydration, Suspense/selective hydration, ambient
  instance APIs after async suspension, async update scheduling after initial hydration, and fully
  automated production SSR pipelines.
- A first-party UI component library.
- A production-grade DevTools browser extension distribution, component tree inspector, dependency
  graph, flame chart, persisted capture workflow, telemetry workflow, or SSR/SSG/hydration-specific
  DevTools panels.
- A stable plugin ecosystem.
- A long-term compatibility policy for internal modules.

These gaps should stay visible in promotional material so the project is positioned honestly as a beta-line runtime with deferred production-grade capabilities.

## Release Coordination State

`@italone/solace@0.0.5` has been published to npm with the `latest` dist-tag.
`@italone/solace@0.1.0-beta.5` has been published to npm with the `beta` dist-tag. Post-publish
registry checks confirm npm reports `latest -> 0.0.5` and `beta -> 0.1.0-beta.5`. The local tag
points to release commit `afe459e`; remote tag verification remains pending because GitHub was not
reachable from the verification environment. Recheck Git state, the remote tag, and the published
registry before any future publish or synchronization claim.

Before publishing any future version, follow the same checklist:

1. Confirm `origin/main` is in sync with the local release branch.
2. Confirm the target version is not already published.
3. Run `pnpm release:candidate:check`, which performs publishable readiness, the exact beta.2 upgrade smoke, and the full local release gate.
4. Confirm `pnpm release:readiness -- --publishable` reports a synchronized, clean branch.
5. Run `npm pack --dry-run --json` or `npm publish --dry-run --access public` to inspect the tarball.
6. Publish only after npm authentication, organization access, public access, and any one-time password requirement are ready, and only after a maintainer explicitly confirms npm publishing.

## Recommended Next Work

Public contract gates remain the first release line: README, project-status, API, package-usage,
package boundary tests, consumer smoke, and release readiness should move together whenever a public
entry or beta boundary changes.

1. **Keep the release baseline synchronized before any future publish**. Before the next release
   preparation, recheck `main` with `git fetch origin main`, `git status --short --branch`, and
   `git rev-list --left-right --count origin/main...HEAD`.
2. **Prioritize JSX/TSX-first runtime ergonomics and examples**: keep function components, JSX/TSX
   authoring, explicit runtime APIs, and package-boundary examples as the main Solace identity.
   React-style means familiar TSX function components and event-driven UI composition, not a React
   compatibility layer or wholesale API clone. Future API work should harden Solace-owned JSX types,
   component event typing, slot ergonomics, and runtime primitive naming deliberately.
3. **Maintain the optional experimental SFC/Vite contract without syntax expansion**: keep the public surface limited to `@italone/solace/sfc`, `@italone/solace/vite`, Vite transform diagnostics, explicit `map: null`, and the documented `.solace` block model.
4. **Continue narrowing the router beta API without adding still-deferred features**: keep
   direct renderer-owned SSR/hydration integration, auth, and permissions deferred until separately
   designed; preserve the explicit readiness, server-context, and snapshot-verification workflow.
5. **Keep public API gates mandatory**: `pnpm release:readiness`, `pnpm package:smoke`,
   `pnpm stable:app`, `pnpm test:e2e`, and `pnpm test:e2e:devtools-extension` must run for public
   API changes.
6. **Harden the first DevTools extension panel without widening runtime payloads**: keep the
   current timeline UI local to `examples/devtools-extension`, add richer inspector views only after
   their event contracts are designed, run the browser extension QA checklist before release notes
   or demos, and keep SSR/SSG/hydration-specific panels deferred.
7. **Collect benchmark history** for jsdom and browser scenarios before making performance claims;
   regenerate `release/performance-history.json` and require five distinct `runAt` timestamps per
   scenario or task instead of treating repeated samples as independent runs.
