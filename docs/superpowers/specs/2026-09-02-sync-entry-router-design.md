# Sync-Entry Router Options Design

Date: 2026-09-02
Status: approved (conversation)

## Purpose

The async SSR/SSG entries (`renderToStringAsync`, `renderToStream`, `generateStaticSiteAsync`)
accept a renderer-owned `router` option; the synchronous entries (`renderToString`,
`generateStaticSite`) reject it with a deferred-integration `TypeError` whose rationale was
"sync APIs cannot await readiness". Router readiness only lacks a synchronous path — this
design adds one.

## API

### 1. Router core: synchronous settlement

`src/router/router.ts` gains a synchronous initial-settlement fast path on the router instance
(naming follows the existing `isReady()` — `isReadySync()`):

- Runs the same initial settlement logic as `startInitialSettlement` but without `await`:
  guards are invoked in order; a guard whose result is a thenable throws `TypeError`
  ("Synchronous router settlement requires synchronous guards; use the async SSR entry").
- Synchronous guard semantics are unchanged: `false` cancels, an error/redirect value
  redirects, `undefined`/`true` continues.
- Redirects are followed synchronously, reusing the existing 16-iteration loop limit; the
  final landing route is the settled route.
- Lazy route components are not preloaded (same as the existing async initial settlement).
- After settlement, `currentRoute` is readable synchronously and canonical snapshots can be
  built with the existing `createRouterSnapshot`.

### 2. Server assembly

`src/server/router-ssr.ts` gains `resolveRouterSSRSync(options: RouterSSROptions)` mirroring
`createRouterServerContext`: `createMemoryHistory(url)`, `createRouter`, sync-only
`configure?.(router)`, `isReadySync()`, then the same `provides` map (`routerKey`, `routeKey`)
and the same canonical snapshot. Validation reuses `assertRouterSSROption`.

### 3. Entry contracts

- `renderToString(source, options)` accepts `router: { url, routes, identifyRecord,
configure? }`. The resolved `provides` map replaces `options.provides` exactly as in
  `renderToStringAsync` (combining `router` with `provides` keeps throwing), and the rendered
  html gets the byte-identical snapshot script (`script#__solace-router-snapshot`,
  `window.__SOLACE_ROUTER_SNAPSHOT__=...`).
- `generateStaticSite()` accepts route-level
  `router?: { routes, identifyRecord, configure? }` (the route's `path` is the url, no `url`
  field; unknown fields throw the existing field-specific `TypeError`), delegating to
  `renderToString(route.source, { router: { url: route.path, ...route.router } })`. The shape
  is symmetric with `generateStaticSiteAsync`. The top-level `router` option on
  `generateStaticSite()` keeps its existing rejection.
- `hydrate()` router restrictions are unchanged; client pairing for sync-rendered router pages
  is `hydrateAsync(container, { router, routerIdentifyRecord })`.

## Testing

- Router core: all-sync guards settle; sync redirect chain follows to the landing route (and
  the loop limit still throws); `false` guard cancels; thenable guard result throws the
  `TypeError`; `isReadySync` does not preload lazy components.
- Server: `resolveRouterSSRSync` provides map contains router/route keys; snapshot identical to
  the async path for the same records/url.
- Entries: `renderToString` with `router` injects route state and appends the snapshot script;
  output html equals the async entry's body byte-for-byte for the same sync tree;
  router+provides still rejected; unknown router fields rejected; `generateStaticSite`
  route-level router works and top-level router still rejected; `parseRouterSnapshot` +
  `verifyRouterSnapshot` accept the emitted snapshot (verify-before-hydrate pairing).

## Contract impact

Minor bump: new optional `router` option on two existing beta surfaces (`@italone/solace/server`
exports), new sync-settlement capability on the router instance. Docs (`docs/api.md`,
`docs/api.zh-CN.md` SSR/SSG + router sections), roadmap, and changeset updated together.

## Out of scope

Async guards on the sync path (by definition), lazy-component preloading during settlement,
sync-entry hydration pairing changes, and route crawling / filesystem output for SSG.
