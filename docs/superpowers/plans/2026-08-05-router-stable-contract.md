# Router Stable Contract Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Stabilize Router route names, aliases, route props, and first-party memory history while keeping scroll behavior, auth, permissions, and SSR router integration deferred.

**Architecture:** Extend the existing router in place instead of adding a separate routing layer. `types.ts` defines the widened public contract, `matcher.ts` owns route compilation/name/alias resolution, `router.ts` owns raw-location validation and navigation error boundaries, `components.ts` maps matched records to `RouterView` props, and `history.ts` owns all first-party history adapters.

**Tech Stack:** TypeScript, Solace runtime, Vitest, jsdom integration tests, Rollup package build.

---

## File Structure

- Modify `src/router/types.ts`: add route name, params input, route props, named locations, and `RouteLocationNormalized.name`.
- Modify `src/router/matcher.ts`: compile canonical records, names, aliases, path params, and named location path generation.
- Modify `src/router/router.ts`: validate widened route/location fields, resolve named locations, preserve current guard/redirect behavior.
- Modify `src/router/components.ts`: compute props for the matched renderable record and pass them to `h()`.
- Modify `src/router/history.ts`: add `createMemoryHistory()` using the existing `RouterHistory` interface and internal href formatter.
- Modify `src/router/index.ts` and `src/index.ts`: export `createMemoryHistory` and new public types.
- Modify `tests/unit/router/public-contract-types.test.ts`: turn the previously deferred route name, alias, props, named location, and memory history checks into accepted type checks.
- Modify `tests/unit/router/router.test.ts`: add runtime tests for names, aliases, params, memory history, and deferred boundaries.
- Modify `tests/integration/router-component.test.ts`: add `RouterLink` named-location and `RouterView` route-props coverage.
- Modify `tests/integration/package-exports.test.ts`: update package root and router subpath export assertions.
- Modify `docs/api.md`, `docs/api.zh-CN.md`, `docs/package-usage.md`, and `docs/project-status.zh-CN.md`: document the widened Router contract and remaining deferred areas.

---

### Task 1: Public Types And Export Boundary

**Files:**

- Modify: `src/router/types.ts`
- Modify: `src/router/index.ts`
- Modify: `src/index.ts`
- Modify: `tests/unit/router/public-contract-types.test.ts`
- Modify: `tests/integration/package-exports.test.ts`
- Test: `tests/unit/router/public-contract-types.test.ts`
- Test: `tests/integration/package-exports.test.ts`

- [x] **Step 1: Write failing type contract checks**

In `tests/unit/router/public-contract-types.test.ts`, update the imports and accepted checks so the new public types compile:

```ts
import { createMemoryHistory, createRouter, h, lazyRoute } from "../../../src";
import type {
  NavigationGuard,
  Router,
  RouteComponent,
  RouteLocationRaw,
  RouteProps,
  RouteRecord,
  RouteRecordName,
  RouterOptions,
} from "../../../src";
import type { RouterHistory } from "../../../src/router/types";

const routeName: RouteRecordName = "user";
const routeProps: RouteProps = (route) => ({ id: route.params.id });

acceptRouteRecord({ path: "/named/:id", component: Home, name: routeName, props: routeProps });
acceptRouteRecord({ path: "/alias", component: Home, alias: ["/a", "relative-a"] });
acceptRouteRecord({ path: "/props-true/:id", component: Home, props: true });
acceptRouteRecord({ path: "/props-object", component: Home, props: { mode: "static" } });
acceptRouteLocationRaw({ name: "user", params: { id: 42 }, query: { tab: "profile" } });
acceptRouterHistory(createMemoryHistory());
```

Remove the old `@ts-expect-error` blocks for named routes, aliases, route props, named locations, and `createMemoryHistory`. Keep these negative checks:

```ts
// @ts-expect-error scroll behavior is not part of the router beta contract
acceptRouterOptions({ history, routes: [], scrollBehavior: () => undefined });

// @ts-expect-error hash locations are not part of the router beta contract
acceptRouteLocationRaw({ path: "/", hash: "#section" });

// @ts-expect-error path locations do not accept params
acceptRouteLocationRaw({ path: "/users/1", params: { id: "1" } });

// @ts-expect-error named locations must include a string name
acceptRouteLocationRaw({ name: 42, params: { id: "1" } });
```

- [x] **Step 2: Update package export expectations so they fail before implementation**

