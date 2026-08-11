# Solace 0.1 Stable Real-App Validation Design

**Date:** 2026-08-11  
**Status:** Approved direction, written specification pending user review  
**Target:** Validation and compatibility work before `0.1` stable

## Summary

Before `0.1` stable, Solace will gain one repository-owned medium-sized application and a
packed-package validation path built around that same application. The application will exercise a
coherent operations workflow rather than collect disconnected API demonstrations. It will validate
package consumption, an upgrade from the published `0.1.0-beta.2` baseline, routing, error recovery,
SSR, SSG, and hydration without widening any deferred framework contract.

The work also defines a compatibility and deprecation policy for documented public package entries.
The policy treats `0.1.x` as one compatibility line, keeps public entry paths resolvable throughout
that line, and reserves documented breaking removals for `0.2.0` or later.

## Goals

- Maintain one inspectable, realistic application that uses only documented Solace package entries.
- Build and typecheck the application against a locally packed candidate package.
- Demonstrate that an application written against the published `0.1.0-beta.2` contract can move to
  the local stable candidate without rewriting its existing core workflow.
- Cover a representative SPA route tree, shared state, async failure recovery, explicit SSR/SSG
  routes, matching hydration, and explicit mismatch recovery.
- Run the core browser journey in Chromium, Firefox, and WebKit.
- Define which public surfaces receive compatibility protection and how deprecations progress.
- Add lasting release evidence rather than a one-time manual demo.

## Non-Goals

- Router-aware SSR, router-aware SSG, or router-aware hydration.
- Streaming SSR, Suspense, selective hydration, or automatic filesystem SSG in the framework.
- Router authentication or permissions APIs.
- A first-party UI component library, design system package, or third-party UI adapter.
- SFC syntax expansion or making SFC the application authoring model.
- Production DevTools distribution or new DevTools payloads.
- External backend integration, credentials, persistent databases, or network-dependent fixtures.
- Changing the package version, publishing, committing, pushing, or tagging as part of this slice.

## Chosen Approach

The repository will contain a permanent example application and use its source as the fixture for a
temporary packed consumer.

This combines two kinds of evidence:

1. The permanent application remains readable, runnable, and covered by browser E2E tests.
2. The temporary consumer proves that the same source typechecks and builds from the package
   tarball instead of relying on repository TypeScript path mappings or Vite source aliases.

A generated-only fixture would be difficult to inspect and maintain. Expanding the existing small
examples would blur their focused teaching purpose and still would not prove a cross-feature
adoption workflow.

## Application Product Shape

The application is an **Operations Console** for reviewing service incidents and release activity.
It uses deterministic in-memory fixtures so the validation remains reproducible and offline after
dependencies are installed.

The first viewport is the working application, not a landing page. The interface is quiet and
work-focused: a compact application header, persistent navigation, summary metrics, searchable
incident rows, status controls, and an audit timeline. It uses app-owned CSS, restrained neutral
surfaces, status colors with text labels, visible focus states, and responsive layout behavior. It
does not introduce a reusable framework UI library.

### Primary Routes

| Route               | Purpose                                                       | Public capabilities exercised                 |
| ------------------- | ------------------------------------------------------------- | --------------------------------------------- |
| `/`                 | Operational overview with summary counts and recent incidents | components, computed state, store             |
| `/incidents`        | Searchable incident queue with status updates                 | reactive forms, keyed lists, store actions    |
| `/incidents/:id`    | Incident detail and audit entries                             | dynamic params, route props, named navigation |
| `/releases`         | Lazily loaded release activity panel                          | `lazyRoute()`, async component loading        |
| `/legacy-incidents` | Redirect compatibility path                                   | route redirect                                |
| fallback            | Not-found state with route back to the queue                  | wildcard route, `RouterLink`                  |

The route tree uses web-hash history in the permanent example to avoid server fallback requirements.
It uses documented metadata only for display labels. No route record implies an authentication or
permission boundary.

### Shared State

One app-owned store owns incidents and release records shared across routes. Feature-local state,
such as the queue search query and selected filter, stays in the feature component. Derived counts
use computed values. Fixture access is exposed through a small app-local service boundary so failure
scenarios can be deterministic without embedding test switches throughout page components.

### Error Recovery

The application validates two existing public recovery paths:

- The release activity panel uses `defineAsyncComponent()` with a loader that fails once, one
  configured retry, and a deterministic retry delay. The normal UI transitions from loading to the
  successfully resolved panel. A separate exhausted-retry fixture verifies the documented error
  component without inventing a framework Error Boundary.
- The hydration page verifies strict mismatch failure and explicit `{ recover: true }` replacement.
  The page exposes the recovered interactive state through user-visible output, not private runtime
  fields.

