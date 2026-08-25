# Router Beta Next Phase Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement the next Router beta slice: nested routes, redirects, navigation guards, and lazy route components.

**Architecture:** Normalize route trees into internal match records, resolve locations to a matched record chain, and route all programmatic navigation through one async pipeline. `RouterView` renders by injected depth, redirects and guards run before history commits, and lazy route components resolve after navigation confirmation.

**Tech Stack:** TypeScript, Solace runtime, Vitest, Playwright, Vite, Rollup, pnpm.

---

## File Structure

- Modify `src/router/types.ts`: widen router public types for route components, matched chains, guards, redirects, `beforeEach()`, and async navigation.
- Create `src/router/lazy.ts`: define `lazyRoute()` and the explicit lazy route component marker.
- Modify `src/router/matcher.ts`: normalize route trees, flatten nested routes, preserve matched chains, merge params, and keep ranking.
- Modify `src/router/router.ts`: add shared async `navigate()` pipeline, redirects, guard execution, and stricter deferred-field validation.
- Modify `src/router/components.ts`: update `RouterView` depth rendering and lazy route component resolution.
- Modify `src/router/index.ts`: export new public router types and error class.
- Modify `src/index.ts`: re-export new public router types from the package root.
- Modify `tests/unit/router/public-contract-types.test.ts`: switch former deferred-field type errors to accepted beta types and keep still-deferred type errors.
- Modify `tests/unit/router/matcher.test.ts`: cover nested matching and ranking.
- Modify `tests/unit/router/router.test.ts`: cover redirects, guards, async navigation, and runtime contract boundaries.
- Modify `tests/integration/router-component.test.ts`: cover nested `RouterView`, index routes, layout-less records, async `RouterLink`, and lazy components.
- Modify `tests/integration/package-exports.test.ts`: update runtime boundary expectations and public export checks.
- Modify `scripts/package-consumer-smoke.mjs`: exercise the widened router types and async navigation from a packed consumer.
- Modify `examples/router-basic/src/main.tsx`: add nested, redirect, guarded, and lazy demo routes.
- Modify `tests/e2e/router-basic.spec.ts`: verify the expanded router example in Chromium.
- Modify docs: `docs/api.md`, `docs/api.zh-CN.md`, `docs/package-usage.md`, `docs/examples.md`, `docs/roadmap.md`, `docs/project-status.md`, `readme.md`, `readme.zh-CN.md`.

## Task 1: Public Router Types

**Files:**

- Modify: `src/router/types.ts`
- Modify: `src/router/index.ts`
- Modify: `src/index.ts`
- Test: `tests/unit/router/public-contract-types.test.ts`

- [x] **Step 1: Write failing public contract type tests**

Update `tests/unit/router/public-contract-types.test.ts` so `children`, `redirect`, `beforeEnter`, `meta`, `lazyRoute()` components, and async `router.push()` are valid, while `name`, `alias`, `props`, `scrollBehavior`, named locations, hash locations, and params locations remain invalid.

```ts
import { describe, expect, it } from "vitest";

import { createRouter, h, lazyRoute } from "../../../src";
import type {
  NavigationGuard,
  RouteComponent,
  RouteLocationRaw,
  RouteRecord,
  RouterOptions,
} from "../../../src";
import type { RouterHistory } from "../../../src/router/types";

const Home = () => h("div", null, "home");
const lazyHome: RouteComponent = lazyRoute(() => Promise.resolve(Home));
const guarded: NavigationGuard = (to, from) => {
  if (to.fullPath === from.fullPath) {
    return false;
  }

  return true;
};

function acceptRouteRecord(record: RouteRecord): RouteRecord {
  return record;
}

function acceptRouterOptions(options: RouterOptions): RouterOptions {
  return options;
}

function acceptRouteLocationRaw(location: RouteLocationRaw): RouteLocationRaw {
  return location;
}

acceptRouteRecord({ path: "/", component: Home });
acceptRouteRecord({
  path: "/dashboard",
  component: Home,
  meta: { requiresAuth: true },
  beforeEnter: guarded,
  children: [
    { path: "", component: Home },
    { path: "settings", component: lazyHome },
  ],
});
acceptRouteRecord({ path: "/legacy", redirect: "/dashboard" });
acceptRouteRecord({ path: "/lazy", component: lazyHome });
acceptRouteLocationRaw("/");
acceptRouteLocationRaw({ path: "/", query: { tab: "profile" } });

const history: RouterHistory = {
  location: () => "/",
  push: () => undefined,
  replace: () => undefined,
  listen: () => () => undefined,
  back: () => undefined,
  forward: () => undefined,
};
const router = createRouter({
  history,
  routes: [{ path: "/", component: Home }],
});
const pushed = router.push("/");
pushed.then((route) => route.fullPath);

// @ts-expect-error named routes are not part of the router beta contract
acceptRouteRecord({ path: "/named", component: Home, name: "home" });

// @ts-expect-error aliases are not part of the router beta contract
acceptRouteRecord({ path: "/alias", component: Home, alias: "/a" });

// @ts-expect-error route props mapping is not part of the router beta contract
acceptRouteRecord({ path: "/props", component: Home, props: true });

// @ts-expect-error scroll behavior is not part of the router beta contract
acceptRouterOptions({ history, routes: [], scrollBehavior: () => undefined });

// @ts-expect-error named locations are not part of the router beta contract
acceptRouteLocationRaw({ name: "home" });

// @ts-expect-error hash locations are not part of the router beta contract
acceptRouteLocationRaw({ path: "/", hash: "#section" });

// @ts-expect-error params locations are not part of the router beta contract
acceptRouteLocationRaw({ path: "/users/1", params: { id: "1" } });

// @ts-expect-error object locations must include a string path
acceptRouteLocationRaw({ query: { tab: "profile" } });

describe("router public contract types", () => {
  it("keeps the widened beta route fields typed", () => {
    expect(true).toBe(true);
  });
});
```

