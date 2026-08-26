# Renderer-Owned Router Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** `renderToStringAsync`/`renderToStream` accept a `router` option that owns request-scoped router setup and snapshot transport; `hydrateAsync` accepts the client router instance and owns snapshot parse/verify — absorbing the composable boilerplate while keeping the composable APIs unchanged.

**Architecture:** A new `src/server/router-ssr.ts` module wraps `createRouterServerContext` (real signatures: `identifyRecord` is required, `configure?: (router) => void` replaces guards) and builds an escaped inline `<script id="__solace-router-snapshot">` from `serializeRouterSnapshot`. Both server renderers call it and merge its `provides` (rejecting a simultaneous `provides` option). The client `hydrateAsync` `router` option resolves the payload (script tag → global fallback), verifies via the existing snapshot functions, removes the script node, and hydrates.

**Tech Stack:** TypeScript, Vitest (jsdom), existing package-exports and docs-contract gates.

**Spec:** `docs/superpowers/specs/2026-08-26-renderer-owned-router-design.md` (spec field names map to reality: `guards?` → `configure?`; `identifyRecord` is required, not optional).

---

## File Map

- `src/server/router-ssr.ts` (new): `RouterSSROptions`, `assertRouterSSROption`, `resolveRouterSSR` (context + provides), `buildSnapshotScript`, `readEmbeddedSnapshot` (client-side payload resolution — pure DOM, usable from renderer package too? NO: keep DOM reading in renderer; this module exports only server-safe code).
- `src/server/render-to-stream.ts`: `router` option in `RenderToStreamOptions` + validation + emission after boundary flush.
- `src/server/render-to-string.ts`: `router` option in the async options interface + appending the script to the returned html.
- `src/server/index.ts`: export `RouterSSROptions` type if the package exports option types (check existing exports).
- `src/renderer/renderer.ts`: `router` option on `HydrationOptions` (hydrateAsync-only), snapshot verify + script removal before the walk.
- `tests/unit/server/router-ssr.test.ts` (new), `tests/unit/server/render-to-stream-router.test.ts` (new or extend existing suites), `tests/unit/renderer/router-hydration.test.ts` (new).
- `tests/integration/router-owned-ssr.test.ts` (new).
- Docs: `docs/api.md`, `docs/api.zh-CN.md`, `docs/project-status.md`, `docs/project-status.zh-CN.md`, `docs/roadmap.md`, `readme.md`, `readme.zh-CN.md`, `docs/package-usage.md`.

Adaptation note for executors: tests import from relative paths (`../../../src`, `../../../src/server`); option-validation failures are asserted synchronously where the API is synchronous (`expect(() => ...).toThrow`) and via `rejects.toThrow` for async-only APIs. Mirror `tests/unit/server/render-to-stream-out-of-order.test.ts` and `tests/integration/router-ssr-streaming.test.ts` conventions. Read `src/server/render-to-string.ts` (options assertion around line 200) and `src/router/snapshot.ts` before touching them.

### Task 1: `router-ssr.ts` — option validation, context resolution, snapshot script builder

**Files:**

- Create: `src/server/router-ssr.ts`
- Test: `tests/unit/server/router-ssr.test.ts`

- [ ] **Step 1: Write the failing tests**

