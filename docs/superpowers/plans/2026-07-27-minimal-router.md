# Minimal Router Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement the beta first-party Solace SPA router described in `docs/superpowers/specs/2026-07-27-minimal-router-design.md`.

**Architecture:** Add a focused `src/router/` module that follows existing Solace patterns: a router plugin installed with `app.use()`, shared state through app-level `provide`, reactive route state with `ref`, rendering through function components, and public exports from the root package. Keep the first router slice small: static routes, dynamic params, wildcard not-found, query strings, web/hash history, `RouterView`, `RouterLink`, and composition helpers.

**Tech Stack:** TypeScript, Solace runtime APIs, jsdom, Vitest, Playwright, Rollup, pnpm.

---

## File Structure

- Create `src/router/types.ts`: public and internal router type definitions.
- Create `src/router/query.ts`: query parse/stringify helpers.
- Create `src/router/matcher.ts`: route record normalization and path matching.
- Create `src/router/history.ts`: web/hash history adapters.
- Create `src/router/router.ts`: router creation, current route state, install hook, navigation methods, injection keys, hooks.
- Create `src/router/components.ts`: `RouterView` and `RouterLink` function components.
- Create `src/router/index.ts`: router module public exports.
- Modify `src/index.ts`: export router APIs and types from the root package.
- Create `tests/unit/router/query.test.ts`.
- Create `tests/unit/router/matcher.test.ts`.
- Create `tests/unit/router/history.test.ts`.
- Create `tests/unit/router/router.test.ts`.
- Create `tests/integration/router-component.test.ts`.
- Modify `tests/integration/package-exports.test.ts`.
- Modify `scripts/package-consumer-smoke.mjs`.
- Create `examples/router-basic/index.html`.
- Create `examples/router-basic/vite.config.ts`.
- Create `examples/router-basic/src/main.tsx`.
- Modify `package.json` with `dev:router`.
- Modify `playwright.config.ts` and add `tests/e2e/router-basic.spec.ts` after integration tests are green.
- Modify docs: `docs/api.md`, `docs/api.zh-CN.md`, `docs/package-usage.md`, `docs/examples.md`, `docs/project-status.md`, `docs/project-status.zh-CN.md`, `docs/roadmap.md`, `readme.md`, `readme.zh-CN.md`.

---

### Task 1: Query Helpers

**Files:**

- Create: `src/router/query.ts`
- Test: `tests/unit/router/query.test.ts`

- [x] **Step 1: Write failing query tests**

Create `tests/unit/router/query.test.ts`:

```ts
import { describe, expect, it } from "vitest";

import { parseQuery, stringifyQuery } from "../../../src/router/query";

describe("router query helpers", () => {
  it("parses empty and single-value queries", () => {
    expect(parseQuery("")).toEqual({});
    expect(parseQuery("?tab=profile")).toEqual({ tab: "profile" });
  });

  it("parses repeated keys and empty values", () => {
    expect(parseQuery("?tag=a&tag=b&empty=")).toEqual({ tag: ["a", "b"], empty: "" });
  });

  it("decodes keys and values", () => {
    expect(parseQuery("?redirect=%2Fusers%2F1&space=a%20b")).toEqual({
      redirect: "/users/1",
      space: "a b",
    });
  });

  it("stringifies primitive values and skips nullish values", () => {
    expect(
      stringifyQuery({
        tab: "profile",
        page: 2,
        active: true,
        empty: "",
        skip: null,
        omit: undefined,
      }),
    ).toBe("?tab=profile&page=2&active=true&empty=");
  });

  it("stringifies repeated array keys", () => {
    expect(stringifyQuery({ tag: ["a", "b"] })).toBe("?tag=a&tag=b");
  });
});
```

- [x] **Step 2: Run query tests to verify RED**

Run:

```bash
pnpm vitest run tests/unit/router/query.test.ts
```

Expected: fails because `src/router/query.ts` does not exist.

- [x] **Step 3: Implement query helpers**

Create `src/router/query.ts`:

```ts
export type QueryValue = string | string[];
export type Query = Record<string, QueryValue>;
export type QueryInputValue = string | number | boolean | null | undefined;
export type QueryInput = Record<string, QueryInputValue | QueryInputValue[]>;

export function parseQuery(search: string): Query {
  const query: Query = {};
  const normalized = search.startsWith("?") ? search.slice(1) : search;

  if (normalized === "") {
    return query;
  }

  for (const part of normalized.split("&")) {
    if (part === "") {
      continue;
    }

    const [rawKey, rawValue = ""] = part.split("=");
    const key = decodeURIComponent(rawKey);
    const value = decodeURIComponent(rawValue);
    const existing = query[key];

    if (existing === undefined) {
      query[key] = value;
    } else if (Array.isArray(existing)) {
      existing.push(value);
    } else {
      query[key] = [existing, value];
    }
  }

  return query;
}

export function stringifyQuery(query: QueryInput = {}): string {
  const parts: string[] = [];

  for (const [key, value] of Object.entries(query)) {
    if (Array.isArray(value)) {
      for (const item of value) {
        pushQueryPart(parts, key, item);
      }
    } else {
      pushQueryPart(parts, key, value);
    }
  }

  return parts.length === 0 ? "" : `?${parts.join("&")}`;
}

function pushQueryPart(parts: string[], key: string, value: QueryInputValue): void {
  if (value === null || value === undefined) {
    return;
  }

  parts.push(`${encodeURIComponent(key)}=${encodeURIComponent(String(value))}`);
}
```

