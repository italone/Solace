# SSR/SSG Manifest And Router-Aware Integration Design

## Goal

Add the first supported SSR/SSG integration layer for production asset manifests and router-aware SSG
without expanding the router beta into nested routes, guards, redirects, lazy routes, memory history,
auth, permissions, or router-aware hydration.

## Context

The current server package exposes:

- `renderToString(source, options)` returning `{ html, styles }`.
- `generateStaticSite({ routes, shell })` rendering explicit in-memory SSG routes.

Both APIs currently reject `manifest`, `clientEntry`, and `router` options. That has been useful as a
boundary while SSR/SSG/hydration stabilized, but the next practical integration step is small enough
to support without changing the renderer core:

- A manifest-to-assets helper that turns a Vite-like manifest and entry id into deterministic shell
  tags.
- A router-aware SSG adapter that converts current beta router route records into explicit
  `generateStaticSite()` route entries.

## Scope

This slice changes only server-side helper APIs and SSG composition:

- `src/server/generate-static-site.ts`
- `src/server/index.ts`
- Server unit tests and package contract type tests.
- Public docs for SSR/SSG usage.

The implementation should not modify renderer hydration, router navigation runtime, router history
adapters, `RouterView`, or `renderToString()` rendering semantics.

## Manifest Asset Helper

Add a helper exported from `@italone/solace/server`:

```ts
export type StaticAssetManifest = Record<
  string,
  {
    file: string;
    css?: string[];
    imports?: string[];
  }
>;

export interface StaticAssetTags {
  modulePreloads: string[];
  stylesheets: string[];
  scripts: string[];
}

export interface ResolveStaticAssetOptions {
  manifest: StaticAssetManifest;
  entry: string;
  base?: string;
}

export function resolveStaticAssets(options: ResolveStaticAssetOptions): StaticAssetTags;
```

Behavior:

- `entry` must exist in `manifest`.
- `base` defaults to `/` and is normalized to a single trailing slash.
- Imported chunks are visited before the entry chunk.
- CSS links are deduped while preserving first-seen order.
- JS chunk preloads are emitted for imported chunks.
- The entry chunk is emitted as the single module script.
- Output values are complete HTML tag strings, ready for a shell to place in `<head>` and body end.

Example output:

```ts
resolveStaticAssets({
  entry: "src/main.ts",
  manifest: {
    "src/main.ts": {
      file: "assets/main.js",
      css: ["assets/main.css"],
      imports: ["_vendor.js"],
    },
    "_vendor.js": {
      file: "assets/vendor.js",
      css: ["assets/vendor.css"],
    },
  },
});
```

returns:

```ts
{
  modulePreloads: ['<link rel="modulepreload" href="/assets/vendor.js">'],
  stylesheets: [
    '<link rel="stylesheet" href="/assets/vendor.css">',
    '<link rel="stylesheet" href="/assets/main.css">',
  ],
  scripts: ['<script type="module" src="/assets/main.js"></script>'],
}
```

The helper does not read files, inspect Vite config, infer entries, or mutate `renderToString()`.

## SSG Manifest Shell Integration

`generateStaticSite()` may accept optional app-level manifest options:

```ts
export interface GenerateStaticSiteOptions {
  routes?: StaticRoute[];
  shell?: (page: StaticShellPage) => string;
  manifest?: StaticAssetManifest;
  clientEntry?: string;
  base?: string;
}
```

When `manifest` and `clientEntry` are both present, each `shell` call receives:

```ts
assets: StaticAssetTags;
```

The default raw-body output remains unchanged when no shell is supplied. If a shell is supplied, it
decides where to place `assets.modulePreloads`, `assets.stylesheets`, `page.styles`, and
`assets.scripts`.

Rules:

- Supplying `manifest` without `clientEntry` throws a `TypeError`.
- Supplying `clientEntry` without `manifest` throws a `TypeError`.
- Route-level `manifest` and `clientEntry` remain unsupported and continue to throw.
- `renderToString()` still rejects manifest options; manifest composition belongs in SSG shells and
  helpers, not in the renderer.