- [x] **Step 2: Run type-focused test and verify it fails**

Run:

```bash
pnpm vitest run tests/unit/router/public-contract-types.test.ts
```

Expected: FAIL at TypeScript transform/type assertions because `NavigationGuard`, `RouteComponent`, `lazyRoute`, `children`, `redirect`, `beforeEnter`, `meta`, and async `router.push()` are not in the current public contract.

- [x] **Step 3: Implement public router types**

Replace `src/router/types.ts` with this shape, preserving existing imports:

```ts
import type { App } from "../app";
import type { Ref } from "../reactivity/ref";
import type { ComponentType } from "../vnode/vnode";
import type { Query, QueryInput } from "./query";

export type RouteComponent = ComponentType | LazyRouteComponent;

export interface LazyRouteComponent {
  readonly __solaceLazyRouteComponent: true;
  load(): Promise<{ default: ComponentType } | ComponentType>;
}

export type NavigationGuardResult =
  void | boolean | RouteLocationRaw | Promise<void | boolean | RouteLocationRaw>;

export type NavigationGuard = (
  to: RouteLocationNormalized,
  from: RouteLocationNormalized,
) => NavigationGuardResult;

export interface RouteRecord {
  path: string;
  component?: RouteComponent;
  children?: RouteRecord[];
  redirect?: RouteLocationRaw | ((to: RouteLocationNormalized) => RouteLocationRaw);
  beforeEnter?: NavigationGuard | NavigationGuard[];
  meta?: Record<string, unknown>;
}

export interface RouteLocationNormalized {
  path: string;
  fullPath: string;
  query: Query;
  params: Record<string, string>;
  matched: RouteRecord[];
  redirectedFrom?: RouteLocationNormalized;
}

export type RouteLocationRaw = string | { path: string; query?: QueryInput };

export interface RouterHistory {
  location(): string;
  push(path: string): void;
  replace(path: string): void;
  listen(listener: () => void): () => void;
  back(): void;
  forward(): void;
}

export interface RouterOptions {
  history: RouterHistory;
  routes: RouteRecord[];
}

export interface Router {
  currentRoute: Ref<RouteLocationNormalized>;
  install(app: App): void;
  push(to: RouteLocationRaw): Promise<RouteLocationNormalized>;
  replace(to: RouteLocationRaw): Promise<RouteLocationNormalized>;
  back(): void;
  forward(): void;
  resolve(to: RouteLocationRaw): RouteLocationNormalized;
  beforeEach(guard: NavigationGuard): () => void;
}
```

Create `src/router/lazy.ts`:

```ts
import type { ComponentType } from "../vnode/vnode";
import type { LazyRouteComponent } from "./types";

export function lazyRoute(
  load: () => Promise<{ default: ComponentType } | ComponentType>,
): LazyRouteComponent {
  return {
    __solaceLazyRouteComponent: true,
    load,
  };
}
```

Update `src/router/index.ts`:

```ts
export { RouterLink, RouterView } from "./components";
export { createWebHashHistory, createWebHistory } from "./history";
export { lazyRoute } from "./lazy";
export { createRouter, useRoute, useRouter } from "./router";
export type { RouterLinkProps } from "./components";
export type {
  LazyRouteComponent,
  NavigationGuard,
  NavigationGuardResult,
  RouteComponent,
  RouteLocationNormalized,
  RouteLocationRaw,
  RouteRecord,
  Router,
  RouterHistory,
  RouterOptions,
} from "./types";
```

Update the router type export block in `src/index.ts`:

```ts
export { lazyRoute } from "./router";
export type {
  LazyRouteComponent,
  NavigationGuard,
  NavigationGuardResult,
  RouteComponent,
  RouteLocationNormalized,
  RouteLocationRaw,
  RouteRecord,
  Router,
  RouterHistory,
  RouterOptions,
  RouterLinkProps,
} from "./router";
```

- [x] **Step 4: Run type-focused test and verify it passes**

Run:

```bash
pnpm vitest run tests/unit/router/public-contract-types.test.ts
```

Expected: PASS.

- [x] **Step 5: Commit**

```bash
git add src/router/types.ts src/router/lazy.ts src/router/index.ts src/index.ts tests/unit/router/public-contract-types.test.ts
git commit -m "feat(router): widen beta route types"
```

## Task 2: Nested Route Normalization And Matcher Chains

**Files:**

- Modify: `src/router/matcher.ts`
- Modify: `src/router/router.ts`
- Test: `tests/unit/router/matcher.test.ts`
- Test: `tests/unit/router/router.test.ts`

- [x] **Step 1: Write failing matcher tests**

Append these tests to `tests/unit/router/matcher.test.ts`:

```ts
it("matches nested child routes with a parent chain", () => {
  const Dashboard = () => h("section", null, "dashboard");
  const Settings = () => h("p", null, "settings");
  const matcher = createMatcher([
    {
      path: "/dashboard",
      component: Dashboard,
      children: [{ path: "settings", component: Settings }],
    },
  ]);

  const match = matcher.resolve("/dashboard/settings");

  expect(match.matched.map((record) => record.path)).toEqual(["/dashboard", "settings"]);
  expect(match.params).toEqual({});
});

it("matches index children at the parent path", () => {
  const Dashboard = () => h("section", null, "dashboard");
  const DashboardHome = () => h("p", null, "home");
  const matcher = createMatcher([
    {
      path: "/dashboard",
      component: Dashboard,
      children: [{ path: "", component: DashboardHome }],
    },
  ]);

  const match = matcher.resolve("/dashboard");

  expect(match.matched.map((record) => record.path)).toEqual(["/dashboard", ""]);
});

it("keeps absolute children in the parent chain", () => {
  const AppLayout = () => h("section", null, "app");
  const Account = () => h("p", null, "account");
  const matcher = createMatcher([
    {
      path: "/app",
      component: AppLayout,
      children: [{ path: "/account", component: Account }],
    },
  ]);

  const match = matcher.resolve("/account");

  expect(match.matched.map((record) => record.path)).toEqual(["/app", "/account"]);
});

it("merges parent and child params with child params taking precedence", () => {
  const Team = () => h("section", null, "team");
  const User = () => h("p", null, "user");
  const matcher = createMatcher([
    {
      path: "/teams/:id",
      component: Team,
      children: [{ path: "users/:id", component: User }],
    },
  ]);

  const match = matcher.resolve("/teams/platform/users/42");

  expect(match.params).toEqual({ id: "42" });
});
```

