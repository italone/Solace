# Router-Aware SSG Design

Date: 2026-09-01
Status: approved (conversation)

## Purpose

`generateStaticSiteAsync()` statically renders explicit-path routes, but each route's source is
rendered router-less: pages cannot reflect route state and client hydration cannot use the
verify-before-hydrate snapshot flow. The async SSR entries (`renderToStream`,
`renderToStringAsync`) already accept a renderer-owned `router` option; SSG is the last async
surface without it.

## API

`AsyncStaticRoute` gains an optional `router` field:

```ts
interface RouterSSGOptions {
  routes: RouteRecord[];
  identifyRecord: RouteRecordIdentity;
  configure?: (router: Router) => void;
}

interface AsyncStaticRoute extends Omit<StaticRoute, "source"> {
  source: RenderToStringAsyncSource;
  router?: RouterSSGOptions; // new; note: no `url` — the route's `path` is the url
}
```

- The route's existing `path` doubles as the router `url`. No separate `url` field (rejects with
  the standard unknown-field `TypeError` if supplied).
- Implementation: for a route with `router`, delegate to
  `renderToStringAsync(route.source, { router: { url: route.path, routes, identifyRecord,
configure } })`. The serialized snapshot script (`script#__solace-router-snapshot`) is appended
  to the rendered `body`, byte-identical to the SSR path. Routes without `router` render exactly
  as today.
- Asset injection stays unchanged: SSG resolves `manifest` + `clientEntry` into shell `assets`;
  the per-route render does NOT pass them (no double emission).
- Client pairing is the existing `hydrateAsync(container, { router, routerIdentifyRecord })`.
- Synchronous `generateStaticSite()` keeps rejecting a `router` field on both options and routes,
  matching the SSR sync-entry policy.

## Validation

- `router` on an async route must be an object with exactly `routes`/`identifyRecord`/`configure`
  (`configure` optional, function); unknown fields throw the existing field-specific `TypeError`
  via `assertRouterSSROption` extended to allow a missing `url` when the caller supplies it.

## Testing

- Unit: async SSG with a `router` route produces a body containing the router snapshot script and
  route-driven content; pages without `router` unchanged; sync SSG still rejects `router`;
  invalid router shapes throw; `path` duplication check still applies.
- Integration-style: snapshot emitted by SSG is accepted by `parseRouterSnapshot` and matches
  `verifyRouterSnapshot` against the same client route records (verify-before-hydrate pairing).

## Contract impact

Minor bump: new optional field on an existing beta surface (`@italone/solace/server`). Docs
(`docs/api.md`, `docs/api.zh-CN.md` SSG sections), roadmap note, and changeset updated together.

## Out of scope

Route crawling, filesystem output, redirect-following enumeration, per-route guards beyond what
the router settle already runs, and sync-entry router support.
