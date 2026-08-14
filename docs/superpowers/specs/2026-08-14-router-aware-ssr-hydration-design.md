# Router-Aware SSR And Hydration Design

**Date:** 2026-08-14

**Status:** Implemented locally and verified on 2026-08-14. The public SSR, SSG, and hydration
option contracts remain unchanged; router-aware workflows use the explicit composition described
below.

## Decision

Ship composable router settlement, canonical snapshot, and server-context primitives first. Do not
add a `router` field to `renderToString()`, `renderToStringAsync()`, `generateStaticSite()`,
`hydrate()`, or `hydrateAsync()`.

This keeps router navigation, server rendering, snapshot transport, and hydration recovery as
separate operations with explicit failure points. It also preserves the existing explicit-source
SSR and hydration APIs while enabling a package-only consumer to build a complete router-aware
workflow.

The canonical route snapshot is the only server-to-client router payload. A request-scoped server
context is built on `createMemoryHistory()`, and hydration verification remains an explicit step
before any renderer entry is called.

## Public Surface

### `router.isReady()`

Add the following method to the public `Router` interface:

```ts
isReady(): Promise<RouteLocationNormalized>;
```

`isReady()` starts the initial history navigation when it has not started yet and returns the same
in-flight promise to every concurrent caller. Initial redirects and global and route-level guards
must settle before the promise resolves. `install()` starts the same operation without making an
unhandled rejection, so `app.use(router); await router.isReady()` is the supported client sequence.

The method resolves to `currentRoute.value`. An initial guard that returns `false` rejects with a
`RouterNavigationError` whose type is `guard-cancelled`. Thrown or rejected guards and redirect
failures keep their existing `RouterNavigationError` forms; an invalid initial history location
rejects with a `TypeError`. None may produce a successful server snapshot. `install()` observes and
contains this rejection so it does not create an unhandled promise. The readiness promise is
single-use and remains rejected after failure; a later explicit `push()` or `replace()` is a separate
navigation. Those methods keep their current return types and cancellation behavior.

Initial readiness does not prepare lazy components. The existing buffered async render or hydration
path resolves the route component tree after navigation has settled.

### Snapshot primitives

Export `RouterSnapshot`, `RouteRecordIdentity`, `RouterHydrationError`, and all four snapshot
functions from the root package. Re-export the same surface from `@italone/solace/server` so a
server-only consumer does not need a second package entry import.

```ts
interface RouterSnapshot {
  readonly version: 1;
  readonly fullPath: string;
  readonly path: string;
  readonly params: readonly (readonly [string, string])[];
  readonly query: readonly (readonly [string, string | readonly string[]])[];
  readonly matched: readonly string[];
  readonly redirectedFrom?: string;
}

type RouteRecordIdentity = (
  record: RouteRecord,
  index: number,
  route: RouteLocationNormalized,
) => string;

createRouterSnapshot(
  route: RouteLocationNormalized,
  identifyRecord: RouteRecordIdentity,
): RouterSnapshot;

serializeRouterSnapshot(snapshot: RouterSnapshot): string;
parseRouterSnapshot(serialized: string): RouterSnapshot;
verifyRouterSnapshot(server: RouterSnapshot, client: RouterSnapshot): void;

class RouterHydrationError extends Error {
  readonly field:
    | "version"
    | "fullPath"
    | "path"
    | "params"
    | "query"
    | "matched"
    | "redirectedFrom";
  readonly serverSnapshot: RouterSnapshot;
  readonly clientSnapshot: RouterSnapshot;
}
```

The identity callback is required. Solace must not infer identity from object references, optional
route names, components, or relative child paths. It must return a non-empty, unique string for
every matched record. This keeps existing `RouteRecord` compatible and makes application-owned
snapshot stability explicit.

`params` and `query` use lexicographically sorted tuple arrays. Query array values retain their item
order, and the existing router contract continues to omit `null` and `undefined` query inputs.
`fullPath` is reconstructed from the normalized path and sorted query entries rather than copied
from input key order. `matched` keeps parent-to-child order. `redirectedFrom` contains only the
normalized initial location already recorded by the router; redirect chains, components, functions,
`meta`, and history objects are not transported.

### `createRouterServerContext()`

Export a server-only adapter:

```ts
interface RouterServerContextOptions {
  url: string;
  routes: RouteRecord[];
  identifyRecord: RouteRecordIdentity;
  configure?: (router: Router) => void;
  provides?: ReadonlyMap<string | symbol, unknown>;
}

interface RouterServerContext {
  router: Router;
  route: RouteLocationNormalized;
  snapshot: RouterSnapshot;
  provides: Map<string | symbol, unknown>;
}

createRouterServerContext(
  options: RouterServerContextOptions,
): Promise<RouterServerContext>;
```

Export `createRouterServerContext()` only from `@italone/solace/server`.

The adapter creates a new `createMemoryHistory(url)` and router for every call, invokes the
synchronous `configure` callback so the application can register global guards, waits for
`router.isReady()`, creates the canonical snapshot, and returns a cloned injection map containing
the settled router and route values. It does not render HTML, discover routes, write files,
serialize the snapshot, or mutate the caller's injection map.