In `tests/integration/package-exports.test.ts`, add `createMemoryHistory` to the public root API match and sorted key list:

```ts
expect(api).toMatchObject({
  createApp: expect.any(Function),
  createMemoryHistory: expect.any(Function),
  createRouter: expect.any(Function),
  createWebHashHistory: expect.any(Function),
  createWebHistory: expect.any(Function),
});

expect(Object.keys(api).sort()).toContain("createMemoryHistory");
expect(api).not.toHaveProperty("createSSRRouter");
```

In the router module re-export test in `tests/unit/router/router.test.ts`, add the key and matcher:

```ts
expect(Object.keys(routerModule).sort()).toEqual([
  "RouterLink",
  "RouterNavigationError",
  "RouterView",
  "createMemoryHistory",
  "createRouter",
  "createWebHashHistory",
  "createWebHistory",
  "lazyRoute",
  "useRoute",
  "useRouter",
]);
expect(routerModule.createMemoryHistory).toEqual(expect.any(Function));
```

- [x] **Step 3: Run tests to verify the contract fails**

Run:

```bash
pnpm vitest run tests/unit/router/public-contract-types.test.ts tests/unit/router/router.test.ts tests/integration/package-exports.test.ts
```

Expected: FAIL because `createMemoryHistory`, `RouteRecordName`, and `RouteProps` are not exported and the old route record types still reject `name`, `alias`, and `props`.

- [x] **Step 4: Implement public type widening**

Replace the route type section in `src/router/types.ts` with these public shapes:

```ts
export type RouteRecordName = string;
export type RouteParamInputValue = string | number;
export type RouteParamsInput = Record<string, RouteParamInputValue>;
export type RouteProps =
  boolean | Record<string, unknown> | ((route: RouteLocationNormalized) => Record<string, unknown>);

export interface RouteRecord {
  path: string;
  name?: RouteRecordName;
  component?: RouteComponent | null;
  children?: RouteRecord[];
  redirect?: RouteLocationRaw | ((to: RouteLocationNormalized) => RouteLocationRaw);
  beforeEnter?: NavigationGuard | NavigationGuard[];
  meta?: Record<string, unknown>;
  alias?: string | string[];
  props?: RouteProps;
}

export interface RouteLocationNormalized {
  path: string;
  fullPath: string;
  query: Query;
  params: Record<string, string>;
  matched: RouteRecord[];
  name?: RouteRecordName;
  redirectedFrom?: RouteLocationNormalized;
}

export type RouteLocationRaw =
  | string
  | { path: string; query?: QueryInput }
  | { name: RouteRecordName; params?: RouteParamsInput; query?: QueryInput };
```

- [x] **Step 5: Add first-pass runtime exports**

In `src/router/history.ts`, add a first-pass `createMemoryHistory()` implementation that is enough
for public exports before Task 2 completes full stack behavior:

```ts
export function createMemoryHistory(initial: string | string[] = "/"): RouterHistory {
  const first = Array.isArray(initial) ? (initial.at(-1) ?? "/") : initial;
  let current = first;
  const listeners = new Set<() => void>();

  return {
    location: () => current,
    [historyHrefFormatterKey]: (path: string) => path,
    push(path: string) {
      current = path;
      for (const listener of listeners) listener();
    },
    replace(path: string) {
      current = path;
      for (const listener of listeners) listener();
    },
    listen(listener: () => void) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    back() {},
    forward() {},
  };
}
```

In `src/router/index.ts`, export the adapter and new types:

```ts
export { createMemoryHistory, createWebHashHistory, createWebHistory } from "./history";
export type {
  LazyRouteComponent,
  NavigationGuard,
  NavigationGuardResult,
  RouteComponent,
  RouteLocationNormalized,
  RouteLocationRaw,
  RouteParamInputValue,
  RouteParamsInput,
  RouteProps,
  RouteRecord,
  RouteRecordName,
  Router,
  RouterHistory,
  RouterOptions,
} from "./types";
```

In `src/index.ts`, add `createMemoryHistory` to the runtime router export and add the new types to the router type export:

```ts
export {
  RouterLink,
  RouterNavigationError,
  RouterView,
  createMemoryHistory,
  createRouter,
  createWebHashHistory,
  createWebHistory,
  lazyRoute,
  useRoute,
  useRouter,
} from "./router";
```

- [x] **Step 6: Run focused tests**

Run:

```bash
pnpm vitest run tests/unit/router/public-contract-types.test.ts tests/unit/router/router.test.ts tests/integration/package-exports.test.ts
```