```ts
import { describe, expect, it } from "vitest";

import { h } from "../../../src";
import {
  assertRouterSSROption,
  buildSnapshotScript,
  resolveRouterSSR,
} from "../../../src/server/router-ssr";

const identify = (record: { name?: string }) => record.name ?? "record";

const routes = [
  { path: "/", name: "home", component: () => h("p", null, "home") },
  { path: "/user/:id", name: "user", component: () => h("p", null, "user") },
];

describe("assertRouterSSROption", () => {
  it("accepts a well-formed router option", () => {
    expect(() =>
      assertRouterSSROption({ url: "/user/7", routes, identifyRecord: identify }),
    ).not.toThrow();
  });

  it("rejects non-objects, missing url, missing routes, missing identifyRecord", () => {
    expect(() => assertRouterSSROption(null)).toThrow("SSR router option must be an object");
    expect(() => assertRouterSSROption({ routes, identifyRecord: identify })).toThrow(
      "SSR router url must be a string",
    );
    expect(() => assertRouterSSROption({ url: "/", identifyRecord: identify })).toThrow(
      "SSR router routes must be an array",
    );
    expect(() => assertRouterSSROption({ url: "/", routes })).toThrow(
      "SSR router identifyRecord must be a function",
    );
  });

  it("rejects unknown keys", () => {
    expect(() =>
      assertRouterSSROption({ url: "/", routes, identifyRecord: identify, teleport: true }),
    ).toThrow("Unknown SSR router option: teleport");
  });
});

describe("resolveRouterSSR", () => {
  it("builds a request-scoped context and provides for the route", async () => {
    const resolved = await resolveRouterSSR({ url: "/user/7", routes, identifyRecord: identify });
    expect(resolved.route.params).toMatchObject({ id: "7" });
    expect(resolved.provides.size).toBeGreaterThan(0);
  });

  it("rejects when the router never becomes ready (bad guard redirect loop)", async () => {
    await expect(
      resolveRouterSSR({
        url: "/",
        routes,
        identifyRecord: identify,
        configure: (router) => {
          router.beforeEach(() => ({ path: "/other" }) as never);
        },
      }),
    ).rejects.toThrow();
  });
});

describe("buildSnapshotScript", () => {
  it("emits the assignment script with a neutralized payload", async () => {
    const resolved = await resolveRouterSSR({ url: "/user/7", routes, identifyRecord: identify });
    const script = buildSnapshotScript(resolved.snapshot);
    expect(script.startsWith('<script id="__solace-router-snapshot">')).toBe(true);
    expect(script).toContain("window.__SOLACE_ROUTER_SNAPSHOT__=");
    expect(script.endsWith(";</script>")).toBe(true);
    expect(script).not.toMatch(/<\/script(?!>;<\/script>$)/); // payload cannot terminate the script early
  });

  it("neutralizes closing script sequences inside the payload", () => {
    const script = buildSnapshotScript({ fullPath: "</script><b>x</b>" } as never);
    expect(script).toContain("<\\/script>");
  });
});
```

Note: the `identify` helper and `routes` shape must match the real `RouteRecord`/`RouteRecordIdentity` types — check `src/router/types.ts` and mirror what `tests/integration/router-ssr-streaming.test.ts` passes to `createRouterServerContext`, including guard-return shapes for the redirect-loop test (read `router.beforeEach` typing; adapt the `as never` cast to the real guard return type). The redirect-loop behavior (isReady rejecting vs hanging) must be verified against the real router: if a redirect loop hangs instead of rejecting, replace that test with a guard that throws, and assert the rejection message.

- [ ] **Step 2: Run to verify failure**

Run: `pnpm exec vitest run tests/unit/server/router-ssr.test.ts`
Expected: FAIL — module does not exist.

- [ ] **Step 3: Implement `src/server/router-ssr.ts`**

