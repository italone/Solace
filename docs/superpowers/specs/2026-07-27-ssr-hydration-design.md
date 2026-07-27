# SSR Hydration Design

## Goal

Add the first Solace SSR and hydration design around a small, testable public contract. The target is
an SSR + hydration minimum loop: render a Solace tree to HTML on the server, send that HTML to the
browser, then let the client attach Solace behavior to the existing DOM without recreating it.

This design does not implement a full application framework, streaming renderer, file-system router,
data loader protocol, nested router support, browser DevTools extension UI, or production deployment
adapter.

## Context

Solace currently has:

- A DOM renderer built around `patch()`, `document.createElement`, DOM prop patching, and scheduler
  updates.
- Function components that resolve through `setupComponent()` and render VNodes.
- Lifecycle hooks that run during DOM mount/update/unmount.
- An alpha `.solace` compiler and `@italone/solace/vite` plugin that currently generate client
  component modules and inject scoped styles at runtime.
- A beta router first slice with web/hash browser history, query parsing, route matching, `RouterLink`,
  `RouterView`, `useRouter`, and `useRoute`.
- Package export gates for public subpaths and mandatory public API checks through
  `release:readiness`, `package:smoke`, `test:e2e`, and `release:check`.

The current DOM renderer cannot be reused directly in Node because it depends on browser globals.
SSR should therefore start as a separate server renderer that consumes VNodes and components, not as a
DOM renderer running in a simulated document.

## Public API

Add a new public package subpath:

```ts
import { renderToString } from "@italone/solace/server";
```

The initial server API should be:

```ts
export interface RenderToStringOptions {
  context?: Record<string, unknown>;
}

export interface RenderToStringResult {
  html: string;
  styles: string[];
}

export function renderToString(
  source: VNode | ComponentType | (() => VNode),
  options?: RenderToStringOptions,
): RenderToStringResult;
```

The initial hydration API should be exported from the root package:

```ts
createApp(App).hydrate(container);
```

`createApp(App).mount(container)` remains the client-only rendering path. Hydration should be an
explicit method so applications and tests cannot accidentally hydrate when they expect a fresh mount.

The initial SFC/Vite public API does not change. `.solace` syntax remains limited to one
`<template>`, optional `<script>`, optional `<style>`, JSX-like braces, Vite transform diagnostics,
and `map: null`.

## Server Renderer

Create a server renderer that serializes VNodes without touching DOM globals:

- Text children are HTML-escaped.
- Element tags and attribute names are validated against the current VNode shape.
- String, number, and boolean-ish attributes are serialized predictably.
- Event props such as `onClick` are omitted from HTML.
- `class`, `style`, `id`, `data-*`, `aria-*`, and normal attributes are preserved.
- Fragments serialize their children without wrapper elements.
- Function components are executed to obtain their render output.

Server rendering must not call DOM lifecycle hooks:

- `onMounted` does not run on the server.
- `onUpdated` does not run on the server.
- `onUnmounted` does not run on the server.

The server renderer may support synchronous components only in the first pass. Async components,
Suspense-like behavior, and streaming remain deferred.

## Hydration

Hydration should attach Solace behavior to existing DOM instead of recreating it. The first hydration
pass should support:

- Element VNodes with matching tags.
- Text children.
- Fragment children.
- Function components that produce stable initial VNodes.
- Event listener attachment for props such as `onClick`.
- Reactive updates after hydration through the existing scheduler and DOM patch path.

Hydration should fail loudly when the server HTML and client VNode tree are structurally incompatible.
The initial mismatch policy should throw a `SolaceHydrationError` with the component or node context
available when practical. Silent best-effort patching is deferred because it can hide correctness
bugs in a small framework.

After hydration completes, later updates should reuse the existing DOM renderer and normal patching
semantics.

## App API Integration

Extend the app object with:

```ts
interface App {
  mount(container: Element): void;
  hydrate(container: Element): void;
  use(plugin: Plugin, options?: unknown): App;
  provide<T>(key: InjectionKey<T>, value: T): App;
}
```

`hydrate(container)` should mirror `mount(container)` for plugin/provide behavior:

- It uses the same root component or VNode.
- It passes app-level provides into component setup.
- It installs reactive rendering so later state updates patch normally.
- It marks the container's current VNode state so the next render updates instead of remounting.

`mount()` should not change behavior.

## SFC And Style Handling

SFC style handling needs a hydration-safe policy before implementation:

- Server rendering should collect scoped styles into `RenderToStringResult.styles`.
- Client hydration should avoid injecting duplicate scoped style tags when an equivalent
  `data-s-id` style already exists.
- The existing `@italone/solace/vite` plugin remains the only public `.solace` execution entry.
- Generated JavaScript shape remains private and may change to support style collection.

The first pass may support style collection for `.solace` files compiled by the Solace Vite plugin
only after the server renderer and plain component hydration tests pass.

## Router Boundary

Browser history adapters remain browser-only:

- `createWebHistory()` keeps using `window.location`.
- `createWebHashHistory()` keeps using `window.location.hash`.

SSR needs a server-safe initial location, but adding a general public `createMemoryHistory()` would
expand the router beta surface. The first design should use one of these narrow options:

- Accept an initial URL through `renderToString(..., { context })` and let the app create a
  test-local history object that implements `RouterHistory`.
- Add a server-only helper under `@italone/solace/server` after the public API is reviewed.

The first implementation should not add nested routes, route guards, redirects, lazy routes, scroll
behavior, auth routing, permission routing, or a public root-package `createMemoryHistory()`.

## Package Exports

Add a new public export only after implementation tests define the contract:

```json
"./server": {
  "types": "./dist/server.d.ts",
  "import": "./dist/server.js",
  "require": "./dist/server.cjs"
}
```

Package export tests must assert:

- `@italone/solace/server` exists for ESM and CJS.
- `renderToString` is exported.
- Browser-only renderer internals are not exported from `@italone/solace/server`.
- Private deep subpaths remain rejected.

Packed-consumer smoke must import `renderToString` from the packed tarball.

## SSG Boundary

SSG should be built on top of `renderToString()` after SSR/hydration is working. The first SSG design
should be a separate project that can decide:

- Route list input.
- Output directory.
- HTML shell behavior.
- Asset manifest integration.
- Per-route error handling.

No SSG CLI should be added in the SSR/hydration first pass.

## Testing Strategy

Unit tests:

- Server renderer escapes text and attributes.
- Server renderer omits event props.
- Server renderer serializes elements, fragments, and function components.
- Server renderer does not call mounted/updated/unmounted hooks.
- Hydration attaches event handlers to existing DOM.
- Hydration throws on structural mismatch.
- Hydrated state updates patch through the existing scheduler.

Integration tests:

- Render a small app to HTML, assign it to a jsdom container, hydrate it, click a button, and verify
  the DOM updates.
- Verify app-level provide/inject works across server render and hydration.
- Verify router usage can be tested with an explicit server-safe history object without adding
  public `createMemoryHistory()`.

Package tests:

- Build ESM, CJS, and type declaration output for `@italone/solace/server`.
- Verify ESM and CJS imports from the server subpath.
- Extend packed-consumer smoke to import `renderToString` and render a basic component.

E2E tests:

- Add browser e2e only after jsdom hydration integration tests are stable.
- Keep `pnpm test:e2e` mandatory for public API changes.

## Deferred Scope

The following remain out of scope for the first SSR/hydration pass:

- Streaming SSR.
- Async component SSR.
- Suspense-like coordination.
- Data loader protocol.
- File-system routing.
- Static generation CLI.
- Nested route SSR.
- Route guards and redirects.
- Public root-package memory history.
- Hydration mismatch recovery.
- Production asset manifest integration.
- Browser DevTools extension UI.

## Risks

- Hydration can expose differences between generated client code and server-rendered HTML.
- Running lifecycle hooks during SSR would make server output depend on browser-only assumptions.
- Adding root-package memory history too early would expand the router beta contract before nested
  routes and SSR routing needs are clear.
- SFC runtime style injection can duplicate styles unless server collection and client dedupe are
  designed together.
- A best-effort hydration mismatch policy can hide server/client divergence.

## Acceptance Criteria

- The SSR public entry is limited to `@italone/solace/server`.
- `renderToString()` serializes basic VNodes and synchronous function components without DOM globals.
- Server rendering does not run mounted, updated, or unmounted hooks.
- Hydration attaches behavior to existing DOM and supports later reactive updates.
- Hydration mismatch behavior is explicit and tested.
- SFC/Vite syntax does not expand in this pass.
- Router beta scope does not expand with nested routes, guards, redirects, lazy routes, scroll
  behavior, auth, permissions, or root-package memory history.
- SSG and browser DevTools extension UI remain separate follow-up projects.
- `pnpm release:readiness`, `pnpm package:smoke`, `pnpm test:e2e`, `pnpm quality`, and
  `pnpm release:check` pass before claiming implementation completion.