## Router-Aware SSG Adapter

Add an adapter exported from `@italone/solace/server`:

```ts
export interface StaticRouterOptions {
  routes: RouteRecord[];
  paths: string[];
  context?: (route: RouteLocationNormalized) => Record<string, unknown>;
  provides?: (route: RouteLocationNormalized) => Provides;
}

export function createStaticRoutesFromRouter(options: StaticRouterOptions): StaticRoute[];
```

Behavior:

- Reuses the current beta router route records and matching behavior.
- `paths` is the explicit list of paths to render; the adapter does not crawl routes or infer dynamic
  params.
- Each path is resolved with the current beta router normalization and query parsing.
- If no route matches a path, the adapter throws a `TypeError` unless the user supplied a wildcard
  route that matches it.
- The rendered source for each path is the matched route component.
- Route context includes the normalized route by default:

```ts
{
  route;
}
```

- User `context(route)` output is shallow-merged after `{ route }`.
- User `provides(route)` output is passed through to `renderToString()` for that generated route.

This adapter intentionally does not install a router plugin into the SSR component tree. Components
rendered through this first adapter should receive route data through SSG `context`, app-level
provides, or explicit component closures. Full SSR `useRoute()` / nested `RouterView` support needs a
separate router SSR design.

## Non-Goals

- No `createMemoryHistory()`.
- No router-aware hydration.
- No `renderToString({ manifest })` support.
- No automatic route crawling.
- No nested route, guard, redirect, lazy route, scroll, auth, or permission work.
- No filesystem SSG output.
- No Vite plugin changes.

## Documentation

Docs should describe two supported patterns:

1. Use `resolveStaticAssets()` in an SSG shell to place production assets.
2. Use `createStaticRoutesFromRouter()` to convert current beta route records and an explicit path
   list into `generateStaticSite()` routes.

Docs should keep saying full router-aware SSR/hydration, memory history, filesystem output, route
crawling, nested routes, guards, redirects, and lazy route loading are deferred.

## Testing Strategy

Add tests first for:

- Manifest helper ordering, dedupe, base path normalization, missing entry errors, and recursive
  import traversal.
- `generateStaticSite()` passing asset tags into `shell` when `manifest + clientEntry` are provided.
- `generateStaticSite()` rejecting partial manifest options and route-level manifest options.
- Router-aware SSG adapter rendering explicit paths, passing normalized route context, supporting
  dynamic params and wildcard routes, and rejecting unmatched paths.
- Public contract type tests exposing only the intended helper APIs.

Minimum validation:

- `pnpm vitest run tests/unit/server/generate-static-site.test.ts tests/unit/server/render-to-string.test.ts tests/unit/router`
- `pnpm vitest run tests/unit/server/public-contract-types.test.ts`
- `pnpm typecheck`

Expanded validation when docs/package exports change:

- `pnpm build`
- `pnpm vitest run --config vitest.package.config.ts tests/integration/package-exports.test.ts`

## Risks

- Accepting `manifest` directly on `generateStaticSite()` could look like the renderer owns asset
  discovery. Keep manifest resolution helper-based and shell-owned.
- Router-aware SSG can be mistaken for full router SSR. The adapter must document that it renders
  matched components for explicit paths and does not install router state.
- Dynamic params require explicit concrete paths. The adapter should not attempt to synthesize
  `/users/:id` values.

## Acceptance Criteria

- `resolveStaticAssets()` produces deterministic modulepreload, stylesheet, and module script tags.
- `generateStaticSite()` can pass resolved assets into shells without changing raw-body output.
- `renderToString()` still rejects manifest and router integration options.
- `createStaticRoutesFromRouter()` converts beta route records and explicit paths into SSG routes.
- Router-aware SSG remains limited to static/dynamic/wildcard beta matching and does not add deferred
  router features.