```ts
import { createRouterServerContext, type RouterServerContext } from "./router-context";
import type { RouteRecord, RouteRecordIdentity } from "../router/types";
import type { RouterSnapshot } from "../router/snapshot";
import { serializeRouterSnapshot } from "../router/snapshot";

export interface RouterSSROptions {
  url: string;
  routes: RouteRecord[];
  identifyRecord: RouteRecordIdentity;
  configure?: (router: import("../router/types").Router) => void;
}

const ROUTER_OPTION_KEYS = new Set(["url", "routes", "identifyRecord", "configure"]);

export function assertRouterSSROption(router: unknown): asserts router is RouterSSROptions {
  if (router === null || typeof router !== "object" || Array.isArray(router)) {
    throw new TypeError("SSR router option must be an object");
  }

  const record = router as Record<string, unknown>;
  const unknownKey = Reflect.ownKeys(record).find(
    (key) => typeof key !== "string" || !ROUTER_OPTION_KEYS.has(key),
  );
  if (unknownKey !== undefined) {
    throw new TypeError(`Unknown SSR router option: ${String(unknownKey)}`);
  }
  if (typeof record.url !== "string") {
    throw new TypeError("SSR router url must be a string");
  }
  if (!Array.isArray(record.routes)) {
    throw new TypeError("SSR router routes must be an array");
  }
  if (typeof record.identifyRecord !== "function") {
    throw new TypeError("SSR router identifyRecord must be a function");
  }
  if (record.configure !== undefined && typeof record.configure !== "function") {
    throw new TypeError("SSR router configure must be a function");
  }
}

export interface ResolvedRouterSSR {
  context: RouterServerContext;
  provides: RouterServerContext["provides"];
  snapshot: RouterSnapshot;
}

export async function resolveRouterSSR(options: RouterSSROptions): Promise<ResolvedRouterSSR> {
  assertRouterSSROption(options);
  const context = await createRouterServerContext(options);
  return { context, provides: context.provides, snapshot: context.snapshot };
}

export function buildSnapshotScript(snapshot: RouterSnapshot): string {
  const payload = serializeRouterSnapshot(snapshot)
    .replace(/\\/g, "\\\\")
    .replace(/'/g, "\\'")
    .replace(/\r/g, "\\r")
    .replace(/\n/g, "\\n")
    .replace(/<\/(script)/gi, "<\\/$1");
  return (
    `<script id="__solace-router-snapshot">` +
    `window.__SOLACE_ROUTER_SNAPSHOT__='${payload}';` +
    `</script>`
  );
}
```

Wait — payload quoting: `serializeRouterSnapshot` returns a JSON string (check `src/router/snapshot.ts:84`). If it returns `JSON.stringify`-style output (double-quoted JSON), embed it directly without single-quote wrapping and only neutralize `</script`:

```ts
export function buildSnapshotScript(snapshot: RouterSnapshot): string {
  const json = serializeRouterSnapshot(snapshot);
  const payload = json.replace(/<\/(script)/gi, "<\\/$1");
  return (
    `<script id="__solace-router-snapshot">` +
    `window.__SOLACE_ROUTER_SNAPSHOT__=${payload};` +
    `</script>`
  );
}
```

Use the second form if `serializeRouterSnapshot` returns JSON; use the first (single-quoted JS string) if it returns a bare string. Verify by reading snapshot.ts:84-93 and by asserting `parseRouterSnapshot` round-trips the embedded payload in the tests (add: extract the payload between `=` and `;` with a regex and `parseRouterSnapshot` it, expecting the same `fullPath`).

Type imports: if `RouteRecordIdentity` lives in `../router/snapshot` (router-context.ts imports it from there), import from there. Inline `import()` types are not repo style — use a normal `import type { Router } from "../router/types";`.

- [ ] **Step 4: Run tests**

Run: `pnpm exec vitest run tests/unit/server/router-ssr.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/server/router-ssr.ts tests/unit/server/router-ssr.test.ts
git commit -m "feat: add router SSR option resolution and snapshot script builder"
```

---

### Task 2: `router` option on `renderToStream`

**Files:**

- Modify: `src/server/render-to-stream.ts`
- Test: `tests/unit/server/render-to-stream-router.test.ts` (new)

- [ ] **Step 1: Write the failing tests**