Expected: type test and export assertions pass where the first-pass adapter is enough; runtime route-name behavior still fails in later tasks because it is not tested here yet.

- [x] **Step 7: Commit**

```bash
git add src/router/types.ts src/router/index.ts src/index.ts src/router/history.ts tests/unit/router/public-contract-types.test.ts tests/unit/router/router.test.ts tests/integration/package-exports.test.ts
git commit -m "feat(router): widen stable contract types"
```

---

### Task 2: Memory History

**Files:**

- Modify: `src/router/history.ts`
- Modify: `tests/unit/router/router.test.ts`
- Test: `tests/unit/router/router.test.ts`

- [x] **Step 1: Add failing memory history tests**

In `tests/unit/router/router.test.ts`, import `createMemoryHistory` from `src/router/history` or `src/router` and add:

```ts
it("provides deterministic memory history stack navigation", () => {
  const history = createMemoryHistory(["/", "/users/1"]);
  const listener = vi.fn();
  const stop = history.listen(listener);

  expect(history.location()).toBe("/users/1");
  history.back();
  expect(history.location()).toBe("/");
  expect(listener).toHaveBeenCalledTimes(1);

  history.forward();
  expect(history.location()).toBe("/users/1");
  expect(listener).toHaveBeenCalledTimes(2);

  history.push("/users/2?tab=profile");
  expect(history.location()).toBe("/users/2?tab=profile");
  history.back();
  history.push("/users/3");
  history.forward();
  expect(history.location()).toBe("/users/3");
  expect(listener).toHaveBeenCalledTimes(5);

  stop();
  history.replace("/users/4");
  expect(history.location()).toBe("/users/4");
  expect(listener).toHaveBeenCalledTimes(5);
});

it("normalizes and validates memory history targets", () => {
  expect(createMemoryHistory("users/1///").location()).toBe("/users/1");
  expect(createMemoryHistory([]).location()).toBe("/");
  expect(() => createMemoryHistory("https://example.com")).toThrow(
    TypeError("Router history target must be a relative path"),
  );
  expect(() => createMemoryHistory("/users#profile")).toThrow(
    TypeError("Router history target must not include hash fragments"),
  );
});
```

- [x] **Step 2: Run tests to verify they fail**

Run:

```bash
pnpm vitest run tests/unit/router/router.test.ts
```

Expected: FAIL because the first-pass memory history does not maintain stack navigation, target normalization, or boundary no-op behavior.

- [x] **Step 3: Implement memory history**

In `src/router/history.ts`, replace the first-pass `createMemoryHistory()` with:

```ts
export function createMemoryHistory(initial: string | string[] = "/"): RouterHistory {
  const entries = normalizeMemoryHistoryEntries(initial);
  let index = entries.length - 1;
  const listeners = new Set<() => void>();

  const notify = () => {
    for (const listener of listeners) {
      listener();
    }
  };

  return {
    location: () => entries[index] ?? "/",
    [historyHrefFormatterKey]: (path: string) => normalizeHistoryTarget(path),
    push(path: string) {
      const next = normalizeHistoryTarget(path);
      entries.splice(index + 1, entries.length - index - 1, next);
      index = entries.length - 1;
      notify();
    },
    replace(path: string) {
      entries[index] = normalizeHistoryTarget(path);
      notify();
    },
    listen(listener: () => void) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    back() {
      if (index === 0) {
        return;
      }

      index -= 1;
      notify();
    },
    forward() {
      if (index >= entries.length - 1) {
        return;
      }

      index += 1;
      notify();
    },
  };
}

function normalizeMemoryHistoryEntries(initial: string | string[]): string[] {
  const rawEntries = Array.isArray(initial) ? initial : [initial];
  const normalized = rawEntries.map((entry) => normalizeHistoryTarget(entry));
  return normalized.length === 0 ? ["/"] : normalized;
}
```

- [x] **Step 4: Run focused tests**

Run:

```bash
pnpm vitest run tests/unit/router/router.test.ts
```

Expected: PASS.

- [x] **Step 5: Commit**

```bash
git add src/router/history.ts tests/unit/router/router.test.ts
git commit -m "feat(router): add memory history"
```

---

### Task 3: Route Names And Named Locations

**Files:**

- Modify: `src/router/matcher.ts`
- Modify: `src/router/router.ts`
- Modify: `tests/unit/router/router.test.ts`
- Test: `tests/unit/router/router.test.ts`