- [x] **Step 4: Run query tests to verify GREEN**

Run:

```bash
pnpm vitest run tests/unit/router/query.test.ts
```

Expected: all query tests pass.

- [x] **Step 5: Commit query helpers**

Run:

```bash
git add src/router/query.ts tests/unit/router/query.test.ts
git commit -m "feat: add router query helpers"
```

---

### Task 2: Matcher And Router Types

**Files:**

- Create: `src/router/types.ts`
- Create: `src/router/matcher.ts`
- Test: `tests/unit/router/matcher.test.ts`

- [x] **Step 1: Write failing matcher tests**

Create `tests/unit/router/matcher.test.ts`:

```ts
import { describe, expect, it } from "vitest";

import { createMatcher } from "../../../src/router/matcher";
import type { RouteRecord } from "../../../src/router/types";

const Home = () => ({
  type: "div",
  props: null,
  key: null,
  children: "home",
  shapeFlag: 1,
  el: null,
  component: null,
});
const User = Home;
const Settings = Home;
const NotFound = Home;

describe("router matcher", () => {
  const routes: RouteRecord[] = [
    { path: "/users/:id", component: User },
    { path: "/users/settings", component: Settings },
    { path: "/", component: Home },
    { path: "/:pathMatch(.*)*", component: NotFound },
  ];

  it("matches static routes before dynamic routes", () => {
    const matcher = createMatcher(routes);
    const match = matcher.resolve("/users/settings");

    expect(match.matched?.path).toBe("/users/settings");
    expect(match.params).toEqual({});
  });

  it("extracts dynamic params", () => {
    const matcher = createMatcher(routes);
    const match = matcher.resolve("/users/42");

    expect(match.matched?.path).toBe("/users/:id");
    expect(match.params).toEqual({ id: "42" });
  });

  it("normalizes trailing slashes", () => {
    const matcher = createMatcher(routes);

    expect(matcher.resolve("/users/42/").params).toEqual({ id: "42" });
  });

  it("matches wildcard not found route last", () => {
    const matcher = createMatcher(routes);
    const match = matcher.resolve("/missing/path");

    expect(match.matched?.path).toBe("/:pathMatch(.*)*");
    expect(match.params).toEqual({ pathMatch: "missing/path" });
  });
});
```

- [x] **Step 2: Run matcher tests to verify RED**

Run:

```bash
pnpm vitest run tests/unit/router/matcher.test.ts
```

Expected: fails because matcher/types files do not exist.

- [x] **Step 3: Add router types**

Create `src/router/types.ts`:

```ts
import type { App } from "../app";
import type { Ref } from "../reactivity/ref";
import type { ComponentType } from "../vnode/vnode";
import type { Query, QueryInput } from "./query";

export interface RouteRecord {
  path: string;
  component: ComponentType;
}

export interface RouteLocationNormalized {
  path: string;
  fullPath: string;
  query: Query;
  params: Record<string, string>;
  matched: RouteRecord | null;
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
  push(to: RouteLocationRaw): void;
  replace(to: RouteLocationRaw): void;
  back(): void;
  forward(): void;
  resolve(to: RouteLocationRaw): RouteLocationNormalized;
}
```

- [x] **Step 4: Implement matcher**

Create `src/router/matcher.ts`:

```ts
import type { RouteLocationNormalized, RouteRecord } from "./types";

interface CompiledRoute {
  record: RouteRecord;
  regex: RegExp;
  keys: string[];
  score: number;
  wildcard: boolean;
}

export interface Matcher {
  resolve(path: string): Pick<RouteLocationNormalized, "path" | "params" | "matched">;
}

export function createMatcher(routes: RouteRecord[]): Matcher {
  const compiled = routes.map(compileRoute).sort((a, b) => b.score - a.score);

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

        return { path: normalized, params, matched: route.record };
      }

      return { path: normalized, params: {}, matched: null };
    },
  };
}

function compileRoute(record: RouteRecord): CompiledRoute {
  const normalized = normalizePath(record.path);

  if (normalized === "/:pathMatch(.*)*") {
    return {
      record,
      regex: /^\/(.*)$/,
      keys: ["pathMatch"],
      score: 0,
      wildcard: true,
    };
  }

  const keys: string[] = [];
  const segments = normalized.split("/").filter(Boolean);
  let score = normalized === "/" ? 100 : 0;
  const pattern = segments
    .map((segment) => {
      if (segment.startsWith(":")) {
        keys.push(segment.slice(1));
        score += 1;
        return "([^/]+)";
      }

      score += 10;
      return escapeRegExp(segment);
    })
    .join("/");

  return {
    record,
    regex: new RegExp(`^/${pattern}$`),
    keys,
    score,
    wildcard: false,
  };
}

export function normalizePath(path: string): string {
  const withoutQuery = path.split("?")[0] || "/";
  const withLeadingSlash = withoutQuery.startsWith("/") ? withoutQuery : `/${withoutQuery}`;
  const trimmed =
    withLeadingSlash.length > 1 ? withLeadingSlash.replace(/\/+$/, "") : withLeadingSlash;

  return trimmed === "" ? "/" : trimmed;
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
```

- [x] **Step 5: Run matcher tests to verify GREEN**

Run:

```bash
pnpm vitest run tests/unit/router/matcher.test.ts
```

Expected: all matcher tests pass.

- [x] **Step 6: Commit matcher and types**

Run:

```bash
git add src/router/types.ts src/router/matcher.ts tests/unit/router/matcher.test.ts
git commit -m "feat: add router matcher"
```

---

### Task 3: History Adapters

**Files:**

- Create: `src/router/history.ts`
- Test: `tests/unit/router/history.test.ts`

- [x] **Step 1: Write failing history tests**

Create `tests/unit/router/history.test.ts`:

```ts
import { describe, expect, it, vi } from "vitest";

import { createWebHashHistory, createWebHistory } from "../../../src/router/history";

describe("router history", () => {
  it("reads, pushes, and replaces web history paths", () => {
    window.history.replaceState(null, "", "/start?tab=one");
    const history = createWebHistory();

    expect(history.location()).toBe("/start?tab=one");

    history.push("/next?tab=two");
    expect(window.location.pathname).toBe("/next");
    expect(window.location.search).toBe("?tab=two");

    history.replace("/final");
    expect(history.location()).toBe("/final");
  });

  it("notifies listeners on popstate", () => {
    const history = createWebHistory();
    const listener = vi.fn();
    const stop = history.listen(listener);

    window.dispatchEvent(new PopStateEvent("popstate"));
    stop();
    window.dispatchEvent(new PopStateEvent("popstate"));

    expect(listener).toHaveBeenCalledTimes(1);
  });

  it("normalizes hash history paths", () => {
    window.history.replaceState(null, "", "/#/users/1?tab=profile");
    const history = createWebHashHistory();

    expect(history.location()).toBe("/users/1?tab=profile");

    history.push("/settings");
    expect(window.location.hash).toBe("#/settings");
  });
});
```

- [x] **Step 2: Run history tests to verify RED**

Run:

```bash
pnpm vitest run tests/unit/router/history.test.ts
```

Expected: fails because `src/router/history.ts` does not exist.

- [x] **Step 3: Implement history adapters**

Create `src/router/history.ts`:

```ts
import type { RouterHistory } from "./types";

export function createWebHistory(): RouterHistory {
  return {
    location: () => `${window.location.pathname}${window.location.search}` || "/",
    push: (path) => window.history.pushState(null, "", path),
    replace: (path) => window.history.replaceState(null, "", path),
    listen(listener) {
      window.addEventListener("popstate", listener);
      return () => window.removeEventListener("popstate", listener);
    },
    back: () => window.history.back(),
    forward: () => window.history.forward(),
  };
}

export function createWebHashHistory(): RouterHistory {
  return {
    location: () => normalizeHashLocation(window.location.hash),
    push: (path) => window.history.pushState(null, "", `#${normalizeHashTarget(path)}`),
    replace: (path) => window.history.replaceState(null, "", `#${normalizeHashTarget(path)}`),
    listen(listener) {
      window.addEventListener("popstate", listener);
      window.addEventListener("hashchange", listener);
      return () => {
        window.removeEventListener("popstate", listener);
        window.removeEventListener("hashchange", listener);
      };
    },
    back: () => window.history.back(),
    forward: () => window.history.forward(),
  };
}

function normalizeHashLocation(hash: string): string {
  const value = hash.startsWith("#") ? hash.slice(1) : hash;
  return normalizeHashTarget(value);
}