```ts
import { describe, expect, it } from "vitest";

import { h } from "../../../src";
import { renderToStream } from "../../../src/server";
import { collectStream } from "./stream-test-utils";
import {
  RouterLink,
  RouterView,
  createRouter,
  createWebHistory,
  useRouter,
  useRoute,
} from "../../../src";

// Mirror tests/integration/router-ssr-streaming.test.ts for the exact app
// composition: it shows how RouterView/RouterLink consume the router through
// provides and what an identifyRecord for these routes looks like.
const routes = [
  { path: "/", name: "home", component: () => h("p", null, "home") },
  { path: "/user/:id", name: "user", component: () => h("p", null, "user") },
];
const identify = (record: { name?: string }) => record.name ?? "record";

describe("renderToStream router option", () => {
  it("streams route content and appends the snapshot script", async () => {
    const streamed = await collectStream(
      renderToStream(() => h("div", null, [h(RouterView)]), {
        router: { url: "/user/7", routes, identifyRecord: identify },
      }),
    );
    expect(streamed).toContain("user");
    expect(streamed.endsWith("</script>")).toBe(true);
    expect(streamed).toContain('<script id="__solace-router-snapshot">');
    expect(streamed).toContain("window.__SOLACE_ROUTER_SNAPSHOT__=");
    // Snapshot script must come after the document content.
    expect(streamed.indexOf("__solace-router-snapshot")).toBeGreaterThan(streamed.indexOf("user"));
  });

  it("rejects router plus provides", () => {
    expect(() =>
      renderToStream(() => h("p", null, "x"), {
        router: { url: "/", routes, identifyRecord: identify },
        provides: new Map(),
      }),
    ).toThrow("SSR router option cannot be combined with provides");
  });

  it("rejects invalid router options synchronously", () => {
    expect(() => renderToStream(() => h("p", null, "x"), { router: { url: 1 } as never })).toThrow(
      "SSR router url must be a string",
    );
  });

  it("composes with out-of-order mode (snapshot after boundary flush)", async () => {
    // Reuse a Suspense/async boundary app from the existing suites; assert the
    // snapshot script appears after the last so:r script.
    const streamed = await collectStream(
      renderToStream(() => h("div", null, [h(RouterView)]), {
        router: { url: "/", routes, identifyRecord: identify },
        mode: "out-of-order",
      }),
    );
    expect(streamed).toContain("home");
    expect(streamed).toContain("__solace-router-snapshot");
  });
});
```

Adaptation: the app composition (`RouterView` via provides), the `collectStream` import, and route/component shapes must mirror `tests/integration/router-ssr-streaming.test.ts` exactly — read it first and reuse its fixtures/helpers if they are exported. `useRouter`/`useRoute`/`createWebHistory` imports only as needed.

- [ ] **Step 2: Run to verify failure**

Run: `pnpm exec vitest run tests/unit/server/render-to-stream-router.test.ts`
Expected: FAIL — `Unknown SSR streaming option: router`.

- [ ] **Step 3: Implement in `src/server/render-to-stream.ts`**

Extend options and validation:

```ts
export interface RenderToStreamOptions {
  context?: Record<string, unknown>;
  provides?: Provides;
  mode?: "ordered" | "out-of-order";
  router?: RouterSSROptions;
}
```

In `assertStreamOptions`, replace the `hasOwn(options, "router")` deferred throw with:

```ts
if (options.router !== undefined) {
  assertRouterSSROption(options.router);
  if (options.provides !== undefined) {
    throw new TypeError("SSR router option cannot be combined with provides");
  }
}
```

Add `"router"` to the unknown-key allowlist. Import `assertRouterSSROption`, `buildSnapshotScript`, `resolveRouterSSR`, and `type RouterSSROptions` from `./router-ssr`.

Restructure `start()` to an async prelude — `renderToStream` currently returns `new ReadableStream({ async start(controller) {...} })`; validation happens synchronously before the stream is constructed (keep that for the sync-throw tests). The context resolution happens inside `start`:

```ts
export function renderToStream(
  source: RenderToStringAsyncSource,
  options: RenderToStreamOptions = {},
): ReadableStream<Uint8Array> {
  assertStreamOptions(options);
  const encoder = new TextEncoder();

  return new ReadableStream<Uint8Array>({
    async start(controller) {
      try {
        const routerSSR =
          options.router !== undefined ? await resolveRouterSSR(options.router) : null;
        const provides = (routerSSR?.provides ?? options.provides ?? null) as Provides | null;
        const ctx = createStreamContext(options.mode ?? "ordered", provides);
        // ... existing traversal loop unchanged (uses ctx) ...
        // ... existing flushPendingBoundaries loop unchanged ...

        if (routerSSR !== null) {
          controller.enqueue(encoder.encode(buildSnapshotScript(routerSSR.snapshot)));
        }
        if (buffer !== "") {
          controller.enqueue(encoder.encode(buffer));
        }
        controller.close();
      } catch (error) {
        controller.error(error);
      }
    },
  });
}
```

Mechanical detail: the current `start` builds `ctx` from `options.provides` at its top — swap in the resolved provides as shown; everything downstream reads `ctx.appProvides` already. The snapshot script is enqueued AFTER the boundary flush loop and BEFORE the final buffer flush/close (buffer should be empty at that point after the existing flush loop; keep the defensive final flush).

