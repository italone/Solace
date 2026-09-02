# Sync-Entry Router Options Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let the synchronous SSR entries (`renderToString`, `generateStaticSite`) accept a renderer-owned `router` option via a new synchronous router settlement fast path.

**Architecture:** `src/router/router.ts` gains `isReadySync()` — a mirror of the async initial settlement that runs guards without `await`, throwing `TypeError` on thenable guard results, following redirects synchronously, and skipping scroll behavior (server-irrelevant). `src/server/router-ssr.ts` gains `resolveRouterSSRSync()` producing the same `provides` map and canonical snapshot as the async path. The two sync entries wire it exactly like their async counterparts, emitting a byte-identical snapshot script.

**Tech Stack:** TypeScript, vitest + happy-dom, existing Solace conventions.

---

### Task 1: Router synchronous settlement (`isReadySync`)

**Files:**

- Modify: `src/router/router.ts` (add `isReadySync` to the router object + sync helpers near their async twins)
- Modify: `src/router/types.ts` (Router interface — find where `isReady` is declared)
- Test: `tests/unit/router/router-sync-settlement.test.ts`

- [ ] **Step 1: Write failing tests**

```ts
import { describe, expect, it } from "vitest";

import { createMemoryHistory } from "../../../src/router/history";
import { createRouter } from "../../../src/router/router";
import type { RouteRecord } from "../../../src/router/types";

const routes: RouteRecord[] = [
  { path: "/", component: () => null },
  { path: "/a", component: () => null, beforeEnter: () => true },
  { path: "/b", redirect: "/c" },
  { path: "/c", component: () => null },
  { path: "/old", component: () => null, redirect: "/new" },
  { path: "/new", component: () => null },
];

const makeRouter = (url = "/") => createRouter({ history: createMemoryHistory(url), routes });

describe("router isReadySync", () => {
  it("settles synchronously and updates currentRoute", () => {
    const router = makeRouter("/a");
    const route = router.isReadySync();
    expect(route.fullPath).toBe("/a");
    expect(router.currentRoute.value.fullPath).toBe("/a");
  });

  it("follows synchronous record redirects to the landing route", () => {
    const router = makeRouter("/b");
    const route = router.isReadySync();
    expect(route.fullPath).toBe("/c");
    expect(router.currentRoute.value.fullPath).toBe("/c");
  });

  it("follows a sync guard redirect chain", () => {
    const router = createRouter({
      history: createMemoryHistory("/old"),
      routes: [...routes, { path: "/x", component: () => null }],
    });
    const route = router.isReadySync();
    expect(route.fullPath).toBe("/new");
  });

  it("returns the landing route with redirectedFrom", () => {
    const router = makeRouter("/b");
    expect(router.isReadySync().redirectedFrom?.fullPath).toBe("/b");
  });

  it("cancels when a sync guard returns false", () => {
    const router = createRouter({
      history: createMemoryHistory("/a"),
      routes: [{ path: "/a", component: () => null, beforeEnter: () => false }],
    });
    expect(() => router.isReadySync()).toThrow(/cancelled/);
  });

  it("throws TypeError for an async guard", () => {
    const router = createRouter({
      history: createMemoryHistory("/a"),
      routes: [{ path: "/a", component: () => null, beforeEnter: async () => true }],
    });
    expect(() => router.isReadySync()).toThrow(TypeError);
    expect(() => router.isReadySync()).toThrow(/synchronous guards/);
  });

  it("throws TypeError for a guard returning a Promise value", () => {
    const router = createRouter({
      history: createMemoryHistory("/a"),
      routes: [{ path: "/a", component: () => null, beforeEnter: () => Promise.resolve(true) }],
    });
    expect(() => router.isReadySync()).toThrow(TypeError);
  });

  it("does not affect the async readiness path", async () => {
    const router = makeRouter("/a");
    router.isReadySync();
    await expect(router.isReady()).resolves.toMatchObject({ fullPath: "/a" });
  });
});
```