function normalizeHashTarget(path: string): string {
  if (path === "" || path === "/") {
    return "/";
  }

  return path.startsWith("/") ? path : `/${path}`;
}
```

- [x] **Step 4: Run history tests to verify GREEN**

Run:

```bash
pnpm vitest run tests/unit/router/history.test.ts
```

Expected: all history tests pass.

- [x] **Step 5: Commit history adapters**

Run:

```bash
git add src/router/history.ts tests/unit/router/history.test.ts
git commit -m "feat: add router history adapters"
```

---

### Task 4: Router Core And Hooks

**Files:**

- Create: `src/router/router.ts`
- Test: `tests/unit/router/router.test.ts`

- [x] **Step 1: Write failing router core tests**

Create `tests/unit/router/router.test.ts`:

```ts
import { describe, expect, it, vi } from "vitest";

import { createRouter } from "../../../src/router/router";
import type { RouterHistory } from "../../../src/router/types";

const Home = () => ({
  type: "div",
  props: null,
  key: null,
  children: "home",
  shapeFlag: 1,
  el: null,
  component: null,
});
const User = Home;
const NotFound = Home;

function createMemoryLikeHistory(initial = "/"): RouterHistory & { emit(): void } {
  let current = initial;
  const listeners = new Set<() => void>();

  return {
    location: () => current,
    push(path) {
      current = path;
    },
    replace(path) {
      current = path;
    },
    listen(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    back: vi.fn(),
    forward: vi.fn(),
    emit() {
      for (const listener of listeners) {
        listener();
      }
    },
  };
}

describe("createRouter", () => {
  it("resolves string and object locations", () => {
    const router = createRouter({
      history: createMemoryLikeHistory(),
      routes: [{ path: "/users/:id", component: User }],
    });

    expect(router.resolve("/users/42?tab=profile")).toMatchObject({
      path: "/users/42",
      fullPath: "/users/42?tab=profile",
      params: { id: "42" },
      query: { tab: "profile" },
    });
    expect(router.resolve({ path: "/users/1", query: { active: true } }).fullPath).toBe(
      "/users/1?active=true",
    );
  });

  it("updates currentRoute when navigating", () => {
    const history = createMemoryLikeHistory("/");
    const router = createRouter({
      history,
      routes: [
        { path: "/", component: Home },
        { path: "/users/:id", component: User },
      ],
    });

    router.push("/users/42?tab=profile");

    expect(router.currentRoute.value.fullPath).toBe("/users/42?tab=profile");
    expect(router.currentRoute.value.params).toEqual({ id: "42" });
  });

  it("updates from history listeners after install", () => {
    const history = createMemoryLikeHistory("/");
    const router = createRouter({ history, routes: [{ path: "/", component: Home }] });
    const app = { provide: vi.fn(), use: vi.fn(), mount: vi.fn() };

    router.install(app as never);
    history.push("/missing");
    history.emit();

    expect(router.currentRoute.value.matched).toBeNull();
  });

  it("matches wildcard routes", () => {
    const router = createRouter({
      history: createMemoryLikeHistory("/missing/path"),
      routes: [{ path: "/:pathMatch(.*)*", component: NotFound }],
    });

    expect(router.currentRoute.value.params).toEqual({ pathMatch: "missing/path" });
  });
});
```

- [x] **Step 2: Run router core tests to verify RED**

Run:

```bash
pnpm vitest run tests/unit/router/router.test.ts
```

Expected: fails because `src/router/router.ts` does not exist.

- [x] **Step 3: Implement router core and hooks**

Create `src/router/router.ts`:

```ts
import type { App } from "../app";
import { inject } from "../component/provide";
import { ref } from "../reactivity/ref";
import { createMatcher } from "./matcher";
import { parseQuery, stringifyQuery } from "./query";
import type { RouteLocationNormalized, RouteLocationRaw, Router, RouterOptions } from "./types";

export const routerKey = Symbol("Solace.router");
export const routeKey = Symbol("Solace.route");

export function createRouter(options: RouterOptions): Router {
  const matcher = createMatcher(options.routes);
  let stopListening: (() => void) | null = null;
  const currentRoute = ref(resolveLocation(options.history.location()));

  const router: Router = {
    currentRoute,
    install(app: App) {
      app.provide(routerKey, router);
      app.provide(routeKey, currentRoute);
      currentRoute.value = resolveLocation(options.history.location());
      stopListening?.();
      stopListening = options.history.listen(() => {
        currentRoute.value = resolveLocation(options.history.location());
      });
    },
    push(to: RouteLocationRaw) {
      const resolved = resolveLocation(to);
      options.history.push(resolved.fullPath);
      currentRoute.value = resolved;
    },
    replace(to: RouteLocationRaw) {
      const resolved = resolveLocation(to);
      options.history.replace(resolved.fullPath);
      currentRoute.value = resolved;
    },
    back: () => options.history.back(),
    forward: () => options.history.forward(),
    resolve: resolveLocation,
  };

  return router;

  function resolveLocation(to: RouteLocationRaw): RouteLocationNormalized {
    const fullPath = normalizeRawLocation(to);
    const [rawPath, rawSearch = ""] = fullPath.split("?");
    const match = matcher.resolve(rawPath || "/");
    const query = parseQuery(rawSearch);
    const search = stringifyQuery(query);

    return {
      path: match.path,
      fullPath: `${match.path}${search}`,
      query,
      params: match.params,
      matched: match.matched,
    };
  }
}

export function useRouter(): Router {
  const router = inject<Router>(routerKey);
  if (router === undefined) {
    throw new Error("Router is not installed");
  }

  return router;
}

export function useRoute(): Router["currentRoute"] {
  const route = inject<Router["currentRoute"]>(routeKey);
  if (route === undefined) {
    throw new Error("Router is not installed");
  }

  return route;
}

function normalizeRawLocation(to: RouteLocationRaw): string {
  if (typeof to === "string") {
    return to === "" ? "/" : to;
  }

  return `${to.path || "/"}${stringifyQuery(to.query)}`;
}
```

- [x] **Step 4: Run router core tests to verify GREEN**

Run:

```bash
pnpm vitest run tests/unit/router/router.test.ts
```

Expected: all router core tests pass.

- [x] **Step 5: Commit router core**

Run:

```bash
git add src/router/router.ts tests/unit/router/router.test.ts
git commit -m "feat: add router core"
```

---

### Task 5: Router Components And Integration

**Files:**

- Create: `src/router/components.ts`
- Create: `src/router/index.ts`
- Modify: `src/index.ts`
- Test: `tests/integration/router-component.test.ts`

- [x] **Step 1: Write failing component integration tests**

Create `tests/integration/router-component.test.ts`:

```ts
import { describe, expect, it } from "vitest";

import {
  RouterLink,
  RouterView,
  createApp,
  createRouter,
  h,
  nextTick,
  useRoute,
} from "../../src/index";
import type { RouterHistory } from "../../src/router/types";

function createMemoryLikeHistory(initial = "/"): RouterHistory {
  let current = initial;
  const listeners = new Set<() => void>();
  return {
    location: () => current,
    push(path) {
      current = path;
    },
    replace(path) {
      current = path;
    },
    listen(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    back() {
      current = "/";
      for (const listener of listeners) listener();
    },
    forward() {},
  };
}

describe("router components", () => {
  it("renders the matched route and updates after RouterLink click", async () => {
    const Home = () => h("p", { id: "home" }, "home");
    const User = () => {
      const route = useRoute();
      return () => h("p", { id: "user" }, `user:${route.value.params.id}:${route.value.query.tab}`);
    };
    const router = createRouter({
      history: createMemoryLikeHistory("/"),
      routes: [
        { path: "/", component: Home },
        { path: "/users/:id", component: User },
      ],
    });
    const App = () => () =>
      h("main", null, [
        h(
          RouterLink,
          { to: { path: "/users/42", query: { tab: "profile" } }, id: "user-link" },
          "User",
        ),
        h(RouterView),
      ]);
    const container = document.createElement("div");

    createApp(App).use(router).mount(container);
    expect(container.querySelector("#home")?.textContent).toBe("home");

    container.querySelector<HTMLAnchorElement>("#user-link")?.click();
    await nextTick();

    expect(container.querySelector("#user")?.textContent).toBe("user:42:profile");
  });

  it("renders an empty fragment when no route matches", () => {
    const router = createRouter({ history: createMemoryLikeHistory("/missing"), routes: [] });
    const container = document.createElement("div");

    createApp(() => h(RouterView))
      .use(router)
      .mount(container);

    expect(container.innerHTML).toBe("");
  });
});
```

- [x] **Step 2: Run component integration tests to verify RED**

Run:

```bash
pnpm vitest run tests/integration/router-component.test.ts
```

Expected: fails because router components/root exports do not exist.

- [x] **Step 3: Implement router components**

Create `src/router/components.ts`:

```ts
import { h } from "../vnode/h";
import { Fragment } from "../vnode/vnode";
import type { ComponentSetupContext } from "../component/component";
import type { ComponentVNodeChildren, VNodeProps } from "../vnode/vnode";
import { useRoute, useRouter } from "./router";
import type { RouteLocationRaw } from "./types";

export interface RouterLinkProps extends VNodeProps {
  to: RouteLocationRaw;
  replace?: boolean;
}

export const RouterView = () => {
  const route = useRoute();

  return () => {
    const matched = route.value.matched;
    return matched === null ? h(Fragment) : h(matched.component);
  };
};

export const RouterLink = (props: RouterLinkProps, { slots }: ComponentSetupContext) => {
  const router = useRouter();

  return () => {
    const resolved = router.resolve(props.to);
    const { to: _to, replace: _replace, ...anchorProps } = props;
    return h(
      "a",
      {
        ...anchorProps,
        href: resolved.fullPath,
        "aria-current":
          router.currentRoute.value.fullPath === resolved.fullPath ? "page" : undefined,
        onClick(event: MouseEvent) {
          if (shouldNavigate(event)) {
            event.preventDefault();
            props.replace ? router.replace(props.to) : router.push(props.to);
          }
        },
      },
      slots.default?.() ?? null,
    );
  };
};

function shouldNavigate(event: MouseEvent): boolean {
  return event.button === 0 && !event.metaKey && !event.altKey && !event.ctrlKey && !event.shiftKey;
}
```

- [x] **Step 4: Add router module exports**

Create `src/router/index.ts`:

```ts
export { RouterLink, RouterView } from "./components";
export { createWebHashHistory, createWebHistory } from "./history";
export { createRouter, useRoute, useRouter } from "./router";
export type {
  RouteLocationNormalized,
  RouteLocationRaw,
  RouteRecord,
  Router,
  RouterHistory,
  RouterOptions,
} from "./types";
```

Append this to `src/index.ts`:

```ts
export {
  RouterLink,
  RouterView,
  createRouter,
  createWebHashHistory,
  createWebHistory,
  useRoute,
  useRouter,
} from "./router";
export type {
  RouteLocationNormalized,
  RouteLocationRaw,
  RouteRecord,
  Router,
  RouterHistory,
  RouterOptions,
} from "./router";
```

- [x] **Step 5: Run component integration tests to verify GREEN**

Run:

```bash
pnpm vitest run tests/integration/router-component.test.ts
```

Expected: all router component integration tests pass.

- [x] **Step 6: Run router unit and integration tests together**

Run:

```bash
pnpm vitest run tests/unit/router tests/integration/router-component.test.ts
```

Expected: all router tests pass.

- [x] **Step 7: Commit router components and exports**

Run:

```bash
git add src/router/components.ts src/router/index.ts src/index.ts tests/integration/router-component.test.ts
git commit -m "feat: add router components"
```

---

### Task 6: Package Boundary Coverage

**Files:**

- Modify: `tests/integration/package-exports.test.ts`
- Modify: `scripts/package-consumer-smoke.mjs`

- [x] **Step 1: Extend package export tests**

In `tests/integration/package-exports.test.ts`, update the public root API test to include:

```ts
createRouter: expect.any(Function),
createWebHashHistory: expect.any(Function),
createWebHistory: expect.any(Function),
RouterLink: expect.any(Function),
RouterView: expect.any(Function),
useRoute: expect.any(Function),
useRouter: expect.any(Function),
```

In the CommonJS test, add:

```ts
expect(api.createRouter).toEqual(expect.any(Function));
expect(api.createWebHashHistory).toEqual(expect.any(Function));
expect(api.createWebHistory).toEqual(expect.any(Function));
expect(api.RouterLink).toEqual(expect.any(Function));
expect(api.RouterView).toEqual(expect.any(Function));
expect(api.useRoute).toEqual(expect.any(Function));
expect(api.useRouter).toEqual(expect.any(Function));
```

- [x] **Step 2: Extend packed consumer smoke TypeScript entry**

In `scripts/package-consumer-smoke.mjs`, extend the root import with router APIs:

```ts
import {
  RouterLink,
  RouterView,
  createRouter,
  createWebHashHistory,
  createWebHistory,
  createApp,
  createStore,
  defineAsyncComponent,
  defineComponent,
  h,
  inject,
  reactive,
  useRoute,
  useRouter,
  watchEffect,
} from "@italone/solace";
import type {
  RouteLocationNormalized,
  RouteLocationRaw,
  RouteRecord,
  Router,
  RouterHistory,
  RouterOptions,
} from "@italone/solace";
```

Add smoke-only router type usage before `createApp(App)`:

```ts
const routerHistory: RouterHistory = createWebHashHistory();
const routerRoutes: RouteRecord[] = [{ path: "/", component: () => h("span", null, "home") }];
const routerOptions: RouterOptions = { history: routerHistory, routes: routerRoutes };
const router: Router = createRouter(routerOptions);
const rawLocation: RouteLocationRaw = { path: "/", query: { smoke: true } };
const normalizedLocation: RouteLocationNormalized = router.resolve(rawLocation);
if (
  !normalizedLocation.fullPath.includes("smoke=true") ||
  !createWebHistory ||
  !RouterLink ||
  !RouterView ||
  !useRoute ||
  !useRouter
) {
  throw new Error("router export mismatch");
}
```

Update the ESM and CJS runtime checks to require router functions:

```js
!api.createRouter ||
  !api.createWebHashHistory ||
  !api.createWebHistory ||
  !api.RouterLink ||
  !api.RouterView ||
  !api.useRoute ||
  !api.useRouter;
```

- [x] **Step 3: Run package export tests**

Run:

```bash
pnpm build
pnpm vitest run --config vitest.package.config.ts tests/integration/package-exports.test.ts
```

Expected: package export tests pass.

- [x] **Step 4: Run package smoke**

Run:

```bash
pnpm package:smoke
```

Expected: packed consumer smoke passes and validates router ESM/CJS/type usage.

- [x] **Step 5: Commit package boundary coverage**

Run:

```bash
git add tests/integration/package-exports.test.ts scripts/package-consumer-smoke.mjs
git commit -m "test: cover router package exports"
```

---

### Task 7: Router Example And E2E

**Files:**

- Create: `examples/router-basic/index.html`
- Create: `examples/router-basic/vite.config.ts`
- Create: `examples/router-basic/src/main.tsx`
- Modify: `package.json`
- Modify: `playwright.config.ts`
- Create: `tests/e2e/router-basic.spec.ts`

- [x] **Step 1: Create router example**

Create `examples/router-basic/index.html`:

```html
<div id="app"></div>
<script type="module" src="/src/main.tsx"></script>
```

Create `examples/router-basic/vite.config.ts`:

```ts
import { defineConfig } from "vite";

export default defineConfig({
  resolve: {
    alias: {
      "@italone/solace": new URL("../../src/index.ts", import.meta.url).pathname,
      "@italone/solace/jsx-runtime": new URL("../../src/jsx-runtime.ts", import.meta.url).pathname,
      "@italone/solace/jsx-dev-runtime": new URL("../../src/jsx-dev-runtime.ts", import.meta.url)
        .pathname,
    },
  },
});
```

Create `examples/router-basic/src/main.tsx`:

```tsx
import {
  RouterLink,
  RouterView,
  createApp,
  createRouter,
  createWebHashHistory,
  useRoute,
} from "@italone/solace";

const Home = () => <p id="home-view">home</p>;

const User = () => {
  const route = useRoute();

  return () => (
    <p id="user-view">
      user: {route.value.params.id} tab: {String(route.value.query.tab)}
    </p>
  );
};

const NotFound = () => <p id="not-found-view">not found</p>;

const router = createRouter({
  history: createWebHashHistory(),
  routes: [
    { path: "/", component: Home },
    { path: "/users/:id", component: User },
    { path: "/:pathMatch(.*)*", component: NotFound },
  ],
});

const App = () => () => (
  <main>
    <nav>
      <RouterLink id="home-link" to="/">
        Home
      </RouterLink>
      <RouterLink id="user-link" to={{ path: "/users/42", query: { tab: "profile" } }}>
        User
      </RouterLink>
      <RouterLink id="missing-link" to="/missing">
        Missing
      </RouterLink>
    </nav>
    <RouterView />
  </main>
);

createApp(App)
  .use(router)
  .mount(document.querySelector("#app") as Element);
```

- [x] **Step 2: Add dev script**

Add to `package.json` scripts:

```json
"dev:router": "vite examples/router-basic"
```

- [x] **Step 3: Add Playwright web server and e2e spec**

In `playwright.config.ts`, add a web server after large-list:

```ts
{
  command: "pnpm exec vite examples/router-basic --host 127.0.0.1 --port 5178",
  url: "http://127.0.0.1:5178",
  reuseExistingServer: !process.env.CI,
},
```

Create `tests/e2e/router-basic.spec.ts`:

```ts
import { expect, test } from "@playwright/test";

test("navigates the router example", async ({ page }) => {
  await page.goto("http://127.0.0.1:5178");

  await expect(page.locator("#home-view")).toHaveText("home");

  await page.locator("#user-link").click();
  await expect(page.locator("#user-view")).toHaveText("user: 42 tab: profile");

  await page.locator("#missing-link").click();
  await expect(page.locator("#not-found-view")).toHaveText("not found");
});
```

- [x] **Step 4: Run example checks**

Run:

```bash
pnpm typecheck
pnpm test:e2e tests/e2e/router-basic.spec.ts
```

Expected: typecheck passes and router e2e passes. If Playwright cannot bind `127.0.0.1:5178` inside the sandbox, rerun the same command with approval outside the sandbox.

- [x] **Step 5: Commit router example**

Run:

```bash
git add examples/router-basic package.json playwright.config.ts tests/e2e/router-basic.spec.ts
git commit -m "feat: add router example"
```

---

### Task 8: Documentation

**Files:**

- Modify: `docs/api.md`
- Modify: `docs/api.zh-CN.md`
- Modify: `docs/package-usage.md`
- Modify: `docs/examples.md`
- Modify: `docs/project-status.md`
- Modify: `docs/project-status.zh-CN.md`
- Modify: `docs/roadmap.md`
- Modify: `readme.md`
- Modify: `readme.zh-CN.md`

- [x] **Step 1: Document router API**

In `docs/api.md`, add a `## Router` section before DevTools or after JSX/tooling entries. Include this example:

````md
## Router

The beta router is installed with `app.use()`:

```ts
const router = createRouter({
  history: createWebHashHistory(),
  routes: [
    { path: "/", component: Home },
    { path: "/users/:id", component: User },
    { path: "/:pathMatch(.*)*", component: NotFound },
  ],
});

createApp(App)
  .use(router)
  .mount(document.querySelector("#app") as Element);
```

The first router slice supports static routes, dynamic params, wildcard not-found routes, query strings, web/hash history, `RouterView`, `RouterLink`, `useRouter`, and `useRoute`. Nested routes, guards, redirects, lazy route components, SSR, hydration, auth, and permission routing are intentionally deferred.
````

Add the same content in Chinese to `docs/api.zh-CN.md`.

- [x] **Step 2: Document package usage**

In `docs/package-usage.md`, add a router usage section with the same `createRouter` example and a short note that `createWebHashHistory()` works without server rewrite support, while `createWebHistory()` requires deployment fallback for direct URL loads.

- [x] **Step 3: Update examples docs and READMEs**

In `docs/examples.md`, add `Router Basic` with command `pnpm dev:router`, location `examples/router-basic`, coverage for `RouterView`, `RouterLink`, params, query, and hash history.

In `readme.md` and `readme.zh-CN.md`, add `Router basic | pnpm dev:router | beta router, params, query, RouterLink` to the examples table.

- [x] **Step 4: Update status and roadmap**

In `docs/project-status.md` and `docs/project-status.zh-CN.md`, add router as beta implementation after SFC compiler. Move first-party router out of Known Gaps and keep nested routes/guards/SSR auth routing as deferred scope.

In `docs/roadmap.md`, mark first-party router as the current beta work if the implementation has landed, and leave SSR/SSG/hydration next.

- [x] **Step 5: Format docs**

Run:

```bash
pnpm exec prettier --write docs/api.md docs/api.zh-CN.md docs/package-usage.md docs/examples.md docs/project-status.md docs/project-status.zh-CN.md docs/roadmap.md readme.md readme.zh-CN.md
```

Expected: docs are formatted.

- [x] **Step 6: Run docs-relevant checks**

Run:

```bash
pnpm format:check
pnpm test tests/unit/devtools/devtools-docs.test.ts
```

Expected: both commands pass.

- [x] **Step 7: Commit docs**

Run:

```bash
git add docs/api.md docs/api.zh-CN.md docs/package-usage.md docs/examples.md docs/project-status.md docs/project-status.zh-CN.md docs/roadmap.md readme.md readme.zh-CN.md
git commit -m "docs: document beta router"
```

---

### Task 9: Final Router Gate

**Files:**

- No new files unless validation exposes a defect.

- [x] **Step 1: Run focused router tests**

Run:

```bash
pnpm vitest run tests/unit/router tests/integration/router-component.test.ts
```

Expected: all focused router tests pass.

- [x] **Step 2: Run quality gate**

Run:

```bash
pnpm quality
```

Expected: format check, typecheck, JSX dev typecheck, lint, unit/integration tests, build, and package export tests pass.

- [x] **Step 3: Run package smoke**

Run:

```bash
pnpm package:smoke
```

Expected: packed consumer smoke passes and validates router APIs.

- [x] **Step 4: Run browser e2e**

Run:

```bash
pnpm test:e2e
```

Expected: all browser e2e tests pass, including `router-basic.spec.ts`. If local port binding is blocked by sandboxing, rerun the same command with approval outside the sandbox.

- [x] **Step 5: Record final status**

Run:

```bash
git status -sb
git log --oneline -8
```

Expected: working tree clean; latest commits include router query helpers, matcher, history, core, components, package exports, example, and docs.

---

## Self-Review

- Spec coverage: The plan covers public router APIs, matcher, query helpers, history adapters, router state, components, package boundary checks, example app, docs, and final validation.
- Scope boundary: The plan explicitly defers nested routes, guards, redirects, lazy routes, scroll behavior, SSR/hydration, auth, and permission routing.
- Completion-word scan: The plan text avoids unfinished-work markers; each implementation step names exact files, commands, and expected results.
- Type consistency: Public names are consistent across tasks: `createRouter`, `createWebHistory`, `createWebHashHistory`, `RouterView`, `RouterLink`, `useRouter`, `useRoute`, `RouteRecord`, `RouteLocationNormalized`, `RouteLocationRaw`, `Router`, `RouterHistory`, and `RouterOptions`.