The adapter rejects a thenable returned from `configure` with a `TypeError`; asynchronous route data
and loaders are outside this slice. After cloning the caller's map, it overwrites only Solace's
private router and route injection keys with the request-scoped values.

The adapter does not accept `scrollBehavior`, so request-side settlement cannot execute browser
scroll code. Route-level guards and redirects remain part of settlement. Applications must not put
request secrets in route params or query values they intend to serialize.

## Server Data Flow

For each request, the consumer:

1. Calls `createRouterServerContext()` with the request URL, route table, record identity callback,
   and optional guard configuration.
2. Passes the returned `provides` to `renderToStringAsync()` with the application root source.
3. Serializes the returned snapshot with `serializeRouterSnapshot()` and embeds the escaped text in
   a non-executable `application/json` script element owned by the application shell.
4. Discards the request router, route, and provides after the response completes.

The server renderer reads an already-settled route from injections. It never performs a second
implicit navigation. SSG may repeat the same explicit flow for known URLs, but this slice does not
replace `createStaticRoutesFromRouter()` or add route crawling.

## Client Data Flow

The browser consumer:

1. Parses the embedded payload with `parseRouterSnapshot()`.
2. Creates the browser router, registers the same guards and route records, and installs it on the
   app.
3. Awaits `router.isReady()` before calling any hydration method.
4. Creates a client snapshot with the same identity callback and calls `verifyRouterSnapshot()`.
5. Calls `app.hydrateAsync(container)` only after verification succeeds.

This ordering is required because `hydrateAsync()` prepares async components before touching the
DOM. Verification outside the renderer therefore prevents both component setup and DOM effects
when the route does not match the server snapshot.

## Serialization And Validation

`serializeRouterSnapshot()` first validates the exact version-1 shape, then emits JSON with stable
field and tuple ordering. It escapes `<`, `>`, `&`, U+2028, and U+2029 so its output cannot terminate
an HTML script container or introduce executable markup.

`parseRouterSnapshot()` accepts only a string containing one exact version-1 object. It rejects
malformed JSON, unknown or missing fields, invalid tuple/value types, duplicate params, query keys,
or matched identities, non-normalized paths, and unsupported schema versions. Parsed data is copied
into fresh arrays and objects; prototype-bearing input is never returned as application state.

`verifyRouterSnapshot()` compares version, canonical full path, path, params, query, ordered matched
identities, and redirect provenance. A mismatch throws `RouterHydrationError` with a stable field
code and the validated server and client snapshots. The error does not include route records,
components, `meta`, provides, or arbitrary application context.

## Failure And Recovery

The default behavior fails closed:

- navigation errors reject `isReady()` or `createRouterServerContext()`;
- malformed or unsupported payloads fail during parsing;
- route differences fail during snapshot verification;
- DOM differences continue to use the existing `SolaceHydrationError` behavior.

This slice does not automatically navigate, clear DOM, or mount on a snapshot mismatch. An
application that opts into recovery must catch `RouterHydrationError`, choose a target navigation,
clear the server DOM, and perform a fresh client mount. Existing `{ recover: true }` remains limited
to DOM hydration mismatches after route verification; it must not hide router snapshot mismatches.

## Compatibility Boundaries

The current runtime errors remain compatibility guards:

- `Router-aware SSR integration is deferred`
- `Router-aware SSG integration is deferred`
- `Router-aware hydration integration is deferred`

Passing `router` directly to existing SSR, SSG, or hydration options remains a type and runtime
error. Existing synchronous return types, explicit sources, `context`, `provides`, and hydration
`recover` behavior remain unchanged.

This slice explicitly excludes auth, permissions, streaming, Suspense, selective hydration, route
loaders, route crawling, filesystem output, deployment adapters, and automatic recovery. Route
`meta` remains application data and is not security enforcement.

## Test Strategy

Unit and type-contract tests must cover:

- single-flight `isReady()`, install-before-wait and wait-before-install, redirects, guards,
  cancellation, invalid initial history, and concurrent calls;
- server request isolation, guard configuration, injected router/route values, provides cloning,
  redirects, failures, and absence of scroll behavior;
- snapshot sorting, query null/array distinctions, identity failures, serialization escaping,
  malformed input, unknown fields, version rejection, and field-specific mismatches;
- continued rejection of direct router options and unchanged explicit SSR/hydration signatures.

The packed TypeScript consumer must import only package exports and exercise the full sequence:
server context creation, async render, snapshot serialization, browser-style router readiness,
snapshot verification, and async hydration. It must not use source aliases.

Browser tests in Chromium, Firefox, and WebKit must prove that matching routes reuse server DOM and
that mismatched location or matched identity fails before component setup and DOM mutation. A
separate explicit-recovery case must show application-owned fresh mount behavior without changing
the default contract.

## Acceptance Criteria

- Two concurrent server contexts cannot observe or mutate each other's router state.
- Server redirects and guards settle before component setup or HTML generation.
- Matching client navigation verifies before async component preparation and reuses server DOM.
- Snapshot payloads are deterministic, escaped, schema-validated, and contain no live route data.
- A router mismatch is structured and fail-closed; DOM mismatch recovery remains separate.
- Root, server, package-export, packed-consumer, English/Chinese documentation, and release gates
  agree on the public contract.
- No direct router option, auth, permissions, streaming, Suspense, crawler, or filesystem API is
  introduced.