Check the exact `RouteRecord`/`beforeEnter`/redirect field names against `src/router/types.ts` and adjust fixtures to the real API (e.g. redirect on a record, `redirectedFrom` presence). Check whether guards also include global `beforeEach` — add one test with `router.beforeEach(() => true)` sync-accepted and one async-rejected if the type allows.

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm vitest run tests/unit/router/router-sync-settlement.test.ts`
Expected: FAIL — `router.isReadySync is not a function`.

- [ ] **Step 3: Implement**

In `src/router/router.ts`:

1. Add a thenable check (reuse an existing one if present in the codebase; grep `isThenable`):
   ```ts
   function isSyncThenable(value: unknown): boolean {
     return (
       (typeof value === "object" || typeof value === "function") &&
       value !== null &&
       "then" in value &&
       typeof (value as { then?: unknown }).then === "function"
     );
   }
   ```
2. Sync twins placed next to their async versions:
   ```ts
   function runGuardsSync(
     to: RouteLocationNormalized,
     from: RouteLocationNormalized,
   ): true | false | RouteLocationRaw {
     const guards = [
       ...beforeEachGuards,
       ...to.matched.flatMap((record) => normalizeGuards(record.beforeEnter)),
     ];
     try {
       for (const guard of guards) {
         const result = guard(to, from);
         if (isSyncThenable(result)) {
           throw new TypeError(
             "Synchronous router settlement requires synchronous guards; use the async SSR entry",
           );
         }
         if (result === false) return false;
         if (result !== undefined && result !== true) return result;
       }
     } catch (error) {
       if (error instanceof TypeError && error.message.includes("synchronous guards")) {
         throw error;
       }
       throw new RouterNavigationError("Router guard rejected", "guard-rejected", from, to);
     }
     return true;
   }
   ```
   Careful: the `try/catch` must not swallow the thenable `TypeError` — rethrow it before wrapping in `RouterNavigationError` (cleanest: do the thenable check OUTSIDE the try, or check `error instanceof TypeError && /synchronous guards/.test(error.message)` and rethrow). Pick the explicit rethrow-by-message check and write it cleanly.
3. `resolveNavigationSync(initial, from, state = { count: 0 })` — same structure as `resolveNavigation` but calling `resolveRedirects` (already sync), `runGuardsSync`, recursing synchronously with the same redirect-loop limit semantics.
4. `isReadySync(): RouteLocationNormalized` on the router object (next to `isReady`):
   ```ts
   isReadySync() {
     const from = currentRoute.value;
     const initial = resolveLocation(options.history.location());
     const finalRoute = resolveNavigationSync(initial, from);
     if (finalRoute === false) {
       throw new RouterNavigationError(
         "Router initial navigation was cancelled", "guard-cancelled", from, initial,
       );
     }
     if (finalRoute.fullPath !== initial.fullPath) {
       writeHistory(() => options.history.replace(finalRoute.fullPath));
     }
     currentRoute.value = finalRoute;
     return finalRoute;
   }
   ```
   (No `readinessPromise` interplay, no scroll behavior, no navigationId guard — single synchronous pass.)
5. Add `isReadySync(): RouteLocationNormalized;` to the Router interface in `src/router/types.ts` where `isReady` is declared.

- [ ] **Step 4: Run tests**

Run: `pnpm vitest run tests/unit/router tests/unit/server`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/router/router.ts src/router/types.ts tests/unit/router/router-sync-settlement.test.ts
git commit -m "feat: add synchronous router settlement fast path"
```

### Task 2: `resolveRouterSSRSync`

**Files:**

- Modify: `src/server/router-ssr.ts`
- Test: `tests/unit/server/router-ssr-sync.test.ts`

- [ ] **Step 1: Write failing tests**

Mirror the style of the existing async router-ssr tests (find them via grep `createRouterServerContext` in tests/). Tests:

- `resolveRouterSSRSync({ url: "/about", routes, identifyRecord })` returns `{ provides, snapshot }`; `provides` is a Map containing the router key and route key (same keys the async path sets — check src/server/router-context.ts for the exported key symbols); snapshot `fullPath === "/about"`.
- Same records/url through the async `resolveRouterSSR` produce an identical snapshot (`JSON.stringify` equal).
- Async guard in the records → `resolveRouterSSRSync` throws `TypeError` mentioning synchronous guards.
- Invalid shapes reuse `assertRouterSSROption` errors (missing identifyRecord).