- [ ] **Step 4: Run tests**

Run: `pnpm exec vitest run tests/unit/server/render-to-stream-router.test.ts tests/unit/server`
Expected: PASS — existing suites (including the composable router-ssr-streaming integration tests) unchanged.

- [ ] **Step 5: Commit**

```bash
git add src/server/render-to-stream.ts tests/unit/server/render-to-stream-router.test.ts
git commit -m "feat: accept router option in renderToStream with snapshot transport"
```

---

### Task 3: `router` option on `renderToStringAsync`

**Files:**

- Modify: `src/server/render-to-string.ts`
- Test: extend `tests/unit/server/render-to-stream-router.test.ts` (or a sibling `render-to-string-router` describe in the same file)

- [ ] **Step 1: Write the failing tests (append a describe)**

```ts
import { renderToStringAsync } from "../../../src/server";

describe("renderToStringAsync router option", () => {
  it("returns html with the route content and appended snapshot script", async () => {
    const html = await renderToStringAsync(() => h("div", null, [h(RouterView)]), {
      router: { url: "/user/7", routes, identifyRecord: identify },
    });
    expect(html).toContain("user");
    expect(html.endsWith("</script>")).toBe(true);
    expect(html).toContain('<script id="__solace-router-snapshot">');
  });

  it("rejects router plus provides", () => {
    return expect(
      renderToStringAsync(() => h("p", null, "x"), {
        router: { url: "/", routes, identifyRecord: identify },
        provides: new Map(),
      }),
    ).rejects.toThrow("SSR router option cannot be combined with provides");
  });

  it("rejects invalid router options", () => {
    return expect(
      renderToStringAsync(() => h("p", null, "x"), { router: { routes: [] } as never }),
    ).rejects.toThrow("SSR router url must be a string");
  });
});
```

Adaptation: check `renderToStringAsync`'s options type name and whether validation is sync or inside the async body (read `src/server/render-to-string.ts`); if validation is sync (like renderToStream), use `expect(() => ...).toThrow` for the shape errors. If `renderToStringAsync` returns a string, `html.endsWith("</script>")` holds; if it returns `{ html }`, adapt.

- [ ] **Step 2: Run to verify failure**

Expected: FAIL — deferred `TypeError` on the `router` key.

- [ ] **Step 3: Implement**

Mirror Task 2: add `router?: RouterSSROptions` to the async options interface; replace the `hasOwn(options, "router")` deferred throw in `assertStringOptions`-equivalent with `assertRouterSSROption` + the provides-conflict check; add `"router"` to the unknown-key allowlist; in the async render body, `await resolveRouterSSR(options.router)` when present, use its provides, and append `buildSnapshotScript(snapshot)` to the returned html. Do NOT touch sync `renderToString` or `generateStaticSite` guards (they keep throwing).

- [ ] **Step 4: Run tests**

Run: `pnpm exec vitest run tests/unit/server`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/server/render-to-string.ts tests/unit/server/render-to-stream-router.test.ts
git commit -m "feat: accept router option in renderToStringAsync with snapshot transport"
```

---

### Task 4: `router` option on `hydrateAsync` (client)

**Files:**

- Modify: `src/renderer/renderer.ts`
- Test: `tests/unit/renderer/router-hydration.test.ts` (new)

- [ ] **Step 1: Write the failing tests**

```ts
import { describe, expect, it } from "vitest";

import { createRouter, createWebHistory, h, RouterView } from "../../../src";
import { createApp } from "../../../src/app";
import { renderToStringAsync } from "../../../src/server";
import { RouterHydrationError } from "../../../src/router/snapshot";

const routes = [
  { path: "/", name: "home", component: () => h("p", null, "home") },
  { path: "/user/:id", name: "user", component: () => h("p", null, "user") },
];
const identify = (record: { name?: string }) => record.name ?? "record";