Update existing matcher expectations that read `matched?.path` to read `matched.at(-1)?.path`, and update no-match expectations to expect `matched` as an array.

- [x] **Step 2: Write failing router normalization tests**

In `tests/unit/router/router.test.ts`, update the deferred route field test so `children`, `redirect`, `beforeEnter`, and `meta` are no longer in the rejected list. Keep `name` rejected.

```ts
it("accepts newly designed beta route fields", () => {
  expect(() =>
    createRouter({
      history: createMemoryLikeHistory(),
      routes: [
        {
          path: "/dashboard",
          component: Home,
          meta: { section: "dashboard" },
          beforeEnter: () => true,
          redirect: "/dashboard/home",
          children: [{ path: "home", component: User }],
        },
      ],
    }),
  ).not.toThrow();
});

it("keeps still-deferred route record fields rejected", () => {
  const deferredRecords = [
    { path: "/named", component: Home, name: "home" },
    { path: "/alias", component: Home, alias: "/a" },
    { path: "/props", component: Home, props: true },
  ];

  for (const route of deferredRecords) {
    expect(() =>
      createRouter({
        history: createMemoryLikeHistory(),
        routes: [route] as never,
      }),
    ).toThrow(/Deferred router route record field/);
  }
});
```

- [x] **Step 3: Run router tests and verify they fail**

Run:

```bash
pnpm vitest run tests/unit/router/matcher.test.ts tests/unit/router/router.test.ts
```

Expected: FAIL because matcher still returns a single `matched` record and runtime validation still rejects newly designed route fields.

- [x] **Step 4: Implement internal matcher records**

Refactor `src/router/matcher.ts` around internal records:

```ts
interface CompiledRoute {
  record: RouteRecord;
  chain: RouteRecord[];
  regex: RegExp;
  keys: string[];
  score: number;
}

export interface Matcher {
  resolve(path: string): Pick<RouteLocationNormalized, "path" | "params" | "matched">;
}

export function createMatcher(routes: RouteRecord[]): Matcher {
  const compiled = flattenRoutes(routes)
    .map(compileRoute)
    .sort((a, b) => b.score - a.score);

  return {
    resolve(path: string) {
      const normalized = normalizePath(path);

      for (const route of compiled) {
        const match = route.regex.exec(normalized);
        if (match === null) {
          continue;
        }

        const params: Record<string, string> = {};
        for (let index = 0; index < route.keys.length; index += 1) {
          params[route.keys[index]] = decodeURIComponent(match[index + 1] ?? "");
        }

        return { path: normalized, params, matched: route.chain };
      }

      return { path: normalized, params: {}, matched: [] };
    },
  };
}
```

Add flattening helpers in the same file:

```ts
interface NormalizedRouteRecord {
  record: RouteRecord;
  fullPath: string;
  chain: RouteRecord[];
}

function flattenRoutes(
  routes: RouteRecord[],
  parentPath = "",
  parentChain: RouteRecord[] = [],
): NormalizedRouteRecord[] {
  const records: NormalizedRouteRecord[] = [];

  for (const route of routes) {
    const fullPath = joinRoutePaths(parentPath, route.path);
    const chain = [...parentChain, route];
    const children = route.children ?? [];

    if (route.component !== undefined || route.redirect !== undefined || children.length === 0) {
      records.push({ record: route, fullPath, chain });
    }

    records.push(...flattenRoutes(children, fullPath, chain));
  }

  return records;
}

function joinRoutePaths(parentPath: string, childPath: string): string {
  if (childPath.startsWith("/")) {
    return normalizePath(childPath);
  }

  if (childPath === "") {
    return normalizePath(parentPath || "/");
  }

  return normalizePath(`${parentPath || "/"}/${childPath}`);
}
```

Change `compileRoute(record: RouteRecord)` to `compileRoute(record: NormalizedRouteRecord)` and compile `record.fullPath` while preserving `record.chain`.

- [x] **Step 5: Update route record validation**

In `src/router/router.ts`, change the allowed route record fields:

```ts
const allowedRouteRecordFields = new Set([
  "path",
  "component",
  "children",
  "redirect",
  "beforeEnter",
  "meta",
]);
```

Replace the route loop in `assertRouterOptionsContract()` with recursive validation:

```ts
function assertRouteRecordContract(route: RouteRecord): void {
  for (const key of Object.keys(route)) {
    if (!allowedRouteRecordFields.has(key)) {
      throw new TypeError(
        `Deferred router route record field is not part of the beta contract: ${key}`,
      );
    }
  }

  if (typeof route.path !== "string") {
    throw new TypeError("Router route record path must be a string");
  }

  if (route.children !== undefined) {
    if (!Array.isArray(route.children)) {
      throw new TypeError("Router route record children must be an array");
    }

    for (const child of route.children) {
      assertRouteRecordContract(child);
    }
  }
}
```

Call `assertRouteRecordContract(route)` for every root route.

- [x] **Step 6: Update single-record route expectations**

Update all router tests that use `route.matched?.component` or `route.matched?.path`:

```ts
expect(router.currentRoute.value.matched.at(-1)?.component).toBe(User);
expect(router.currentRoute.value.matched.at(-1)?.path).toBe("/users/:id");
```

For no match:

```ts
expect(router.currentRoute.value.matched).toEqual([]);
```

- [x] **Step 7: Run router tests and verify they pass**

Run:

```bash
pnpm vitest run tests/unit/router/matcher.test.ts tests/unit/router/router.test.ts
```

Expected: PASS.

- [x] **Step 8: Commit**

```bash
git add src/router/matcher.ts src/router/router.ts tests/unit/router/matcher.test.ts tests/unit/router/router.test.ts
git commit -m "feat(router): match nested route chains"
```

## Task 3: RouterView Depth Rendering

**Files:**

- Modify: `src/router/components.ts`
- Modify: `src/router/router.ts`
- Test: `tests/integration/router-component.test.ts`

- [x] **Step 1: Write failing nested RouterView integration tests**

Append these tests to `tests/integration/router-component.test.ts`:

```ts
it("renders nested RouterView depth for parent and child records", async () => {
  const DashboardLayout = () => () =>
    h("section", { id: "layout" }, [h("h1", null, "Dashboard"), h(RouterView)]);
  const Settings = () => h("p", { id: "settings" }, "settings");
  const router = createRouter({
    history: createMemoryLikeHistory("/dashboard/settings"),
    routes: [
      {
        path: "/dashboard",
        component: DashboardLayout,
        children: [{ path: "settings", component: Settings }],
      },
    ],
  });
  const container = document.createElement("div");

  createApp(() => h(RouterView))
    .use(router)
    .mount(container);
  await nextTick();

  expect(container.querySelector("#layout h1")?.textContent).toBe("Dashboard");
  expect(container.querySelector("#settings")?.textContent).toBe("settings");
});

it("renders index children under parent layouts", async () => {
  const DashboardLayout = () => () => h("section", { id: "layout" }, h(RouterView));
  const DashboardHome = () => h("p", { id: "home" }, "dashboard-home");
  const router = createRouter({
    history: createMemoryLikeHistory("/dashboard"),
    routes: [
      {
        path: "/dashboard",
        component: DashboardLayout,
        children: [{ path: "", component: DashboardHome }],
      },
    ],
  });
  const container = document.createElement("div");

  createApp(() => h(RouterView))
    .use(router)
    .mount(container);
  await nextTick();

  expect(container.querySelector("#home")?.textContent).toBe("dashboard-home");
});

it("does not consume RouterView depth for layout-less grouping records", async () => {
  const Settings = () => h("p", { id: "settings" }, "settings");
  const router = createRouter({
    history: createMemoryLikeHistory("/admin/settings"),
    routes: [
      {
        path: "/admin",
        children: [{ path: "settings", component: Settings }],
      },
    ],
  });
  const container = document.createElement("div");

  createApp(() => h(RouterView))
    .use(router)
    .mount(container);
  await nextTick();

  expect(container.querySelector("#settings")?.textContent).toBe("settings");
});
```

- [x] **Step 2: Run integration test and verify it fails**

Run:

```bash
pnpm vitest run tests/integration/router-component.test.ts
```

Expected: FAIL because `RouterView` still renders only a single matched component and has no depth context.

- [x] **Step 3: Add RouterView depth context**

In `src/router/router.ts`, export a depth key:

```ts
export const routerViewDepthKey = Symbol("Solace.routerViewDepth");
```

In `src/router/components.ts`, import `inject` and `provide` plus the new key:

```ts
import { inject, provide } from "../component/provide";
import { routerViewDepthKey, useRoute, useRouter } from "./router";
```

Replace `RouterView()` with:

```ts
export function RouterView(): ComponentRender {
  const route = useRoute();
  const depth = inject<number>(routerViewDepthKey, 0);
  provide(routerViewDepthKey, depth + 1);

  return () => {
    const renderableRecords = route.value.matched.filter(
      (record) => record.component !== undefined,
    );
    const component = renderableRecords[depth]?.component;

    if (component === undefined || component === null) {
      return h(Fragment, null, []);
    }

    return h(component as never);
  };
}
```

This implementation is intentionally eager-only; lazy support is added in Task 6.

- [x] **Step 4: Run integration test and verify it passes**

Run:

```bash
pnpm vitest run tests/integration/router-component.test.ts
```

Expected: PASS.

- [x] **Step 5: Commit**

```bash
git add src/router/components.ts src/router/router.ts tests/integration/router-component.test.ts
git commit -m "feat(router): render nested router views"
```

## Task 4: Async Navigation Pipeline And Redirects

**Files:**

- Modify: `src/router/router.ts`
- Test: `tests/unit/router/router.test.ts`
- Test: `tests/integration/router-component.test.ts`

- [x] **Step 1: Write failing redirect and async navigation tests**

Append to `tests/unit/router/router.test.ts`:

```ts
it("returns the final route from async push and replace", async () => {
  const history = createMemoryLikeHistory("/");
  const router = createRouter({
    history,
    routes: [
      { path: "/", component: Home },
      { path: "/users/:id", component: User },
    ],
  });

  await expect(router.push("/users/42")).resolves.toMatchObject({ fullPath: "/users/42" });
  await expect(router.replace("/")).resolves.toMatchObject({ fullPath: "/" });
});

it("applies string and object redirects before committing history", async () => {
  const history = createMemoryLikeHistory("/");
  const router = createRouter({
    history,
    routes: [
      { path: "/", component: Home },
      { path: "/legacy", redirect: "/users/1" },
      { path: "/old", redirect: { path: "/users/2", query: { tab: "profile" } } },
      { path: "/users/:id", component: User },
    ],
  });

  await expect(router.push("/legacy")).resolves.toMatchObject({
    fullPath: "/users/1",
    redirectedFrom: expect.objectContaining({ fullPath: "/legacy" }),
  });
  expect(history.pushedPaths.at(-1)).toBe("/users/1");

  await router.push("/old");
  expect(history.pushedPaths.at(-1)).toBe("/users/2?tab=profile");
});

it("applies function redirects with the resolved target route", async () => {
  const history = createMemoryLikeHistory("/");
  const router = createRouter({
    history,
    routes: [
      {
        path: "/profile/:id",
        redirect: (to) => ({ path: `/users/${to.params.id}`, query: { tab: "profile" } }),
      },
      { path: "/users/:id", component: User },
    ],
  });

  const route = await router.push("/profile/42");

  expect(route.fullPath).toBe("/users/42?tab=profile");
  expect(route.params).toEqual({ id: "42" });
});

it("rejects redirect loops before mutating history", async () => {
  const history = createMemoryLikeHistory("/");
  const router = createRouter({
    history,
    routes: [
      { path: "/a", redirect: "/b" },
      { path: "/b", redirect: "/a" },
    ],
  });

  await expect(router.push("/a")).rejects.toThrow(/Router redirect loop detected/);
  expect(history.pushedPaths).toEqual([]);
  expect(router.currentRoute.value.fullPath).toBe("/");
});
```

Update existing tests that call `router.push()` or `router.replace()` to `await` those calls.

- [x] **Step 2: Run router tests and verify they fail**

Run:

```bash
pnpm vitest run tests/unit/router/router.test.ts tests/integration/router-component.test.ts
```

Expected: FAIL because navigation is still synchronous and redirects are not applied.

- [x] **Step 3: Add navigation error class**

In `src/router/router.ts`, before `createRouter()`:

```ts
export class RouterNavigationError extends Error {
  constructor(
    message: string,
    readonly type: "redirect-loop" | "guard-rejected" | "lazy-load-failed",
    readonly from: RouteLocationNormalized,
    readonly to: RouteLocationNormalized,
  ) {
    super(message);
    this.name = "RouterNavigationError";
  }
}
```

Export it from `src/router/index.ts`:

```ts
export { createRouter, RouterNavigationError, useRoute, useRouter } from "./router";
```

- [x] **Step 4: Implement shared async navigation**

In `src/router/router.ts`, add `const redirectLimit = 16;` inside `createRouter()`, then replace `push()` and `replace()` with async methods:

```ts
push(to: RouteLocationRaw) {
  return navigate(to, "push");
},
replace(to: RouteLocationRaw) {
  return navigate(to, "replace");
},
```

Add helper functions inside `createRouter()`:

```ts
async function navigate(
  to: RouteLocationRaw,
  mode: "push" | "replace",
): Promise<RouteLocationNormalized> {
  const from = currentRoute.value;
  const redirected = resolveRedirects(resolveLocation(to), from);

  if (mode === "replace") {
    options.history.replace(redirected.fullPath);
  } else {
    options.history.push(redirected.fullPath);
  }

  currentRoute.value = redirected;
  return redirected;
}

function resolveRedirects(
  initial: RouteLocationNormalized,
  from: RouteLocationNormalized,
): RouteLocationNormalized {
  let target = initial;
  let redirectedFrom: RouteLocationNormalized | undefined;

  for (let redirects = 0; redirects <= redirectLimit; redirects += 1) {
    const redirect = target.matched.at(-1)?.redirect;
    if (redirect === undefined) {
      return redirectedFrom === undefined ? target : { ...target, redirectedFrom };
    }

    if (redirectedFrom === undefined) {
      redirectedFrom = target;
    }

    const rawRedirect = typeof redirect === "function" ? redirect(target) : redirect;
    target = resolveLocation(rawRedirect);
  }

  throw new RouterNavigationError("Router redirect loop detected", "redirect-loop", from, target);
}
```

- [x] **Step 5: Run redirect tests and verify they pass**

Run:

```bash
pnpm vitest run tests/unit/router/router.test.ts tests/integration/router-component.test.ts
```

Expected: PASS.

- [x] **Step 6: Commit**

```bash
git add src/router/router.ts src/router/index.ts tests/unit/router/router.test.ts tests/integration/router-component.test.ts
git commit -m "feat(router): add redirect navigation pipeline"
```

## Task 5: Global And Route Navigation Guards

**Files:**

- Modify: `src/router/router.ts`
- Test: `tests/unit/router/router.test.ts`

- [x] **Step 1: Write failing guard tests**

Append to `tests/unit/router/router.test.ts`:

```ts
it("runs global beforeEach guards in registration order", async () => {
  const calls: string[] = [];
  const router = createRouter({
    history: createMemoryLikeHistory("/"),
    routes: [
      { path: "/", component: Home },
      { path: "/users/:id", component: User },
    ],
  });

  router.beforeEach((to, from) => {
    calls.push(`first:${from.fullPath}->${to.fullPath}`);
  });
  router.beforeEach((to) => {
    calls.push(`second:${to.params.id}`);
  });

  await router.push("/users/42");

  expect(calls).toEqual(["first:/->/users/42", "second:42"]);
});

it("unsubscribes global beforeEach guards", async () => {
  const guard = vi.fn();
  const router = createRouter({
    history: createMemoryLikeHistory("/"),
    routes: [
      { path: "/", component: Home },
      { path: "/users/:id", component: User },
    ],
  });
  const stop = router.beforeEach(guard);

  stop();
  await router.push("/users/42");

  expect(guard).not.toHaveBeenCalled();
});

it("runs route beforeEnter guards from parent to child", async () => {
  const calls: string[] = [];
  const router = createRouter({
    history: createMemoryLikeHistory("/"),
    routes: [
      { path: "/", component: Home },
      {
        path: "/dashboard",
        component: Home,
        beforeEnter: () => {
          calls.push("parent");
        },
        children: [
          {
            path: "settings",
            component: User,
            beforeEnter: [
              () => {
                calls.push("child-a");
              },
              () => {
                calls.push("child-b");
              },
            ],
          },
        ],
      },
    ],
  });

  await router.push("/dashboard/settings");

  expect(calls).toEqual(["parent", "child-a", "child-b"]);
});

it("cancels navigation when a guard returns false", async () => {
  const history = createMemoryLikeHistory("/");
  const router = createRouter({
    history,
    routes: [
      { path: "/", component: Home },
      { path: "/blocked", component: User },
    ],
  });
  router.beforeEach(() => false);

  const result = await router.push("/blocked");

  expect(result.fullPath).toBe("/");
  expect(router.currentRoute.value.fullPath).toBe("/");
  expect(history.pushedPaths).toEqual([]);
});

it("redirects when a guard returns a location", async () => {
  const history = createMemoryLikeHistory("/");
  const router = createRouter({
    history,
    routes: [
      { path: "/", component: Home },
      { path: "/blocked", component: User },
      { path: "/login", component: Home },
    ],
  });
  router.beforeEach((to) => (to.fullPath === "/blocked" ? "/login" : true));

  const result = await router.push("/blocked");

  expect(result.fullPath).toBe("/login");
  expect(history.pushedPaths).toEqual(["/login"]);
});

it("rejects guard errors without mutating history or current route", async () => {
  const history = createMemoryLikeHistory("/");
  const router = createRouter({
    history,
    routes: [
      { path: "/", component: Home },
      { path: "/boom", component: User },
    ],
  });
  router.beforeEach(() => {
    throw new Error("guard exploded");
  });

  await expect(router.push("/boom")).rejects.toThrow(/Router guard rejected/);
  expect(history.pushedPaths).toEqual([]);
  expect(router.currentRoute.value.fullPath).toBe("/");
});
```

- [x] **Step 2: Run guard tests and verify they fail**

Run:

```bash
pnpm vitest run tests/unit/router/router.test.ts
```

Expected: FAIL because `beforeEach()` and guard execution are not implemented.

- [x] **Step 3: Implement guard registration and execution**

In `src/router/router.ts`, inside `createRouter()`:

```ts
const beforeEachGuards: NavigationGuard[] = [];
```

Add to the router object:

```ts
beforeEach(guard: NavigationGuard) {
  beforeEachGuards.push(guard);

  return () => {
    const index = beforeEachGuards.indexOf(guard);
    if (index >= 0) {
      beforeEachGuards.splice(index, 1);
    }
  };
},
```

Update `navigate()` before history commit:

```ts
const guarded = await runGuards(redirected, from);
if (guarded === false) {
  return from;
}

const finalRoute = guarded === true ? redirected : resolveRedirects(resolveLocation(guarded), from);
```

Then commit `finalRoute`.

Add guard helpers inside `createRouter()`:

```ts
async function runGuards(
  to: RouteLocationNormalized,
  from: RouteLocationNormalized,
): Promise<true | false | RouteLocationRaw> {
  const guards = [
    ...beforeEachGuards,
    ...to.matched.flatMap((record) => normalizeGuards(record.beforeEnter)),
  ];

  try {
    for (const guard of guards) {
      const result = await guard(to, from);

      if (result === false) {
        return false;
      }

      if (typeof result === "string" || (result !== undefined && result !== true)) {
        return result;
      }
    }
  } catch (error) {
    throw new RouterNavigationError("Router guard rejected", "guard-rejected", from, to);
  }

  return true;
}

function normalizeGuards(guards: RouteRecord["beforeEnter"]): NavigationGuard[] {
  if (guards === undefined) {
    return [];
  }

  return Array.isArray(guards) ? guards : [guards];
}
```

- [x] **Step 4: Run guard tests and verify they pass**

Run:

```bash
pnpm vitest run tests/unit/router/router.test.ts
```

Expected: PASS.

- [x] **Step 5: Commit**

```bash
git add src/router/router.ts tests/unit/router/router.test.ts
git commit -m "feat(router): add navigation guards"
```

## Task 6: Lazy Route Component Rendering

**Files:**

- Modify: `src/router/types.ts`
- Modify: `src/router/components.ts`
- Test: `tests/integration/router-component.test.ts`

- [x] **Step 1: Write failing lazy component tests**

Append to `tests/integration/router-component.test.ts`:

Update the top-level import from `../../src/index` to include `lazyRoute`.

```ts
it("renders lazy route components after they resolve", async () => {
  const LazyUser = lazyRoute(() => Promise.resolve(() => h("p", { id: "lazy-user" }, "lazy-user")));
  const router = createRouter({
    history: createMemoryLikeHistory("/lazy"),
    routes: [{ path: "/lazy", component: LazyUser }],
  });
  const container = document.createElement("div");

  createApp(() => h(RouterView))
    .use(router)
    .mount(container);
  expect(container.innerHTML).toBe("");

  await nextTick();
  await Promise.resolve();
  await nextTick();

  expect(container.querySelector("#lazy-user")?.textContent).toBe("lazy-user");
});

it("renders lazy default exports after they resolve", async () => {
  const LazyUser = lazyRoute(() =>
    Promise.resolve({ default: () => h("p", { id: "lazy-default" }, "lazy-default") }),
  );
  const router = createRouter({
    history: createMemoryLikeHistory("/lazy-default"),
    routes: [{ path: "/lazy-default", component: LazyUser }],
  });
  const container = document.createElement("div");

  createApp(() => h(RouterView))
    .use(router)
    .mount(container);
  await nextTick();
  await Promise.resolve();
  await nextTick();

  expect(container.querySelector("#lazy-default")?.textContent).toBe("lazy-default");
});
```

- [x] **Step 2: Run lazy component tests and verify they fail**

Run:

```bash
pnpm vitest run tests/integration/router-component.test.ts
```