- [x] **Step 1: Add failing route-name tests**

In `tests/unit/router/router.test.ts`, add:

```ts
it("resolves named route locations with params and query", () => {
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [{ path: "/users/:id", name: "user", component: User }],
  });

  expect(
    router.resolve({ name: "user", params: { id: 42 }, query: { tab: "profile" } }),
  ).toMatchObject({
    path: "/users/42",
    fullPath: "/users/42?tab=profile",
    params: { id: "42" },
    name: "user",
    matched: [expect.objectContaining({ name: "user" })],
  });
});

it("rejects invalid named locations deterministically", () => {
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [{ path: "/users/:id", name: "user", component: User }],
  });

  expect(() => router.resolve({ name: "missing" })).toThrow(
    TypeError("Router named route was not found: missing"),
  );
  expect(() => router.resolve({ name: "user" })).toThrow(
    TypeError("Router named route is missing required param: id"),
  );
  expect(() => router.resolve({ name: "user", params: { id: 1, extra: 2 } })).toThrow(
    TypeError("Router named route received unknown param: extra"),
  );
});

it("rejects duplicate and invalid route names at creation time", () => {
  expect(() =>
    createRouter({
      history: createMemoryHistory(),
      routes: [
        { path: "/one", name: "user", component: User },
        { path: "/two", name: "user", component: User },
      ],
    }),
  ).toThrow(TypeError("Router route names must be unique: user"));

  expect(() =>
    createRouter({
      history: createMemoryHistory(),
      routes: [{ path: "/bad", name: "", component: User }],
    } as never),
  ).toThrow(TypeError("Router route record name must be a non-empty string"));
});
```

- [x] **Step 2: Run tests to verify they fail**

Run:

```bash
pnpm vitest run tests/unit/router/router.test.ts
```

Expected: FAIL because the matcher cannot register names or generate canonical paths from params.

- [x] **Step 3: Extend matcher interfaces**

In `src/router/matcher.ts`, replace the public matcher shape with:

```ts
interface CompiledRoute {
  record: RouteRecord;
  chain: RouteRecord[];
  fullPath: string;
  regex: RegExp;
  keys: string[];
  score: number;
}

export interface NamedRouteResolution {
  path: string;
  params: Record<string, string>;
  matched: RouteRecord[];
  name: string;
}

export interface Matcher {
  resolve(path: string): Pick<RouteLocationNormalized, "path" | "params" | "matched" | "name">;
  resolveByName(name: string, params?: Record<string, string | number>): NamedRouteResolution;
}
```

- [x] **Step 4: Register named routes and interpolate params**

In `createMatcher()`, create and use a `namedRoutes` map:

```ts
export function createMatcher(routes: RouteRecord[]): Matcher {
  const namedRoutes = new Map<string, CompiledRoute>();
  const compiled = flattenRoutes(routes)
    .map(compileRoute)
    .sort((a, b) => b.score - a.score || b.chain.length - a.chain.length);

  for (const route of compiled) {
    const name = route.record.name;
    if (name === undefined) {
      continue;
    }

    if (namedRoutes.has(name)) {
      throw new TypeError(`Router route names must be unique: ${name}`);
    }

    namedRoutes.set(name, route);
  }

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
          params[route.keys[index]] = decodePathParam(match[index + 1] ?? "");
        }

        return {
          path: normalized,
          params,
          matched: route.chain,
          name: route.record.name,
        };
      }

      return { path: normalized, params: {}, matched: [], name: undefined };
    },
    resolveByName(name: string, params?: Record<string, string | number>) {
      const route = namedRoutes.get(name);
      if (route === undefined) {
        throw new TypeError(`Router named route was not found: ${name}`);
      }

      const path = stringifyNamedRoutePath(route.fullPath, route.keys, params ?? {});
      const resolved = this.resolve(path);
      return { path: resolved.path, params: resolved.params, matched: resolved.matched, name };
    },
  };
}
```

Add this helper below `compileRoute()`:

```ts
function stringifyNamedRoutePath(
  fullPath: string,
  keys: string[],
  params: Record<string, string | number>,
): string {
  const expected = new Set(keys);

  for (const key of keys) {
    if (!(key in params)) {
      throw new TypeError(`Router named route is missing required param: ${key}`);
    }
  }

  for (const key of Object.keys(params)) {
    if (!expected.has(key)) {
      throw new TypeError(`Router named route received unknown param: ${key}`);
    }
  }

  return fullPath.replace(/:([A-Za-z_][A-Za-z0-9_]*)/g, (_segment, key: string) =>
    encodeURIComponent(String(params[key])),
  );
}
```

