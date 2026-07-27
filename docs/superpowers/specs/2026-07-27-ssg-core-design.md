# SSG Core Design

## Goal

Add a small static-site generation core on top of the existing server renderer. The first pass should
turn explicit route definitions into in-memory HTML outputs without introducing a CLI, file-system
routing, Vite manifest integration, or a broader router contract.

This keeps SSG useful for tests, examples, and downstream tooling while avoiding a large public API
surface before SSR and hydration are more mature.

## Context

Solace now exposes `renderToString()` from `@italone/solace/server` and
`createApp(App).hydrate(container)` from the root package. The server renderer is DOM-free,
synchronous, and currently returns `{ html, styles: [] }` for VNode, component, or render-function
sources.

The roadmap places SSG after the SSR/hydration minimum loop. SFC/Vite syntax expansion, router
nested routes, guards, redirects, memory history, SSR router integration, streaming SSR, async SSR,
and DevTools extension UI remain deferred.

## Public API

Extend the existing server subpath:

```ts
import { generateStaticSite, renderToString } from "@italone/solace/server";
```

Initial API:

```ts
export interface StaticRoute {
  path: string;
  source: RenderToStringSource;
  context?: Record<string, unknown>;
  provides?: Provides;
}

export interface StaticPage {
  path: string;
  html: string;
  body: string;
  styles: string[];
}

export interface GenerateStaticSiteOptions {
  routes: StaticRoute[];
  shell?: (page: {
    path: string;
    body: string;
    styles: string[];
    context: Record<string, unknown>;
  }) => string;
}

export interface GenerateStaticSiteResult {
  pages: StaticPage[];
}

export function generateStaticSite(options: GenerateStaticSiteOptions): GenerateStaticSiteResult;
```

The API returns pages in memory. It does not write files, create directories, read a Vite manifest, or
infer routes from the file system. A future CLI or adapter can consume this core API and own
filesystem behavior separately.

## Route Model

Routes are explicit and ordered. Each route must provide:

- `path`: the output route path, such as `/`, `/about`, or `/docs/getting-started`.
- `source`: the same source accepted by `renderToString()`.

Optional route fields:

- `context`: route-local SSR context.
- `provides`: route-local app provides, passed through to `renderToString()`.

The first pass validates only the SSG-specific contract:

- `routes` must be a non-empty array.
- Each `path` must start with `/`.
- Duplicate paths are rejected.

Route normalization to physical filenames is deferred. Consumers can map `/about` to `about/index.html`
or another layout outside this API.

## Rendering Flow

For each route:

1. Call `renderToString(route.source, { context, provides })`.
2. Treat the returned `html` as the route body.
3. Pass body, styles, path, and context to `shell` when provided.
4. Return a `StaticPage` containing:
   - `path`
   - `body`
   - final document `html`
   - `styles`

When no `shell` is provided, the final document HTML equals the body. This keeps the core API useful
for fragments and tests while allowing applications to provide a full document shell.

## Error Handling

The initial behavior is fail-fast:

- Invalid route lists throw `TypeError`.
- Duplicate paths throw `TypeError`.
- Any `renderToString()` error propagates with route context added where practical.
- The API does not return partial success metadata.

Partial generation, per-route error collection, retries, and diagnostics reports are deferred until a
real CLI or adapter needs them.

## Asset And Style Boundary

The first SSG core does not integrate production assets:

- No Vite manifest reading.
- No preload tag generation.
- No bundled client entry inference.
- No automatic style tag rendering.

`styles` are preserved from `renderToString()` and passed to `shell`. Because `renderToString()`
currently returns an empty style list, the first implementation must keep this pass-through behavior
without pretending server-side style collection is complete.

## Router Boundary

The first SSG API does not add router features. Route paths are SSG output paths, not router records.
It does not introduce `createMemoryHistory()`, nested route support, guards, redirects, lazy route
components, scroll behavior, auth, permissions, or router hydration integration.

Applications that want router-aware SSG can build an app-local wrapper around explicit route sources
until the router SSR/SSG design is handled separately.

## Testing Strategy

Unit tests:

- Generates one page from a VNode source.
- Generates multiple pages in input order.
- Calls a shell function with path, body, styles, and context.
- Passes route `context` and `provides` through to `renderToString()`.
- Rejects empty route lists, paths that do not start with `/`, and duplicate paths.
- Propagates rendering failures with route path context when practical.

Package tests:

- Assert `generateStaticSite` is exported from `@italone/solace/server` for package-boundary imports.
- Extend packed-consumer smoke to import and call `generateStaticSite`.

Public API gates:

- `pnpm release:readiness`
- `pnpm package:smoke`
- `pnpm test:e2e`

Completion claims should also run the broader local gates already used for this repo:

- `pnpm quality`
- `pnpm release:check`

## Deferred Scope

- SSG CLI.
- Filesystem output.
- File-system routing.
- Vite manifest and asset injection.
- Router SSR/SSG integration.
- Server-side SFC style collection.
- Streaming, async SSR, and Suspense-like coordination.
- Hydration mismatch recovery.
- Browser DevTools extension UI.