describe("hydrateAsync router option", () => {
  it("verifies the embedded snapshot, removes the script, and hydrates", async () => {
    const App = () => h("div", null, [h(RouterView)]);
    const html = await renderToStringAsync(App, {
      router: { url: "/user/7", routes, identifyRecord: identify },
    });

    const container = document.createElement("div");
    container.innerHTML = html.replace(
      /<script id="__solace-router-snapshot">[\s\S]*?<\/script>/u,
      (match) => {
        // Keep the script in the DOM — jsdom does not execute it, so ALSO set the
        // global the way a browser would:
        const payload = match.slice(match.indexOf("=") + 1, match.lastIndexOf(";"));
        (window as unknown as Record<string, unknown>).__SOLACE_ROUTER_SNAPSHOT__ =
          JSON.parse(payload);
        return match;
      },
    );
    document.body.appendChild(container);

    const router = createRouter({ history: createWebHistory(), routes });
    const app = createApp(App);
    app.use(router);
    await app.hydrateAsync(container, { router });

    expect(container.querySelector("script")).toBeNull();
    expect(container.textContent).toContain("user");
    delete (window as unknown as Record<string, unknown>).__SOLACE_ROUTER_SNAPSHOT__;
  });

  it("throws RouterHydrationError when the client route differs from the snapshot", async () => {
    const App = () => h("div", null, [h(RouterView)]);
    const html = await renderToStringAsync(App, {
      router: { url: "/user/7", routes, identifyRecord: identify },
    });
    const container = document.createElement("div");
    container.innerHTML = html;
    document.body.appendChild(container);

    // Client starts at a different URL than the server snapshot.
    const router = createRouter({ history: createWebHistory("/user/8" as never), routes });
    const app = createApp(App);
    app.use(router);
    await expect(app.hydrateAsync(container, { router })).rejects.toThrow(RouterHydrationError);
  });

  it("throws when no snapshot payload is present", async () => {
    const App = () => h("p", null, "x");
    const container = document.createElement("div");
    container.innerHTML = "<p>x</p>";
    document.body.appendChild(container);
    const router = createRouter({ history: createWebHistory(), routes });
    const app = createApp(App);
    app.use(router);
    await expect(app.hydrateAsync(container, { router })).rejects.toThrow(
      "Missing router snapshot payload",
    );
  });

  it("still throws the deferred error without a router option (unchanged)", async () => {
    const App = () => h("p", null, "x");
    const container = document.createElement("div");
    container.innerHTML = "<p>x</p>";
    await expect(createApp(App).hydrateAsync(container, { router: {} as never })).rejects.toThrow(
      "SSR router url must be a string",
    );
  });
});
```

Adaptation: `createWebHistory("/user/8")` — check the real history API for seeding the initial URL (`createWebHistory(url?)` or `createMemoryHistory(url)`); jsdom has no real location routing, so `createMemoryHistory` may be required (mirror `tests/integration/router-ssr-hydration.test.ts` client setup exactly — it already solves this). The mismatch test depends on verify comparing `fullPath` — mirror whatever that integration test uses to force a client/server divergence.

- [ ] **Step 2: Run to verify failure**

Expected: FAIL — `router` still throws the deferred hydration TypeError.

- [ ] **Step 3: Implement in `src/renderer/renderer.ts`**

- `HydrationOptions` gains `router?: Router` (import type from `../router/types`).
- In `assertNoDeferredIntegrationOptions`, replace the `hasOwn(options, "router")` deferred throw with: if `options.router !== undefined`, it must be an object with an `isReady` function, else `TypeError("Hydration router option must be a Router instance")`; add `"router"` to the unknown-key allowlist.
- In `hydrateAsync`, after validation and before preparing/hydrating:

```ts
if (options.router !== undefined) {
  if (options.selective === true) {
    throw new TypeError(
      "Router-aware selective hydration is not supported yet; use ordered hydration.",
    );
  }
  await prepareRouterHydration(options.router, container as Element);
}
```

(This slice scopes `router` to the default whole-tree path; selective + router stays deferred with an explicit message.)

```ts
async function prepareRouterHydration(router: Router, container: Element): Promise<void> {
  await router.isReady();
  const payload = readEmbeddedSnapshot(container);
  if (payload === null) {
    throw new TypeError(
      "Missing router snapshot payload; expected script#__solace-router-snapshot",
    );
  }
  const server = parseRouterSnapshot(payload);
  const client = createRouterSnapshot(router.currentRoute.value /* identifyRecord — see below */);
  verifyRouterSnapshot(server, client);
  const script = container.querySelector("script#__solace-router-snapshot");
  script?.remove();
}