- [x] **Step 5: Teach router raw-location normalization about names**

In `src/router/router.ts`, change `resolveLocation()` so named objects use `matcher.resolveByName()`:

```ts
function resolveLocation(to: RouteLocationRaw): RouteLocationNormalized {
  const normalized = normalizeRawLocation(to);
  const [rawPath, rawSearch] = splitLocationPathAndSearch(normalized.fullPath);
  const match =
    normalized.name === undefined
      ? matcher.resolve(rawPath || "/")
      : matcher.resolveByName(normalized.name, normalized.params);
  const query = parseQuery(rawSearch);
  const search = stringifyQuery(query);

  return {
    path: match.path,
    fullPath: `${match.path}${search}`,
    query,
    params: match.params,
    matched: match.matched,
    name: match.name,
  };
}
```

Change `normalizeRawLocation()` to return a structured value:

```ts
function normalizeRawLocation(to: RouteLocationRaw): {
  fullPath: string;
  name?: string;
  params?: Record<string, string | number>;
} {
  if (typeof to === "string") {
    assertRouterLocationIsRelative(to);
    assertRouterLocationPathHasNoHash(to);
    return { fullPath: to === "" ? "/" : to };
  }

  if (to === null || typeof to !== "object" || Array.isArray(to)) {
    throw new TypeError("Router location must be a string or object");
  }

  if ("name" in to) {
    assertRouterNamedLocationContract(to);
    return { fullPath: stringifyQuery(to.query), name: to.name, params: to.params };
  }

  assertRouterLocationContract(to);
  return { fullPath: `${to.path}${stringifyQuery(to.query)}` };
}
```

Add `assertRouterNamedLocationContract()` near `assertRouterLocationContract()`:

```ts
function assertRouterNamedLocationContract(location: {
  name?: unknown;
  params?: unknown;
  query?: unknown;
}): asserts location is {
  name: string;
  params?: Record<string, string | number>;
  query?: unknown;
} {
  for (const key of Object.keys(location)) {
    if (key !== "name" && key !== "params" && key !== "query") {
      throw new TypeError(
        `Deferred router location field is not part of the beta contract: ${key}`,
      );
    }
  }

  if (typeof location.name !== "string" || location.name === "") {
    throw new TypeError("Router named location name must be a non-empty string");
  }

  if (location.params !== undefined) {
    assertRouterParamsInputContract(location.params);
  }

  if (location.query !== undefined) {
    if (
      typeof location.query !== "object" ||
      location.query === null ||
      Array.isArray(location.query)
    ) {
      throw new TypeError("Router location query must be an object");
    }
    assertRouterLocationQueryObjectContract(location.query);
    assertRouterLocationQueryContract(location.query);
  }
}
```

Add param validation:

```ts
function assertRouterParamsInputContract(
  params: unknown,
): asserts params is Record<string, string | number> {
  if (typeof params !== "object" || params === null || Array.isArray(params)) {
    throw new TypeError("Router named location params must be an object");
  }

  assertRouterLocationQueryObjectContract(params);
  for (const value of Object.values(params)) {
    if (typeof value !== "string" && typeof value !== "number") {
      throw new TypeError("Router named location param value must be a string or number");
    }
  }
}
```

- [x] **Step 6: Validate route names during route record validation**

In `assertRouteRecordContract()`, call:

```ts
assertRouteRecordNameContract(route.name);
```

Add:

```ts
function assertRouteRecordNameContract(name: RouteRecord["name"]): void {
  if (name === undefined) {
    return;
  }

  if (typeof name === "string" && name !== "") {
    return;
  }

  throw new TypeError("Router route record name must be a non-empty string");
}
```

- [x] **Step 7: Run focused tests**

Run:

```bash
pnpm vitest run tests/unit/router/router.test.ts tests/unit/router/public-contract-types.test.ts
```

Expected: PASS for route-name tests and existing router unit tests.

- [x] **Step 8: Commit**

```bash
git add src/router/matcher.ts src/router/router.ts tests/unit/router/router.test.ts tests/unit/router/public-contract-types.test.ts
git commit -m "feat(router): support named routes"
```

---

### Task 4: Route Aliases

**Files:**