Expected: FAIL because `RouterView` does not resolve explicit lazy route component wrappers yet.

- [x] **Step 3: Add lazy route component cache fields**

In `src/router/components.ts`, add:

```ts
const lazyRouteComponentCache = new WeakMap<object, ComponentType>();
const lazyRouteComponentPending = new WeakMap<object, Promise<ComponentType>>();
```

Add helpers:

```ts
function resolveRouteComponent(record: RouteRecord): ComponentType | null {
  const component = record.component;
  if (component === undefined) {
    return null;
  }

  if (!isLazyRouteComponent(component)) {
    return component;
  }

  const cached = lazyRouteComponentCache.get(component);
  if (cached !== undefined) {
    return cached;
  }

  if (!lazyRouteComponentPending.has(component)) {
    const pending = component.load().then((resolved) => {
      const resolvedComponent = typeof resolved === "function" ? resolved : resolved.default;
      lazyRouteComponentCache.set(component, resolvedComponent);
      lazyRouteComponentPending.delete(component);
      return resolvedComponent;
    });
    lazyRouteComponentPending.set(component, pending);
  }

  return null;
}

function isLazyRouteComponent(component: RouteComponent): component is LazyRouteComponent {
  return typeof component === "object" && component.__solaceLazyRouteComponent === true;
}
```

- [x] **Step 4: Update RouterView lazy rendering**

In `RouterView`, call `resolveRouteComponent(record)` instead of reading `record.component` directly:

```ts
const component = resolveRouteComponent(record);
return component === null ? h(Fragment, null, []) : h(component);
```

Import `LazyRouteComponent`, `RouteComponent`, and `RouteRecord` from `src/router/types.ts`.

- [x] **Step 5: Run lazy tests and verify they pass**

Run:

```bash
pnpm vitest run tests/integration/router-component.test.ts tests/unit/router/public-contract-types.test.ts
```

Expected: PASS.

- [x] **Step 6: Commit**

```bash
git add src/router/types.ts src/router/lazy.ts src/router/components.ts src/router/index.ts src/index.ts tests/integration/router-component.test.ts tests/unit/router/public-contract-types.test.ts
git commit -m "feat(router): add lazy route components"
```

## Task 7: Package Boundary And Example Coverage

**Files:**

- Modify: `tests/integration/package-exports.test.ts`
- Modify: `scripts/package-consumer-smoke.mjs`
- Modify: `examples/router-basic/src/main.tsx`
- Modify: `tests/e2e/router-basic.spec.ts`

- [x] **Step 1: Update package export tests**

In `tests/integration/package-exports.test.ts`, update the root API expectation to include `lazyRoute` and remove negative checks for `NavigationGuard`/`RouteMeta` if they are type-only. Keep `createMemoryHistory` and `createSSRRouter` negative checks.

```ts
expect(api).toMatchObject({
  createRouter: expect.any(Function),
  lazyRoute: expect.any(Function),
});
expect(api).not.toHaveProperty("createMemoryHistory");
expect(api).not.toHaveProperty("createSSRRouter");
```

Update router boundary test so `children`, `redirect`, `beforeEnter`, and `meta` are accepted, while `name`, `alias`, `props`, and `scrollBehavior` still throw.

- [x] **Step 2: Update packed consumer smoke**

In `scripts/package-consumer-smoke.mjs`, update the generated `src/main.tsx` import:

```ts
import {
  RouterLink,
  RouterView,
  createApp,
  createRouter,
  createStore,
  createWebHashHistory,
  createWebHistory,
  defineAsyncComponent,
  defineComponent,
  h,
  inject,
  lazyRoute,
  reactive,
  useRoute,
  useRouter,
  watchEffect,
} from "@italone/solace";
```

Use widened router APIs:

```ts
const routeGuard = () => true;
const router = createRouter({
  history: memoryHistory,
  routes: [
    {
      path: "/",
      component: () => h("p", null, "home"),
      meta: { public: true },
      children: [
        { path: "child", component: lazyRoute(() => Promise.resolve(() => h("p", null, "child"))) },
      ],
    },
    { path: "/legacy", redirect: "/" },
    { path: "/guarded", component: () => h("p", null, "guarded"), beforeEnter: routeGuard },
  ],
});
await router.push("/child");
```

In the generated `src/public-contract-types.ts`, import and accept:

```ts
import type { NavigationGuard, RouteComponent } from "@italone/solace";

const guard: NavigationGuard = () => true;
const lazyComponent: RouteComponent = lazyRoute(() => Promise.resolve(Home));
acceptRouteRecord({
  path: "/dashboard",
  component: Home,
  beforeEnter: guard,
  meta: { section: "dashboard" },
  children: [{ path: "settings", component: lazyComponent }],
});
acceptRouteRecord({ path: "/legacy", redirect: "/dashboard/settings" });
```

Keep existing `@ts-expect-error` checks for still-deferred fields.

- [x] **Step 3: Expand router example**

Update `examples/router-basic/src/main.tsx` with visible routes:

```tsx
const DashboardLayout = () => () =>
  h("section", { id: "dashboard" }, [
    h("h2", null, "Dashboard"),
    h(RouterLink, { to: "/dashboard/settings", id: "settings-link" }, "Settings"),
    h(RouterView),
  ]);

const DashboardHome = () => h("p", { id: "dashboard-home" }, "Dashboard home");
const Settings = () => h("p", { id: "settings" }, "Settings");
const Login = () => h("p", { id: "login" }, "Login");
const LazyReport = lazyRoute(() =>
  Promise.resolve(() => h("p", { id: "lazy-report" }, "Lazy report")),
);

let authenticated = false;
const router = createRouter({
  history: createWebHashHistory(),
  routes: [
    { path: "/", component: Home },
    { path: "/old-home", redirect: "/" },
    { path: "/login", component: Login },
    {
      path: "/dashboard",
      component: DashboardLayout,
      beforeEnter: () => authenticated || "/login",
      children: [
        { path: "", component: DashboardHome },
        { path: "settings", component: Settings },
        { path: "report", component: LazyReport },
      ],
    },
    { path: "/:pathMatch(.*)*", component: NotFound },
  ],
});
```