function readEmbeddedSnapshot(container: Element): string | null {
  const script = container.querySelector("script#__solace-router-snapshot");
  const expression = script?.textContent ?? null;
  const fromScript = extractSnapshotJson(expression);
  if (fromScript !== null) return fromScript;
  const globalValue = (window as unknown as { __SOLACE_ROUTER_SNAPSHOT__?: unknown })
    .__SOLACE_ROUTER_SNAPSHOT__;
  if (globalValue !== undefined)
    return typeof globalValue === "string" ? globalValue : JSON.stringify(globalValue);
  return null;
}

function extractSnapshotJson(expression: string | null): string | null {
  if (expression === null) return null;
  const match = expression.match(/window\.__SOLACE_ROUTER_SNAPSHOT__\s*=\s*([\s\S]*?);\s*$/);
  return match === null ? null : match[1];
}
```

`identifyRecord` for the client snapshot: the composable client flow passes the app's identify function — since the renderer cannot know it, embed it? NO (spec: no extra transport). Instead: `verifyRouterSnapshot`'s comparison — read how the composable client builds its snapshot (`tests/integration/router-ssr-hydration.test.ts`); if `identifyRecord` is required, accept it on the hydration option too: `router` stays the instance, and the option becomes `{ router, identifyRecord }`? Resolve against the real code: **preferred resolution** — check whether `parseRouterSnapshot` output plus `verifyRouterSnapshot` can compare without a client-side identify function (server snapshot carries record identities; client snapshot needs them too). If a client identify is required, add `routerIdentifyRecord?: RouteRecordIdentity` to `HydrationOptions` and require it when `router` is set (TypeError otherwise) — update the tests above to pass it, and document it. Keep the deviation minimal and recorded.

Imports in renderer.ts come from `../router/snapshot` and `../router/types` — confirm these are client-safe (they are: the router package is exported from the root).

- [ ] **Step 4: Run tests**

Run: `pnpm exec vitest run tests/unit/renderer tests/unit/server tests/integration`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/renderer/renderer.ts tests/unit/renderer/router-hydration.test.ts
git commit -m "feat: verify embedded router snapshots during hydration"
```

---

### Task 5: Integration round-trip

**Files:**

- Test: `tests/integration/router-owned-ssr.test.ts` (new)

- [ ] **Step 1: Read `tests/integration/router-ssr-streaming.test.ts` and `tests/integration/router-ssr-hydration.test.ts`** — mirror their fixtures (routes with dynamic params, guards, identifyRecord, client history setup).

- [ ] **Step 2: Write the integration test**

Cover in one or two `it` blocks, using the REAL fixtures from those files:

1. Server: `renderToStream(App, { router: { url, routes, identifyRecord, configure: guard registration } })` — collect until the snapshot script appears (or fully if no pending boundaries).
2. Client: load HTML into a container (execute the snapshot script like `out-of-order-hydration.test.ts` executes scripts, or set the global as in Task 4), `createApp(App).use(router)`, `await app.hydrateAsync(container, { router, ... })`.
3. Assert: route content present, script removed, post-hydration interaction works (click a `RouterLink` and assert the view swaps — mirror the existing integration test's interaction assertions).

```ts
import { describe, expect, it } from "vitest";

// Mirror the imports/fixtures of tests/integration/router-ssr-streaming.test.ts.

describe("renderer-owned router SSR round-trip", () => {
  it("renders with the router option and hydrates with the client router", async () => {
    // 1. server render (fixtures from the mirrored file)
    const html = await collectStream(
      renderToStream(App, { router: { url: "/user/7", routes, identifyRecord } }),
    );
    expect(html).toContain("user");
    expect(html).toContain("__solace-router-snapshot");

    // 2. client setup
    const container = document.createElement("div");
    container.innerHTML = html.replace(
      /<script id="__solace-router-snapshot">[\s\S]*?<\/script>/u,
      "",
    );
    document.body.appendChild(container);
    // Execute the snapshot script the way the browser would (see
    // out-of-order-hydration.test.ts executeInlineScripts) OR re-append the
    // script node and let readEmbeddedSnapshot find it — the second is simpler:
    // keep the script in the container instead of stripping it.

    const router = createRouter({ history: createMemoryHistory("/user/7"), routes });
    const app = createApp(App);
    app.use(router);
    await app.hydrateAsync(container, { router });

    expect(container.querySelector("script#__solace-router-snapshot")).toBeNull();
    expect(container.textContent).toContain("user");
  });
});
```

The concrete fixtures (dynamic-param route, guard, RouterLink interaction) come from the mirrored files — do not invent new route shapes.

- [ ] **Step 3: Run**

Run: `pnpm exec vitest run tests/integration/router-owned-ssr.test.ts`
Expected: PASS. Debug the implementation, never weaken assertions.

- [ ] **Step 4: Commit**

```bash
git add tests/integration/router-owned-ssr.test.ts
git commit -m "test: cover renderer-owned router SSR round-trip"
```

---

### Task 6: Documentation and docs-contract gates

**Files:**

- Modify: `docs/api.md`, `docs/api.zh-CN.md`, `docs/package-usage.md`, `docs/project-status.md`, `docs/project-status.zh-CN.md`, `docs/roadmap.md`, `readme.md`, `readme.zh-CN.md`

- [ ] **Step 1:** Add a renderer-owned router section to `docs/api.md` + `.zh-CN.md` next to the composable router-aware SSR section (~line 400): server `router` option (fields incl. required `identifyRecord`, `configure` for guards; cannot combine with `provides`); snapshot transport (inline `script#__solace-router-snapshot`, `</script` neutralized, emitted after boundary flush in streams / appended in buffered html); client `hydrateAsync` `router` option (payload resolution order script→global, verify failure throws `RouterHydrationError` before any `recover` handling, script removed, selective+router deferred with explicit message); composable flow unchanged; SSG/sync APIs still reject `router`.
- [ ] **Step 2:** Update project-status (en+zh) SSR row; roadmap records the slice and drops "direct renderer-owned router options" from the deferred list; README (en+zh) sentences claiming deferral updated; package-usage snippet gains the `router` option.
- [ ] **Step 3:** Run `pnpm exec vitest run tests/unit/docs` — PASS (satisfy exact expected strings on failure).

- [ ] **Step 4: Commit**

```bash
git add docs readme.md readme.zh-CN.md
git commit -m "docs: document renderer-owned router SSR options"
```

---

### Task 7: Full quality gate

- [ ] **Step 1:** Run `pnpm format:check && pnpm typecheck && pnpm typecheck:jsxdev && pnpm lint && pnpm test` — all PASS.
- [ ] **Step 2:** Fix drift with `pnpm format` and targeted edits; re-run.
- [ ] **Step 3:** Run `pnpm build && pnpm test:package && pnpm package:smoke` — PASS.
- [ ] **Step 4:** Final commit if fixes were needed:

```bash
git add -A && git commit -m "chore: format and lint renderer-owned router slice"
```

---

## Self-Review Notes

- Spec coverage: server option + provides conflict + snapshot transport (Tasks 1-3), stream emission ordering after boundary flush (Task 2), client verify/global fallback/missing error/script removal (Task 4), orthogonality with out-of-order (Tasks 2 & 5), error semantics incl. `RouterHydrationError` before recover (Task 4), SSG/sync unchanged (explicit non-edit in Task 3), docs/gates (Tasks 6-7).
- Known resolution points for executors: snapshot payload quoting (Task 1 — JSON vs bare string, round-trip test decides), client `identifyRecord` sourcing (Task 4 — verify-first check, else `routerIdentifyRecord` option with documented deviation), redirect-loop vs hanging guard (Task 1), jsdom history seeding (Tasks 4-5 — mirror existing integration fixtures).
- Default-path regression: every existing composable router-ssr suite must stay green after each task; the `router` option is purely additive.