- Modify: `src/router/matcher.ts`
- Modify: `src/router/router.ts`
- Modify: `tests/unit/router/router.test.ts`
- Test: `tests/unit/router/router.test.ts`

- [x] **Step 1: Add failing alias tests**

In `tests/unit/router/router.test.ts`, add:

```ts
it("matches aliases while preserving canonical matched records", () => {
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [{ path: "/users/:id", name: "user", alias: ["/members/:id"], component: User }],
  });

  const route = router.resolve("/members/42?tab=profile");

  expect(route.path).toBe("/members/42");
  expect(route.fullPath).toBe("/members/42?tab=profile");
  expect(route.params).toEqual({ id: "42" });
  expect(route.name).toBe("user");
  expect(route.matched[0]).toEqual(expect.objectContaining({ path: "/users/:id", name: "user" }));
  expect(router.resolve({ name: "user", params: { id: 42 } }).fullPath).toBe("/users/42");
});

it("rejects duplicate alias and path collisions", () => {
  expect(() =>
    createRouter({
      history: createMemoryHistory(),
      routes: [
        { path: "/users/:id", alias: "/members/:id", component: User },
        { path: "/members/:id", component: User },
      ],
    }),
  ).toThrow(TypeError("Router route path or alias is already registered: /members/:id"));
});
```

- [x] **Step 2: Run tests to verify they fail**

Run:

```bash
pnpm vitest run tests/unit/router/router.test.ts
```

Expected: FAIL because aliases are still not compiled into matcher entries.

- [x] **Step 3: Add alias validation**

In `src/router/router.ts`, add `alias` to `allowedRouteRecordFields` and call:

```ts
assertRouteRecordAliasContract(route.alias);
```

Add:

```ts
function assertRouteRecordAliasContract(alias: RouteRecord["alias"]): void {
  if (alias === undefined) {
    return;
  }

  const aliases = Array.isArray(alias) ? alias : [alias];
  for (const value of aliases) {
    if (typeof value !== "string") {
      throw new TypeError("Router route record alias must be a string or string array");
    }
  }
}
```

- [x] **Step 4: Compile alias entries in the matcher**

In `src/router/matcher.ts`, change `flattenRoutes()` so it emits canonical entries and aliases:

```ts
function flattenRoutes(
  routes: RouteRecord[],
  parentPath = "",
  parentChain: RouteRecord[] = [],
): NormalizedRouteRecord[] {
  const records: NormalizedRouteRecord[] = [];

  for (const route of routes) {
    assertBetaRoutePathSyntax(route.path);
    const fullPath = joinRoutePaths(parentPath, route.path);
    const chain = [...parentChain, route];
    const children = route.children ?? [];

    if (route.component != null || route.redirect !== undefined || children.length === 0) {
      records.push({ record: route, fullPath, chain });
      for (const alias of normalizeRouteAliases(route.alias)) {
        records.push({ record: route, fullPath: joinRoutePaths(parentPath, alias), chain });
      }
    }

    records.push(...flattenRoutes(children, fullPath, chain));
  }

  return records;
}

function normalizeRouteAliases(alias: RouteRecord["alias"]): string[] {
  if (alias === undefined) {
    return [];
  }

  return Array.isArray(alias) ? alias : [alias];
}
```

In `createMatcher()`, reject duplicate compiled paths before sorting:

```ts
const flattened = flattenRoutes(routes);
const registeredPaths = new Set<string>();
for (const route of flattened) {
  const normalized = normalizePath(route.fullPath);
  if (registeredPaths.has(normalized)) {
    throw new TypeError(`Router route path or alias is already registered: ${normalized}`);
  }
  registeredPaths.add(normalized);
}
const compiled = flattened
  .map(compileRoute)
  .sort((a, b) => b.score - a.score || b.chain.length - a.chain.length);
```

- [x] **Step 5: Run focused tests**

Run:

```bash
pnpm vitest run tests/unit/router/router.test.ts
```

Expected: PASS for alias tests and existing router unit tests.

- [x] **Step 6: Commit**

```bash
git add src/router/matcher.ts src/router/router.ts tests/unit/router/router.test.ts
git commit -m "feat(router): support route aliases"
```

---

### Task 5: Route Props And Router Components

**Files:**

- Modify: `src/router/components.ts`
- Modify: `src/router/router.ts`
- Modify: `tests/integration/router-component.test.ts`
- Test: `tests/integration/router-component.test.ts`

- [x] **Step 1: Add failing route props integration tests**

In `tests/integration/router-component.test.ts`, add:

```ts
it("passes route props to RouterView components", async () => {
  const User = (props: { id?: string; tab?: string }) =>
    h("p", { id: "user" }, `${props.id}:${props.tab}`);
  const router = createRouter({
    history: createMemoryHistory("/users/42?tab=profile"),
    routes: [
      {
        path: "/users/:id",
        component: User,
        props: (route) => ({ id: route.params.id, tab: route.query.tab }),
      },
    ],
  });
  const container = document.createElement("div");

  createApp(() => h(RouterView))
    .use(router)
    .mount(container);
  await nextTick();

  expect(container.querySelector("#user")?.textContent).toBe("42:profile");
});

it("supports RouterLink named locations", async () => {
  const User = (props: { id?: string }) => h("p", { id: "user" }, props.id);
  const router = createRouter({
    history: createMemoryHistory("/"),
    routes: [
      { path: "/", component: () => h("p", { id: "home" }, "home") },
      { path: "/users/:id", name: "user", component: User, props: true },
    ],
  });
  const App = () => () =>
    h("main", null, [
      h(RouterLink, { to: { name: "user", params: { id: 7 } }, id: "user-link" }, "User"),
      h(RouterView),
    ]);
  const container = document.createElement("div");

  createApp(App).use(router).mount(container);
  expect(container.querySelector<HTMLAnchorElement>("#user-link")?.getAttribute("href")).toBe(
    "/users/7",
  );

  container.querySelector<HTMLAnchorElement>("#user-link")?.click();
  await settleRouterLinkNavigation();

  expect(container.querySelector("#user")?.textContent).toBe("7");
});
```

- [x] **Step 2: Run tests to verify they fail**

Run:

```bash
pnpm vitest run tests/integration/router-component.test.ts
```

Expected: FAIL because `RouterView` currently calls `h(resolvedComponent)` without route props.

- [x] **Step 3: Validate route props records**

In `src/router/router.ts`, add `props` to `allowedRouteRecordFields`, call:

```ts
assertRouteRecordPropsContract(route.props);
```

Add:

```ts
function assertRouteRecordPropsContract(props: RouteRecord["props"]): void {
  if (props === undefined || typeof props === "boolean" || typeof props === "function") {
    return;
  }

  if (typeof props === "object" && props !== null && !Array.isArray(props)) {
    assertRouterLocationQueryObjectContract(props);
    return;
  }

  throw new TypeError("Router route record props must be a boolean, object, or function");
}
```

- [x] **Step 4: Pass props from RouterView**

In `src/router/components.ts`, change the render branch:

```ts
const resolvedComponent = resolveRouteComponent(component, route);
const routeProps = record === undefined ? null : resolveRouteProps(record, route.value);
return resolvedComponent === null ? h(Fragment, null, []) : h(resolvedComponent, routeProps);
```

Add:

```ts
function resolveRouteProps(
  record: RouteRecord,
  route: RouteLocationNormalized,
): Record<string, unknown> | null {
  const props = record.props;
  if (props === undefined || props === false) {
    return null;
  }

  if (props === true) {
    return { ...route.params };
  }

  if (typeof props === "function") {
    const resolved = props(route);
    if (!isPlainObject(resolved)) {
      throw new TypeError("Router route record props function must return an object");
    }
    return resolved;
  }

  return props;
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return false;
  }

  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}
```

- [x] **Step 5: Run focused tests**

Run:

```bash
pnpm vitest run tests/integration/router-component.test.ts tests/unit/router/router.test.ts
```

Expected: PASS for route props integration and router unit tests.

- [x] **Step 6: Commit**

```bash
git add src/router/components.ts src/router/router.ts tests/integration/router-component.test.ts
git commit -m "feat(router): pass route props through RouterView"
```

---

### Task 6: Docs, Full Verification, And Package Contract

**Files:**

- Modify: `docs/api.md`
- Modify: `docs/api.zh-CN.md`
- Modify: `docs/package-usage.md`
- Modify: `docs/project-status.zh-CN.md`
- Modify: `tests/integration/package-exports.test.ts`
- Test: `tests/integration/package-exports.test.ts`

- [x] **Step 1: Update docs**

In `docs/package-usage.md`, replace the Router scope paragraph with this content:

```md
The current beta router supports path matching, dynamic params, query parsing, browser and memory
history adapters, nested route records, redirects, global `beforeEach` guards, route-level
`beforeEnter` guards, route `meta`, route names, aliases, route props, `lazyRoute()` route
components, `RouterLink`, and `RouterView`. It does not yet include scroll behavior, auth,
permissions, SSR, SSG, or hydration router integration. Passing still-deferred router options such
as `scrollBehavior` throws a `TypeError`. Object route locations support `{ path, query }` and
`{ name, params, query }`; hash fragments remain outside the beta contract.
```

In `docs/api.md`, add an English Router API paragraph with this content near the existing Router
section:

```md
`RouteRecord.name` assigns a globally unique string name to a route record. Named locations use
`{ name, params, query }`, interpolate required path params into the canonical route path, and keep
aliases out of generated hrefs. `RouteRecord.alias` accepts a string or string array of alternate
paths that match the same canonical record. `RouteRecord.props` accepts `true`, a plain object, or a
function from `RouteLocationNormalized` to props for the active `RouterView` depth.
`createMemoryHistory()` provides a first-party non-DOM history adapter for tests and controlled
runtimes.
```

In `docs/api.zh-CN.md`, add the Chinese Router API paragraph:

```md
`RouteRecord.name` 为路由记录声明全局唯一的字符串名称。命名位置使用
`{ name, params, query }`，把必需路径参数插入 canonical route path，并且生成 href 时不优先使用
alias。`RouteRecord.alias` 接受字符串或字符串数组，作为匹配同一 canonical record 的备用路径。
`RouteRecord.props` 接受 `true`、plain object，或从 `RouteLocationNormalized` 生成 props 的函数，
并只作用于当前 `RouterView` depth 渲染的组件。`createMemoryHistory()` 提供第一方非 DOM history
adapter，面向测试和受控运行环境。
```

In `docs/project-status.zh-CN.md`, update the Router status paragraph to this wording:

```md
Router 在 0.1.x beta 中已稳定更完整的 SPA 基础契约：path/query/params、web/hash/memory history、
nested route、redirect、global beforeEach、route beforeEnter、meta、lazyRoute、route names、aliases、
route props、RouterLink 和 RouterView。scrollBehavior、auth、permissions、SSR/SSG/hydration router
integration 仍为 deferred，不属于当前兼容性承诺。
```

- [x] **Step 2: Ensure package export tests cover the final root API**

In `tests/integration/package-exports.test.ts`, make the root API sorted key list include `createMemoryHistory` and keep `createSSRRouter` excluded:

```ts
expect(Object.keys(api).sort()).toEqual([
  "Fragment",
  "RouterLink",
  "RouterNavigationError",
  "RouterView",
  "computed",
  "createApp",
  "createMemoryHistory",
  "createRouter",
  "createStore",
  "createWebHashHistory",
  "createWebHistory",
  "defineAsyncComponent",
  "defineComponent",
  "effect",
  "h",
  "inject",
  "lazyRoute",
  "nextTick",
  "onMounted",
  "onUnmounted",
  "onUpdated",
  "provide",
  "reactive",
  "ref",
  "render",
  "useRoute",
  "useRouter",
  "useStyle",
  "watch",
  "watchEffect",
]);
expect(api).not.toHaveProperty("createSSRRouter");
```

- [x] **Step 3: Run focused router and package checks**

Run:

```bash
pnpm vitest run tests/unit/router tests/integration/router-component.test.ts
pnpm build
pnpm vitest run --config vitest.package.config.ts tests/integration/package-exports.test.ts
```

Expected: PASS.

- [x] **Step 4: Run full quality gate**

Run:

```bash
pnpm quality
```

Expected: PASS.

- [x] **Step 5: Commit**

```bash
git add docs/api.md docs/api.zh-CN.md docs/package-usage.md docs/project-status.zh-CN.md tests/integration/package-exports.test.ts
git commit -m "docs(router): document stable contract expansion"
```

---

## Final Review Checklist

- `createMemoryHistory` is exported from `src/router/index.ts` and `src/index.ts`.
- Route names, aliases, props, named locations, and params are accepted by public types.
- `scrollBehavior`, hash locations, auth helpers, permission helpers, and SSR router helpers remain outside the public beta contract.
- Alias matching returns canonical `matched` records and canonical `name`, while preserving the actual alias URL in `path` and `fullPath`.
- Named navigation uses canonical paths and never prefers alias paths.
- Route props are scoped to the active `RouterView` depth.
- Memory history works without DOM globals and uses the existing internal href formatter symbol.
- `pnpm quality` passes after all tasks.