- [ ] **Step 2: Verify failure**

Run: `pnpm vitest run tests/unit/server/router-ssr-sync.test.ts` — FAIL (export missing).

- [ ] **Step 3: Implement**

In `src/server/router-ssr.ts`, export:

```ts
export function resolveRouterSSRSync(options: RouterSSROptions): RouterSSRResult {
  assertRouterSSROption(options);
  const router = createRouter({
    history: createMemoryHistory(options.url),
    routes: options.routes,
  });
  if (options.configure !== undefined) {
    options.configure(router);
    // mirror createRouterServerContext: thenable return rejects
  }
  const route = router.isReadySync();
  const provides = new Map<ProviderKey, unknown>();
  provides.set(routerKey, router);
  provides.set(routeKey, router.currentRoute);
  return { router, provides, snapshot: createRouterSnapshot(route, options.identifyRecord) };
}
```

Match the REAL shape of the async result (read `createRouterServerContext` + `resolveRouterSSR` return type in src/server/router-context.ts / router-ssr.ts and reuse the same type — likely `RouterSSRResult` with `router`, `provides`, `snapshot`). Reuse/dedupe the configure-sync assertion if it is a shared helper; if inline, extract or duplicate minimally.

- [ ] **Step 4: Run tests**

Run: `pnpm vitest run tests/unit/server/router-ssr-sync.test.ts tests/unit/server`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/server/router-ssr.ts tests/unit/server/router-ssr-sync.test.ts
git commit -m "feat: add synchronous router SSR resolution"
```

### Task 3: `renderToString` router option

**Files:**

- Modify: `src/server/render-to-string.ts`
- Test: `tests/unit/server/render-to-string-router.test.ts`

- [ ] **Step 1: Write failing tests**

Style: follow `tests/unit/server/render-to-string.test.ts` and the async router tests (grep `resolveRouterSSR\|__SOLACE_ROUTER_SNAPSHOT__` in tests/unit/server/). Tests:

- `renderToString(() => h("p", null, "about"), { router: { url: "/about", routes, identifyRecord } })` — component can read route state via the injected router/route (mirror how async tests consume `provides`, e.g. a component using the route injection returning `route.value.fullPath` into the tree); html contains that route-driven content.
- html ends with the snapshot script; `parseRouterSnapshot` on the payload yields `path === "/about"` (payload is a string literal — no JSON.parse).
- Byte-parity: for the same sync tree and options, `renderToString(...)` html body equals `renderToStringAsync(...)` html (modulo asset/script ordering — compare the non-script prefix AND the script separately if the async entry orders differently; assert snapshot script identical).
- `router` + `provides` together still throws the existing combined-options error.
- Unknown router field throws existing `TypeError` ("Unknown SSR router option: ...").
- Async guard in routes → `renderToString` throws `TypeError` (synchronous guards).
- Remove/adjust the existing test asserting `renderToString` rejects `router` (`tests/unit/server/render-to-string.test.ts:145-158`) — replace with a rejection only for the invalid cases.

- [ ] **Step 2: Verify failure**

Run: `pnpm vitest run tests/unit/server/render-to-string-router.test.ts` — FAIL.

- [ ] **Step 3: Implement**

In `src/server/render-to-string.ts` `renderToString`:

1. Remove the blanket `router` rejection from `assertNoDeferredIntegrationOptions` (keep `provides`+`router` combination rejection, mirroring `assertAsyncSSROptions`).
2. When `options.router !== undefined`: `const routerSSR = resolveRouterSSRSync(options.router);` use `routerSSR.provides` as the appProvides for rendering (replacing `options.provides`), render the tree, then append `buildSnapshotScript(routerSSR.snapshot)` to the html exactly as `renderToStringAsync` does (same ordering relative to asset tags — read render-to-string.ts:79-91 first).
3. Keep all sync-source assertions unchanged (thenable sources still rejected).

- [ ] **Step 4: Run tests**

Run: `pnpm vitest run tests/unit/server tests/integration`
Expected: PASS (fix any fixture genuinely relying on the old rejection only via the replaced test).

- [ ] **Step 5: Commit**

```bash
git add src/server/render-to-string.ts tests/unit/server/render-to-string-router.test.ts tests/unit/server/render-to-string.test.ts
git commit -m "feat: accept router option on renderToString"
```

### Task 4: `generateStaticSite` route-level router

**Files:**

- Modify: `src/server/generate-static-site.ts`
- Test: `tests/unit/server/generate-static-site.test.ts` (extend) or a new `generate-static-site-router-sync.test.ts`

- [ ] **Step 1: Write failing tests**

Mirror `tests/unit/server/generate-static-site-router.test.ts` (the async version) exactly:

- route with `router: { routes, identifyRecord }` produces body containing route-driven content + `__SOLACE_ROUTER_SNAPSHOT__`; `parseRouterSnapshot` payload path equals the route path.
- routes without `router` render exactly as before.
- unknown field inside route router option (e.g. `url`) throws "Unknown SSR router option: url".
- missing `identifyRecord` throws.
- top-level `router` on `generateStaticSite()` options still rejected with the existing message.
- route `path` duplication check still applies.

- [ ] **Step 2: Verify failure** — `pnpm vitest run tests/unit/server/generate-static-site-router-sync.test.ts` FAIL.

- [ ] **Step 3: Implement**

In `src/server/generate-static-site.ts`:

1. `StaticRoute` (or the sync route type) gains `router?: RouterSSGOptions` (reuse the type from router-ssr.ts).
2. In `assertNoDeferredRouteIntegrationOptions`, stop rejecting `router` (validate instead via `assertRouterSSGOption` when present); route option allowlist gains `"router"`.
3. In the sync render loop, branch like the async loop (generate-static-site.ts:115-123): `route.router !== undefined ? renderToString(route.source, { router: { url: route.path, ...route.router } }) : renderToString(route.source)`.
4. Keep the top-level `router` rejection on the options object.

- [ ] **Step 4: Run tests**

Run: `pnpm vitest run tests/unit/server tests/integration`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/server/generate-static-site.ts tests/unit/server/generate-static-site-router-sync.test.ts tests/unit/server/generate-static-site.test.ts
git commit -m "feat: accept route-level router option on generateStaticSite"
```