Router lazy-load failures remain covered by router-focused tests. The real application does not add
an app-level retry API that Solace does not currently provide.

## Source Architecture

The application will live under `examples/operations-console/` and keep files grouped by ownership:

```text
examples/operations-console/
  index.html
  hydration.html
  vite.config.ts
  src/
    app/
      App.tsx
      router.ts
      store.ts
    features/
      overview/
      incidents/
      releases/
    shared/
      fixtures.ts
      layout.tsx
      styles.css
    entries/
      client.tsx
      hydration.tsx
      server-core.tsx
      server-async.tsx
```

`App.tsx` owns shell composition only. Feature folders own pages and feature-local behavior.
`server-core.tsx` exports rendering functions that use the contract shared with published beta.2.
`server-async.tsx` adds candidate-only async rendering checks. Neither entry writes files or creates a
new Solace server abstraction. The validation script owns temporary directories, package
installation, build orchestration, and any generated HTML output.

The local Vite config follows existing examples and aliases documented package entries to `src/**`
for repository development. The packed-consumer path removes those aliases and resolves the same
imports from the installed tarball.

## Rendering Boundaries

The design deliberately keeps three rendering paths explicit.

### SPA

`client.tsx` mounts the routed Operations Console. It validates the route tree, store-driven updates,
forms, keyed rows, redirects, lazy loading, and browser navigation.

### SSR And SSG

`server-core.tsx` imports `renderToString()` and `generateStaticSite()` from
`@italone/solace/server`. `server-async.tsx` imports `renderToStringAsync()` and
`generateStaticSiteAsync()` for the additive candidate scenario. Both render explicit overview and
incident-summary sources. SSG receives an explicit route array and an app-owned shell. Neither entry
passes a router into the server APIs.

The packed validation calls the core server functions for both versions and the async functions for
the local candidate, then asserts paths, body HTML, styles, and asset placement. Filesystem output,
when needed for browser serving, remains a validation-script adapter rather than a framework feature.

### Hydration

`hydration.tsx` hydrates a dedicated server-rendered incident summary. It verifies matching node
reuse, event attachment, and subsequent reactive updates. A separate recovery fixture starts from
known mismatched markup and calls hydration with `{ recover: true }`.

The routed SPA and hydration fixture may share presentational components and data, but they do not
share a root or claim router-aware hydration support.

## Packed Consumer And Upgrade Validation

A new repository script will create isolated temporary consumers and always clean them up in a
`finally` block.

### Local Candidate Path

1. Build Solace and create one tarball with `pnpm pack`.
2. Copy the Operations Console source into a temporary consumer.
3. Generate consumer-local package and TypeScript configuration without source aliases.
4. Install the local tarball with scripts disabled.
5. Typecheck the application.
6. Build the SPA and hydration entries with Vite.
7. Build the core and async server entries and execute their SSR/SSG assertions against the installed
   package.
8. Verify expected output assets and reject imports from private or undeclared subpaths.

The script must use explicit paths, surface child-process failures, and leave no generated repository
diff.

### Published Baseline Upgrade Path

An explicit upgrade command runs the existing core application contract twice:

1. against pinned `@italone/solace@0.1.0-beta.2` from npm;
2. against the locally packed candidate.

The baseline consumer uses a generated TypeScript/build include list that excludes
`server-async.tsx`; all other core application source remains identical. Candidate-only async
rendering checks run after the upgrade and are treated as additive capability validation. The
comparison is based on the same user-observable assertions, not byte-for-byte bundle output.

The local candidate validation is suitable for the normal release gate. The registry-backed baseline
command is a stable-release preparation gate and must report network or registry failure distinctly
from an application compatibility failure.

## Browser Validation

The permanent application joins the ordinary Playwright configuration and therefore runs in
Chromium, Firefox, and WebKit. DevTools extension tests remain in their Chromium-only configuration.

High-value E2E journeys are:

1. Open the overview, navigate to the incident queue, filter rows, and update an incident status.
2. Open a dynamic incident detail route, verify route props, return through named navigation, and
   follow the legacy redirect.
3. Visit the release activity route and observe successful recovery from the deterministic first
   load failure.
4. Open the server-rendered hydration page, verify node reuse and an interactive update.
5. Open the mismatch fixture and verify explicit recovery produces the expected interactive tree.

Tests use roles, labels, and stable application identifiers. They wait on observable conditions and
do not use fixed sleeps.

## Compatibility Policy

The policy will be published in English and Chinese and linked from the README, API reference,
package usage guide, project status, and release guide.

### Protected Entry Paths

The documented entries are:

- `@italone/solace`
- `@italone/solace/jsx-runtime`
- `@italone/solace/jsx-dev-runtime`
- `@italone/solace/devtools`
- `@italone/solace/server`
- `@italone/solace/sfc`
- `@italone/solace/vite`
- `@italone/solace/package.json`

These paths remain resolvable throughout the `0.1.x` line. `src/**`, `dist/**`, undeclared deep
subpaths, generated file layout, and runtime internals remain outside the contract.

### Compatibility Line

- `0.1.x` is one compatibility line even though the package remains below `1.0.0`.
- Patch releases may fix bugs and add APIs, but do not remove documented exports or intentionally
  break documented stable behavior.
- Breaking removals or signature changes target `0.2.0` or later.
- Router and async rendering can retain beta labels, while SFC/Vite can retain experimental labels;
  those labels describe maturity, not permission to silently remove their documented package paths.
- Tightening behavior for inputs already documented as invalid is not a compatibility break.
- Exact error messages are protected only where documentation explicitly makes them contractual.
  Documented error classes, error kinds, and field-specific `TypeError` behavior remain protected.
- Pre-release versions may evolve before `0.1.0`, but release notes must include migration guidance
  for changes to already documented beta APIs.

### Deprecation Process

A deprecation must include all of the following in one synchronized change:

1. Mark the API deprecated in types when TypeScript can expose the marker.
2. Document the replacement and migration example in English and Chinese.
3. Add a changeset and release-guide entry describing the first deprecated version.
4. Keep package export, consumer smoke, and behavior coverage for the deprecated path.
5. Retain the deprecated API for at least one published `0.1.x` release before removal.
6. Remove it only at the next documented breaking boundary, no earlier than `0.2.0`.

A severe security or correctness issue may require faster action. That exception must be called out
prominently in release notes with the safest available migration.

## Documentation Changes

Implementation will add `docs/compatibility.md` and `docs/compatibility.zh-CN.md`, then synchronize:

- `readme.md` and `readme.zh-CN.md`
- `docs/api.md` and `docs/api.zh-CN.md`
- `docs/package-usage.md`
- `docs/project-status.md` and `docs/project-status.zh-CN.md`
- `docs/release.md`
- `docs/examples.md`
- `docs/roadmap.md`

Documentation tests will assert entry lists, the `0.1.x` compatibility line, the earliest `0.2.0`
removal boundary, the minimum deprecation window, and the distinction between public entries and
private deep paths.

## Validation Matrix

| Risk                             | Evidence                                                                               |
| -------------------------------- | -------------------------------------------------------------------------------------- |
| App component and store behavior | focused Vitest integration tests where browser E2E alone would hide failure detail     |
| Router workflow                  | Operations Console Playwright journey plus existing router unit/integration tests      |
| Async recovery                   | focused async-component assertion and browser-observable recovered panel               |
| SSR/SSG                          | packed consumer executes app server output and asserts HTML, styles, paths, and assets |
| Hydration                        | browser node-reuse/update journey, mismatch recovery journey, existing hydration tests |
| Package consumption              | tarball install, typecheck, client build, server build, public/private boundary smoke  |
| Upgrade                          | pinned beta.2 core workflow followed by the same local-candidate workflow              |
| Compatibility policy             | English/Chinese documentation contract tests and package export tests                  |
| Cross-browser behavior           | Chromium, Firefox, and WebKit ordinary E2E projects                                    |
| Release readiness                | `pnpm quality`, `pnpm test:coverage`, packed app validation, and `pnpm release:check`  |

The implementation plan will introduce focused checks first, then run the full release gate after all
tracked files and generated-output behavior are stable.

## Acceptance Criteria

- The permanent Operations Console is feature-structured and materially larger than the existing
  single-purpose examples.
- Its core user journey passes in Chromium, Firefox, and WebKit.
- Matching hydration reuses the server node and remains reactive after hydration.
- Explicit recovery replaces known mismatched markup and remains interactive.
- Deterministic async loading demonstrates successful retry and an exhausted error state.
- The same application source typechecks and builds against a local package tarball with no source
  aliases.
- SSR and SSG execute from the packed package and return expected route output.
- The pinned beta.2 core scenario and local candidate scenario both pass, with additive candidate
  checks kept separate.
- Public entry compatibility and deprecation policy exists in English and Chinese and is enforced by
  documentation/package tests.
- Node 20/22 CI and ordinary Chromium/Firefox/WebKit coverage remain intact; DevTools stays
  Chromium-only.
- `pnpm release:check`, `git diff --check`, and `pnpm format:check` pass with no tracked generated
  output.

## Deferred Follow-Up

Results from this application may justify later proposals, but this slice will not implement them.
Candidates include router-aware SSR/hydration, a production DevTools distribution, app-level data
fetching conventions, or a broader error-boundary design. Each requires its own design and public
contract review.
