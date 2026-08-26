# Renderer-Owned Router Design

**Status:** Approved design, pending implementation plan
**Date:** 2026-08-26
**Depends on:** composable router-aware SSR/hydration (2026-08-14 design, merged), out-of-order streaming SSR (merged 2026-08-25), Suspense/selective hydration (merged 2026-08-26)
**Sub-project:** 3 of 4 SSR capability gaps (out-of-order streaming ✅ → Suspense/selective hydration ✅ → **renderer-owned router** → automated production SSR pipeline)

## Goal

Let the SSR renderers and client hydration own the router boilerplate: on the server, `renderToStringAsync`/`renderToStream` accept a `router` option and internally build the request-scoped router, run guards, await readiness, inject provides, and transport the route snapshot; on the client, `hydrateAsync` accepts the app's router instance and internally parses, rebuilds, and verifies the snapshot. The composable APIs remain unchanged as the explicit escape hatch.

## API Surface

- **Server** — `renderToStringAsync(App, { router })` and `renderToStream(App, { router })` where `router` is `RouterSSROptions`:
  - `url: string` — the request URL.
  - `routes` — the app's route record table (same shape `createRouter` accepts).
  - `guards?` — route/global guards to register before readiness.
  - `identifyRecord?` — the record identity function used by snapshot (de)serialization.
  - The renderer calls `createRouterServerContext({ url, routes, guards, identifyRecord })` internally, merges the returned `provides` into the render provides, renders, and appends `<script id="__solace-router-snapshot">window.__SOLACE_ROUTER_SNAPSHOT__=<payload>;</script>` to the HTML tail.
  - Passing both `router` and `provides` throws `TypeError` (ambiguous ownership).
- **Client** — `createApp(App).hydrateAsync(container, { router })` where `router` is the router instance the app already created and registered via `app.use(router)`. Internally, in order:
  1. `await router.isReady()`;
  2. read the snapshot payload: prefer `script#__solace-router-snapshot` textContent (the assignment expression), falling back to the `window.__SOLACE_ROUTER_SNAPSHOT__` global if the script tag was removed by other tooling;
  3. `parseRouterSnapshot(...)` → `createRouterSnapshot(router.currentRoute.value)` → `verifyRouterSnapshot(server, client)`;
  4. remove the script node; proceed with the existing hydration walk.
- Orthogonality: `renderToStream(..., { router, mode: "out-of-order" })` composes — the snapshot script is emitted after the boundary flush loop and before `controller.close()`, so the DOM is final (markers replaced, snapshot present) before client code runs.
- Unchanged: `generateStaticSite` and sync `renderToString`/`hydrate` keep their existing deferred-integration `TypeError`s for a `router` option (SSG pages differ per URL; sync APIs cannot await readiness).

## Snapshot Transport

- Payload is the existing `serializeRouterSnapshot(snapshot)` output, embedded via `JSON.stringify` with `</script` sequences neutralized (same escaping rule as `buildReplacementScript` in `src/server/stream-boundary.ts`), inside `<script id="__solace-router-snapshot">window.__SOLACE_ROUTER_SNAPSHOT__=<json>;</script>`.
- The script carries an `id` so the client can locate it without depending on position.
- Missing payload on the client (no script tag and no global) throws `TypeError` with a message naming the expected script id.

## Concurrency Safety

- The `router` option value builds a fresh memory-history router per render call via `createRouterServerContext`; nothing router-related is stored on module-level state. Concurrent renders cannot observe each other's router state — the existing invariant ("two concurrent server contexts cannot observe or mutate each other's router state") is preserved because ownership is per-call.

## Error Handling

- Option validation: `router` must be a plain object with a string `url` and an array `routes`; violations throw `TypeError`. `router` + `provides` together throws `TypeError`.
- Guard failure / redirect loop: propagates from `isReady()` as a render failure (same as the composable flow).
- Client verify mismatch: throws `RouterHydrationError` (path/expected/actual included); no automatic recovery. With `recover: true`, the existing hydration recovery path applies after the router error is raised (the router error surfaces first — document this ordering).
- Hydration walker tolerance: the snapshot `<script>` element is a DOM node the walk must tolerate and remove; comment-tolerance precedent (`skipComments`) does not cover element nodes, so the script is consumed explicitly (removed before the walk by the client integration).

## Non-Goals

- No filesystem/convention routing, no route crawling, no automatic code splitting.
- No changes to the composable router-aware APIs or the router package itself (beyond what wiring strictly requires).
- No asset manifest/client-entry injection (sub-project 4: production pipeline).

## Testing And Gates

- Unit: option validation (shape, url/routes, router+provides conflict); provides merge behavior; snapshot script byte shape and `</script` neutralization; stream emission order (snapshot after boundary flush, before close); client payload resolution (script tag → global fallback → missing error); verify-failure surfaces `RouterHydrationError`; script node removal before the walk.
- Integration: server `router` option → client `hydrateAsync(container, { router })` full round-trip (dynamic params, guards, redirect-ready route); composition with `mode: "out-of-order"`; regression of the existing composable router-ssr suites.
- Docs: `docs/api.md` + `.zh-CN.md` (router option on both sides, snapshot transport, error semantics, composable flow still available), `docs/project-status.md`(.zh-CN), `docs/roadmap.md`, `readme.md`/`readme.zh-CN.md`; docs-contract tests updated to match.
- Full gate: `pnpm format:check && pnpm typecheck && pnpm typecheck:jsxdev && pnpm lint && pnpm test`, then `pnpm build && pnpm test:package && pnpm package:smoke`.