### Task 5: Docs, changeset, full gates

**Files:**

- Modify: `docs/api.md`, `docs/api.zh-CN.md` (SSR/SSG/router sections)
- Create: `.changeset/sync-entry-router.md`
- Modify: `docs/roadmap.md` (items 3/6/7 — "synchronous-entry router options" deferred markers)

- [ ] **Step 1: Document**

- renderToString router option (semantics: sync-only guards — thenable guard results throw `TypeError` pointing at the async entry; provides replaced by router context; snapshot script appended byte-identical to the async path).
- generateStaticSite route-level router option (path doubles as url).
- `isReadySync()` on the router (public router surface — check whether router APIs are documented in api.md; document there).
- zh-CN mirror.

- [ ] **Step 2: Changeset**

```markdown
---
"@italone/solace": minor
---

Add synchronous-entry router support: `renderToString()` accepts a `router` option (`{ url, routes, identifyRecord, configure? }`) backed by a new synchronous router settlement fast path (`router.isReadySync()`) that requires synchronous guards (thenable guard results throw a `TypeError` pointing at the async entries), follows redirects synchronously, injects the router server context, and appends the same route snapshot script as the async path. `generateStaticSite()` accepts the same route-level `router` option as `generateStaticSiteAsync()`.
```

- [ ] **Step 3: Full quality gate**

Run: `pnpm quality`
Expected: PASS.

- [ ] **Step 4: Release gate**

Run: `pnpm release:check`
Expected: PASS.

- [ ] **Step 5: Commit and push**

```bash
git add docs/api.md docs/api.zh-CN.md docs/roadmap.md .changeset/sync-entry-router.md
git commit -m "docs: sync-entry router options docs and changeset"
git push
```