Add a small login button in the example that sets `authenticated = true` and calls `router.push("/dashboard")`.

- [x] **Step 4: Update router e2e**

In `tests/e2e/router-basic.spec.ts`, add assertions:

```ts
await page.goto("/#/old-home");
await expect(page.locator("#home")).toContainText("home");

await page.goto("/#/dashboard");
await expect(page.locator("#login")).toContainText("Login");

await page.getByRole("button", { name: "Sign in" }).click();
await expect(page.locator("#dashboard-home")).toContainText("Dashboard home");

await page.locator("#settings-link").click();
await expect(page.locator("#settings")).toContainText("Settings");

await page.goto("/#/dashboard/report");
await expect(page.locator("#lazy-report")).toContainText("Lazy report");
```

- [x] **Step 5: Run package and e2e checks**

Run:

```bash
pnpm vitest run tests/integration/package-exports.test.ts
pnpm package:smoke
pnpm test:e2e
```

Expected: all PASS.

- [x] **Step 6: Commit**

```bash
git add tests/integration/package-exports.test.ts scripts/package-consumer-smoke.mjs examples/router-basic/src/main.tsx tests/e2e/router-basic.spec.ts
git commit -m "test(router): cover expanded beta package surface"
```

## Task 8: Documentation And Release Status

**Files:**

- Modify: `docs/api.md`
- Modify: `docs/api.zh-CN.md`
- Modify: `docs/package-usage.md`
- Modify: `docs/examples.md`
- Modify: `docs/roadmap.md`
- Modify: `docs/project-status.md`
- Modify: `readme.md`
- Modify: `readme.zh-CN.md`

- [x] **Step 1: Update English API docs**

In `docs/api.md`, update the Router section to state:

```md
The beta router now supports nested route records, redirects, global `beforeEach` guards,
route-level `beforeEnter` guards, route `meta` data for guard inputs, and route-level lazy
components through `lazyRoute()`.
```

Add examples for:

```ts
router.beforeEach((to) =>
  to.matched.some((record) => record.meta?.requiresAuth) ? "/login" : true,
);
```

and:

```ts
{ path: "report", component: lazyRoute(() => import("./Report")) }
```

Keep limitations explicit:

```md
Named routes, aliases, route props, scroll behavior, memory history, auth/permission semantics,
and SSR/SSG/hydration router integration remain deferred.
```

- [x] **Step 2: Update Chinese API docs**

Mirror the same content in `docs/api.zh-CN.md`, using the same public API names and the same deferred list.

- [x] **Step 3: Update README and package usage**

Update `readme.md`, `readme.zh-CN.md`, and `docs/package-usage.md` so the router examples mention nested routes, redirects, guards, and `lazyRoute()`.

- [x] **Step 4: Update status and roadmap**

In `docs/roadmap.md`, move nested routes, redirects, guards, and lazy route components out of the router deferred list and keep scroll behavior, memory history, SSR integration, auth, and permissions deferred.

In `docs/project-status.md`, update Router evidence to include the next beta slice and update Known Gaps accordingly.

- [x] **Step 5: Format docs**

Run:

```bash
pnpm exec prettier --write docs/api.md docs/api.zh-CN.md docs/package-usage.md docs/examples.md docs/roadmap.md docs/project-status.md readme.md readme.zh-CN.md
```

Expected: Prettier completes successfully.

- [x] **Step 6: Commit**

```bash
git add docs/api.md docs/api.zh-CN.md docs/package-usage.md docs/examples.md docs/roadmap.md docs/project-status.md readme.md readme.zh-CN.md
git commit -m "docs(router): document expanded beta surface"
```

## Task 9: Final Validation And Sync

**Files:**

- Verify repository state only.

- [x] **Step 1: Run router-focused tests**

Run:

```bash
pnpm vitest run tests/unit/router tests/integration/router-component.test.ts
```

Expected: PASS.

- [x] **Step 2: Run package boundary checks**

Run:

```bash
pnpm package:smoke
```

Expected: PASS, including packed consumer TypeScript checks and Vite production build.

- [x] **Step 3: Run quality gate**

Run:

```bash
pnpm quality
```

Expected: PASS.

- [x] **Step 4: Run browser e2e**

Run:

```bash
pnpm test:e2e
```

Expected: PASS.

- [x] **Step 5: Run release readiness**

Run:

```bash
pnpm release:readiness -- --publishable
```

Expected: PASS if the branch is synchronized and clean. If it fails because the branch is ahead after local commits, push first, fetch, and rerun.

- [x] **Step 6: Push main**

Run:

```bash
git push origin main
git -c http.version=HTTP/1.1 fetch origin main
git status --short --branch
git rev-list --left-right --count origin/main...main
```

Expected:

```text
## main...origin/main
0 0
```

If normal `git push` hits the known GitHub HTTP/2 connection failure, retry:

```bash
git -c http.version=HTTP/1.1 push origin main
```

## Self-Review

- Spec coverage: nested routes, redirects, guards, lazy route components, docs, package smoke, and final validation all have tasks.
- Incomplete-marker scan: no unfinished marker strings or incomplete implementation slots are present.
- Type consistency: `RouteComponent`, `NavigationGuard`, `NavigationGuardResult`, `RouteLocationNormalized.matched`, `Router.beforeEach()`, and async `push/replace` are introduced in Task 1 and reused consistently.
- Scope control: named routes, aliases, route props, scroll behavior, memory history, auth/permission semantics, and SSR/SSG/hydration router integration remain deferred across design, tests, docs, and package checks.
