import { describe, expect, it, vi } from "vitest";

import { h, lazyRoute } from "../../../src/index";
import * as rootModule from "../../../src/index";
import * as routerModule from "../../../src/router";
import { createRouter } from "../../../src/router/router";
import type { RouterHistory } from "../../../src/router/types";

const Home = () => h("div", null, "home");
const User = Home;
const NotFound = Home;

function createMemoryLikeHistory(initial = "/"): RouterHistory & {
  emit(): void;
  listenerCount(): number;
  pushedPaths: string[];
  replacedPaths: string[];
} {
  let current = initial;
  const listeners = new Set<() => void>();
  const pushedPaths: string[] = [];
  const replacedPaths: string[] = [];

  return {
    location: () => current,
    push(path) {
      pushedPaths.push(path);
      current = path;
    },
    replace(path) {
      replacedPaths.push(path);
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
    listenerCount() {
      return listeners.size;
    },
    pushedPaths,
    replacedPaths,
  };
}

async function settleNavigationPipeline(): Promise<void> {
  await Promise.resolve();
  await Promise.resolve();
  await Promise.resolve();
  await Promise.resolve();
}

describe("createRouter", () => {
  it("re-exports the public router module surface", () => {
    expect(Object.keys(routerModule).sort()).toEqual([
      "RouterLink",
      "RouterNavigationError",
      "RouterView",
      "createRouter",
      "createWebHashHistory",
      "createWebHistory",
      "lazyRoute",
      "useRoute",
      "useRouter",
    ]);
    expect(routerModule).toMatchObject({
      RouterLink: expect.any(Function),
      RouterNavigationError: expect.any(Function),
      RouterView: expect.any(Function),
      createRouter: expect.any(Function),
      createWebHashHistory: expect.any(Function),
      createWebHistory: expect.any(Function),
      lazyRoute: expect.any(Function),
      useRoute: expect.any(Function),
      useRouter: expect.any(Function),
    });
    expect(routerModule).not.toHaveProperty("createMemoryHistory");
    expect(routerModule).not.toHaveProperty("historyHrefFormatterKey");
    expect(routerModule).not.toHaveProperty("hasHistoryHrefFormatter");
    expect(routerModule).not.toHaveProperty("NavigationGuard");
    expect(routerModule).not.toHaveProperty("RouteMeta");
    expect(routerModule).not.toHaveProperty("routerHrefFormatterKey");
    expect(routerModule).not.toHaveProperty("createSSRRouter");
  });

  it("keeps deferred router APIs out of the package root", () => {
    expect(rootModule).not.toHaveProperty("createMemoryHistory");
    expect(rootModule).not.toHaveProperty("historyHrefFormatterKey");
    expect(rootModule).not.toHaveProperty("hasHistoryHrefFormatter");
    expect(rootModule).not.toHaveProperty("NavigationGuard");
    expect(rootModule).not.toHaveProperty("RouteMeta");
    expect(rootModule).not.toHaveProperty("routerHrefFormatterKey");
    expect(rootModule).not.toHaveProperty("createSSRRouter");
  });

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
            children: [
              {
                path: "home",
                component: User,
                meta: { title: "home" },
                beforeEnter: [() => true],
                redirect: "/dashboard/home",
              },
            ],
          },
        ],
      }),
    ).not.toThrow();
  });

  it("rejects invalid beta route field values at creation time", () => {
    const sparseBeforeEnter = [() => true] as unknown[];
    sparseBeforeEnter.length = 2;

    const invalidRoutes = [
      { path: "/bad-redirect", redirect: 42 },
      { path: "/bad-redirect-location", redirect: { name: "home" } },
      { path: "/bad-redirect-query", redirect: { path: "/", query: [] } },
      { path: "/bad-redirect-path-query", redirect: { path: "/?tab=profile" } },
      { path: "/bad-redirect-absolute-url", redirect: { path: "https://example.com" } },
      { path: "/bad-before-enter", beforeEnter: true },
      { path: "/bad-before-enter-array", beforeEnter: [() => true, null] },
      { path: "/bad-before-enter-sparse-array", beforeEnter: sparseBeforeEnter },
      { path: "/bad-meta-null", meta: null },
      { path: "/bad-meta-array", meta: [] },
      {
        path: "/parent",
        children: [{ path: "bad-child-guard", beforeEnter: "guard" }],
      },
    ];

    for (const route of invalidRoutes) {
      expect(() =>
        createRouter({
          history: createMemoryLikeHistory(),
          routes: [route] as never,
        }),
      ).toThrow(TypeError);
    }
  });

  it("rejects non-object route records before compiling matchers", () => {
    const invalidRoutes = [
      null,
      [],
      42,
      {
        path: "/parent",
        children: [null],
      },
    ];

    for (const route of invalidRoutes) {
      expect(() =>
        createRouter({
          history: createMemoryLikeHistory(),
          routes: [route] as never,
        }),
      ).toThrow(TypeError("Router route record must be an object"));
    }
  });

  it("rejects invalid route components before compiling matchers", () => {
    const invalidComponents = [
      true,
      {},
      { __solaceLazyRouteComponent: true },
      { __solaceLazyRouteComponent: true, load: true },
    ];

    for (const component of invalidComponents) {
      expect(() =>
        createRouter({
          history: createMemoryLikeHistory(),
          routes: [{ path: "/", component }] as never,
        }),
      ).toThrow(
        TypeError("Router route record component must be a function or lazyRoute component"),
      );
    }

    expect(() =>
      createRouter({
        history: createMemoryLikeHistory(),
        routes: [{ path: "/", component: lazyRoute(() => Promise.resolve(Home)) }],
      }),
    ).not.toThrow();
  });

  it("keeps still-deferred route record fields rejected", () => {
    const deferredRecords = [
      { path: "/named", component: Home, name: "home" },
      { path: "/alias", component: Home, alias: "/a" },
      { path: "/props", component: Home, props: true },
      {
        path: "/parent",
        component: Home,
        children: [{ path: "named", component: User, name: "child" }],
      },
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

  it("rejects non-array child route records", () => {
    expect(() =>
      createRouter({
        history: createMemoryLikeHistory(),
        routes: [
          {
            path: "/dashboard",
            component: Home,
            children: { path: "home", component: User },
          },
        ],
      } as never),
    ).toThrow(/Router route record children must be an array/);
  });

  it("rejects invalid route record paths before compiling matchers", () => {
    expect(() =>
      createRouter({
        history: createMemoryLikeHistory(),
        routes: [{ path: 42, component: Home }],
      } as never),
    ).toThrow(/Router route record path must be a string/);
  });

  it("rejects invalid route lists before compiling matchers", () => {
    expect(() =>
      createRouter({
        history: createMemoryLikeHistory(),
        routes: null,
      } as never),
    ).toThrow(/Router routes must be an array/);
  });

  it("rejects non-object router options before compiling matchers", () => {
    for (const options of [null, [], 42]) {
      expect(() => createRouter(options as never)).toThrow(
        TypeError("Router options must be an object"),
      );
    }
  });

  it("rejects invalid history adapters before compiling matchers", () => {
    expect(() =>
      createRouter({
        history: null,
        routes: [],
      } as never),
    ).toThrow(TypeError("Router history must be an object"));
    expect(() =>
      createRouter({
        history: [],
        routes: [],
      } as never),
    ).toThrow(TypeError("Router history must be an object"));

    for (const method of ["location", "push", "replace", "listen", "back", "forward"]) {
      const history = createMemoryLikeHistory();
      const invalidHistory = { ...history, [method]: undefined };
      const missingMethodHistory = Object.fromEntries(
        Object.entries(history).filter(([key]) => key !== method),
      );

      expect(() =>
        createRouter({
          history: invalidHistory,
          routes: [],
        } as never),
      ).toThrow(TypeError(`Router history must implement ${method}()`));

      expect(() =>
        createRouter({
          history: missingMethodHistory,
          routes: [],
        } as never),
      ).toThrow(TypeError(`Router history must implement ${method}()`));
    }
  });

  it("rejects history listeners that do not return cleanup functions at install time", () => {
    const history = {
      ...createMemoryLikeHistory(),
      listen: () => undefined,
    };
    const router = createRouter({
      history: history as never,
      routes: [{ path: "/", component: Home }],
    });
    const app = { provide: vi.fn(), use: vi.fn(), mount: vi.fn() };

    expect(() => router.install(app as never)).toThrow(
      TypeError("Router history listen() must return an unsubscribe function"),
    );
  });

  it("rejects deferred router options instead of widening the beta contract", () => {
    expect(() =>
      createRouter({
        history: createMemoryLikeHistory(),
        routes: [{ path: "/", component: Home }],
        scrollBehavior: () => ({ left: 0, top: 0 }),
      } as never),
    ).toThrow(/Deferred router option/);
  });

  it("rejects invalid global beforeEach guards at registration time", () => {
    const router = createRouter({
      history: createMemoryLikeHistory(),
      routes: [{ path: "/", component: Home }],
    });

    for (const guard of [null, true, {}, []]) {
      expect(() => router.beforeEach(guard as never)).toThrow(
        TypeError("Router beforeEach guard must be a function"),
      );
    }
  });

  it("rejects deferred route location fields instead of ignoring them", async () => {
    const router = createRouter({
      history: createMemoryLikeHistory(),
      routes: [{ path: "/", component: Home }],
    });

    expect(() => router.resolve({ query: { tab: "profile" } } as never)).toThrow(
      /Router location path must be a string/,
    );
    expect(() => router.resolve({ path: 42 } as never)).toThrow(
      /Router location path must be a string/,
    );
    expect(() => router.resolve({ path: "/users/1", hash: "#profile" } as never)).toThrow(
      /Deferred router location field/,
    );
    expect(() => router.resolve("/users/1#profile")).toThrow(
      TypeError("Router location hash fragments are not part of the beta contract"),
    );
    expect(() => router.resolve({ path: "/users/1#profile" })).toThrow(
      TypeError("Router location hash fragments are not part of the beta contract"),
    );
    expect(() => router.resolve({ path: "/users/1?tab=profile" })).toThrow(
      TypeError("Router object location paths must not include query strings"),
    );
    expect(() => router.resolve({ path: "https://example.com" })).toThrow(
      TypeError("Router location must be a relative path"),
    );
    await expect(router.push({ path: "/users/1", name: "user" } as never)).rejects.toThrow(
      /Deferred router location field/,
    );
    await expect(router.push({ path: "//example.com" })).rejects.toThrow(
      TypeError("Router location must be a relative path"),
    );
    await expect(router.push("/users/1#profile")).rejects.toThrow(
      TypeError("Router location hash fragments are not part of the beta contract"),
    );
    await expect(
      router.replace({ path: "/users/1", params: { id: "1" } } as never),
    ).rejects.toThrow(/Deferred router location field/);
    await expect(router.replace({ path: "/users/1#profile" })).rejects.toThrow(
      TypeError("Router location hash fragments are not part of the beta contract"),
    );
    await expect(router.replace({ path: "/users/1?tab=profile" })).rejects.toThrow(
      TypeError("Router object location paths must not include query strings"),
    );
    await expect(router.replace({ path: "https://example.com" })).rejects.toThrow(
      TypeError("Router location must be a relative path"),
    );
  });

  it("rejects non-object route locations with a stable router error", async () => {
    const router = createRouter({
      history: createMemoryLikeHistory(),
      routes: [{ path: "/", component: Home }],
    });

    for (const location of [null, [], 42]) {
      expect(() => router.resolve(location as never)).toThrow(
        TypeError("Router location must be a string or object"),
      );
      await expect(router.push(location as never)).rejects.toThrow(
        TypeError("Router location must be a string or object"),
      );
      await expect(router.replace(location as never)).rejects.toThrow(
        TypeError("Router location must be a string or object"),
      );
    }
  });

  it("rejects invalid object location query values with a stable router error", async () => {
    const router = createRouter({
      history: createMemoryLikeHistory(),
      routes: [{ path: "/", component: Home }],
    });

    expect(() => router.resolve({ path: "/", query: null } as never)).toThrow(
      /Router location query must be an object/,
    );
    expect(() => router.resolve({ path: "/", query: [] } as never)).toThrow(
      /Router location query must be an object/,
    );
    await expect(router.push({ path: "/", query: "tab=profile" } as never)).rejects.toThrow(
      /Router location query must be an object/,
    );
    await expect(router.replace({ path: "/", query: 42 } as never)).rejects.toThrow(
      /Router location query must be an object/,
    );
    expect(() =>
      router.resolve({ path: "/", query: { filter: { active: true } } } as never),
    ).toThrow(TypeError("Router location query value must be a primitive or primitive array"));
    await expect(
      router.push({ path: "/", query: { filter: [true, { active: true }] } } as never),
    ).rejects.toThrow(
      TypeError("Router location query value must be a primitive or primitive array"),
    );
  });

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

  it("normalizes supported string locations to canonical full paths", () => {
    const router = createRouter({
      history: createMemoryLikeHistory(),
      routes: [{ path: "/users/:id", component: User }],
    });

    expect(router.resolve("").fullPath).toBe("/");
    expect(router.resolve("users/42///?tab=profile").fullPath).toBe("/users/42?tab=profile");
    expect(router.resolve("/users/42///?tag=a&tag=b")).toMatchObject({
      path: "/users/42",
      fullPath: "/users/42?tag=a&tag=b",
      params: { id: "42" },
      query: { tag: ["a", "b"] },
    });
    expect(router.resolve("/users/42?redirect=/users/1?tab=profile&mode=edit")).toMatchObject({
      path: "/users/42",
      fullPath: "/users/42?redirect=%2Fusers%2F1%3Ftab%3Dprofile&mode=edit",
      params: { id: "42" },
      query: { redirect: "/users/1?tab=profile", mode: "edit" },
    });
    expect(() => router.resolve("https://example.com")).toThrow(
      TypeError("Router location must be a relative path"),
    );
  });

  it("normalizes supported object locations to canonical full paths", () => {
    const router = createRouter({
      history: createMemoryLikeHistory(),
      routes: [{ path: "/users/:id", component: User }],
    });

    expect(router.resolve({ path: "users/7///", query: { tab: "profile" } })).toMatchObject({
      path: "/users/7",
      fullPath: "/users/7?tab=profile",
      params: { id: "7" },
      query: { tab: "profile" },
    });
  });

  it("updates currentRoute when navigating", async () => {
    const history = createMemoryLikeHistory("/");
    const router = createRouter({
      history,
      routes: [
        { path: "/", component: Home },
        { path: "/users/:id", component: User },
      ],
    });

    await router.push("/users/42?tab=profile");

    expect(router.currentRoute.value.fullPath).toBe("/users/42?tab=profile");
    expect(router.currentRoute.value.params).toEqual({ id: "42" });
  });

  it("returns the final route from async push and replace", async () => {
    const router = createRouter({
      history: createMemoryLikeHistory("/"),
      routes: [
        { path: "/", component: Home },
        { path: "/users/:id", component: User },
      ],
    });

    await expect(router.push("/users/42")).resolves.toMatchObject({ fullPath: "/users/42" });
    await expect(router.replace("/")).resolves.toMatchObject({ fullPath: "/" });
  });

  it("does not write history when navigating to the current route", async () => {
    const history = createMemoryLikeHistory("/users/42?tab=profile");
    const router = createRouter({
      history,
      routes: [
        { path: "/", component: Home },
        { path: "/users/:id", component: User },
      ],
    });

    await expect(router.push("/users/42?tab=profile")).resolves.toMatchObject({
      fullPath: "/users/42?tab=profile",
    });
    await expect(
      router.replace({ path: "/users/42", query: { tab: "profile" } }),
    ).resolves.toMatchObject({
      fullPath: "/users/42?tab=profile",
    });

    expect(history.pushedPaths).toEqual([]);
    expect(history.replacedPaths).toEqual([]);
  });

  it("does not run guards when navigating to the current route", async () => {
    const globalGuard = vi.fn();
    const routeGuard = vi.fn();
    const history = createMemoryLikeHistory("/users/42?tab=profile");
    const router = createRouter({
      history,
      routes: [
        { path: "/", component: Home },
        { path: "/users/:id", component: User, beforeEnter: routeGuard },
      ],
    });
    router.beforeEach(globalGuard);

    const current = router.currentRoute.value;
    const result = await router.push("/users/42?tab=profile");

    expect(result).toBe(current);
    expect(globalGuard).not.toHaveBeenCalled();
    expect(routeGuard).not.toHaveBeenCalled();
    expect(history.pushedPaths).toEqual([]);
    expect(history.replacedPaths).toEqual([]);
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
    expect(history.pushedPaths[history.pushedPaths.length - 1]).toBe("/users/1");

    await router.push("/old");
    expect(history.pushedPaths[history.pushedPaths.length - 1]).toBe("/users/2?tab=profile");
  });

  it("applies function redirects with the resolved target route", async () => {
    const router = createRouter({
      history: createMemoryLikeHistory("/"),
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

  it("rejects route redirect errors without mutating history or current route", async () => {
    const history = createMemoryLikeHistory("/");
    const router = createRouter({
      history,
      routes: [
        { path: "/", component: Home },
        {
          path: "/broken-redirect",
          redirect: () => {
            throw new Error("redirect exploded");
          },
        },
      ],
    });

    await expect(router.push("/broken-redirect")).rejects.toMatchObject({
      name: "RouterNavigationError",
      type: "redirect-rejected",
      from: { fullPath: "/" },
      to: { fullPath: "/broken-redirect" },
    });
    expect(history.pushedPaths).toEqual([]);
    expect(router.currentRoute.value.fullPath).toBe("/");
  });

  it("rejects invalid route redirect locations without mutating history or current route", async () => {
    const history = createMemoryLikeHistory("/");
    const router = createRouter({
      history,
      routes: [
        { path: "/", component: Home },
        { path: "/invalid-redirect", redirect: () => ({ name: "login" }) as never },
      ],
    });

    await expect(router.push("/invalid-redirect")).rejects.toMatchObject({
      name: "RouterNavigationError",
      type: "redirect-rejected",
      from: { fullPath: "/" },
      to: { fullPath: "/invalid-redirect" },
    });
    expect(history.pushedPaths).toEqual([]);
    expect(router.currentRoute.value.fullPath).toBe("/");
  });

  it("applies parent route redirects before child guards", async () => {
    const childGuard = vi.fn();
    const history = createMemoryLikeHistory("/");
    const router = createRouter({
      history,
      routes: [
        { path: "/", component: Home },
        { path: "/login", component: Home },
        {
          path: "/admin",
          redirect: "/login",
          children: [{ path: "settings", component: User, beforeEnter: childGuard }],
        },
      ],
    });

    const result = await router.push("/admin/settings");

    expect(result).toMatchObject({
      fullPath: "/login",
      redirectedFrom: expect.objectContaining({ fullPath: "/admin/settings" }),
    });
    expect(childGuard).not.toHaveBeenCalled();
    expect(history.pushedPaths).toEqual(["/login"]);
  });

  it("does not run guards when a route redirect resolves to the current route", async () => {
    const globalGuard = vi.fn();
    const currentRouteGuard = vi.fn();
    const history = createMemoryLikeHistory("/");
    const router = createRouter({
      history,
      routes: [
        { path: "/", component: Home, beforeEnter: currentRouteGuard },
        { path: "/legacy", redirect: "/" },
      ],
    });
    router.beforeEach(globalGuard);

    const current = router.currentRoute.value;
    const result = await router.push("/legacy");

    expect(result).toBe(current);
    expect(globalGuard).not.toHaveBeenCalled();
    expect(currentRouteGuard).not.toHaveBeenCalled();
    expect(history.pushedPaths).toEqual([]);
    expect(history.replacedPaths).toEqual([]);
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

  it("waits for asynchronous beforeEach guards", async () => {
    const calls: string[] = [];
    const router = createRouter({
      history: createMemoryLikeHistory("/"),
      routes: [
        { path: "/", component: Home },
        { path: "/users/:id", component: User },
      ],
    });

    router.beforeEach(async (to) => {
      await Promise.resolve();
      calls.push(to.fullPath);
    });

    await router.push("/users/42");

    expect(calls).toEqual(["/users/42"]);
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

  it("applies redirects from the initial history location after install", async () => {
    const history = createMemoryLikeHistory("/legacy");
    const router = createRouter({
      history,
      routes: [
        { path: "/", component: Home },
        { path: "/legacy", redirect: "/" },
      ],
    });
    const app = { provide: vi.fn(), use: vi.fn(), mount: vi.fn() };

    router.install(app as never);
    await settleNavigationPipeline();

    expect(history.replacedPaths).toEqual(["/"]);
    expect(router.currentRoute.value.fullPath).toBe("/");
  });

  it("applies guard redirects from the initial history location after install", async () => {
    const history = createMemoryLikeHistory("/dashboard");
    const router = createRouter({
      history,
      routes: [
        { path: "/login", component: Home },
        { path: "/dashboard", component: User, beforeEnter: () => "/login" },
      ],
    });
    const app = { provide: vi.fn(), use: vi.fn(), mount: vi.fn() };

    router.install(app as never);
    await settleNavigationPipeline();

    expect(history.replacedPaths).toEqual(["/login"]);
    expect(router.currentRoute.value.fullPath).toBe("/login");
  });

  it("rejects invalid guard redirect results without mutating history or current route", async () => {
    const history = createMemoryLikeHistory("/");
    const router = createRouter({
      history,
      routes: [
        { path: "/", component: Home },
        { path: "/blocked", component: User },
      ],
    });
    router.beforeEach(() => null as never);

    await expect(router.push("/blocked")).rejects.toMatchObject({
      name: "RouterNavigationError",
      type: "guard-rejected",
    });
    expect(history.pushedPaths).toEqual([]);
    expect(router.currentRoute.value.fullPath).toBe("/");
  });

  it("rejects invalid guard location objects without mutating history or current route", async () => {
    const history = createMemoryLikeHistory("/");
    const router = createRouter({
      history,
      routes: [
        { path: "/", component: Home },
        { path: "/blocked", component: User },
      ],
    });
    router.beforeEach(() => ({ name: "login" }) as never);

    await expect(router.push("/blocked")).rejects.toMatchObject({
      name: "RouterNavigationError",
      type: "guard-rejected",
    });
    expect(history.pushedPaths).toEqual([]);
    expect(router.currentRoute.value.fullPath).toBe("/");
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

  it("updates from history listeners after install", async () => {
    const history = createMemoryLikeHistory("/");
    const router = createRouter({ history, routes: [{ path: "/", component: Home }] });
    const app = { provide: vi.fn(), use: vi.fn(), mount: vi.fn() };

    router.install(app as never);
    history.push("/missing");
    history.emit();
    await settleNavigationPipeline();

    expect(router.currentRoute.value.matched).toEqual([]);
  });

  it("does not replace currentRoute when history emits the current location", async () => {
    const history = createMemoryLikeHistory("/users/42?tab=profile");
    const router = createRouter({
      history,
      routes: [
        { path: "/", component: Home },
        { path: "/users/:id", component: User },
      ],
    });
    const app = { provide: vi.fn(), use: vi.fn(), mount: vi.fn() };

    router.install(app as never);
    await settleNavigationPipeline();
    const current = router.currentRoute.value;

    history.emit();
    await settleNavigationPipeline();

    expect(router.currentRoute.value).toBe(current);
    expect(history.replacedPaths).toEqual([]);
  });

  it("does not run guards when history emits the current location", async () => {
    const globalGuard = vi.fn();
    const routeGuard = vi.fn();
    const history = createMemoryLikeHistory("/users/42?tab=profile");
    const router = createRouter({
      history,
      routes: [
        { path: "/", component: Home },
        { path: "/users/:id", component: User, beforeEnter: routeGuard },
      ],
    });
    const app = { provide: vi.fn(), use: vi.fn(), mount: vi.fn() };
    router.beforeEach(globalGuard);

    router.install(app as never);
    await settleNavigationPipeline();
    globalGuard.mockClear();
    routeGuard.mockClear();
    const current = router.currentRoute.value;

    history.emit();
    await settleNavigationPipeline();

    expect(router.currentRoute.value).toBe(current);
    expect(globalGuard).not.toHaveBeenCalled();
    expect(routeGuard).not.toHaveBeenCalled();
    expect(history.replacedPaths).toEqual([]);
  });

  it("restores history without replacing currentRoute when a history redirect resolves current", async () => {
    const history = createMemoryLikeHistory("/");
    const router = createRouter({
      history,
      routes: [
        { path: "/", component: Home },
        { path: "/legacy", redirect: "/" },
      ],
    });
    const app = { provide: vi.fn(), use: vi.fn(), mount: vi.fn() };

    router.install(app as never);
    await settleNavigationPipeline();
    const current = router.currentRoute.value;

    history.push("/legacy");
    history.emit();
    await settleNavigationPipeline();

    expect(history.replacedPaths).toEqual(["/"]);
    expect(router.currentRoute.value).toBe(current);
  });

  it("keeps the latest history route when an older guard settles later", async () => {
    const history = createMemoryLikeHistory("/");
    let allowInitialRoute!: () => void;
    const router = createRouter({
      history,
      routes: [
        { path: "/", component: Home },
        { path: "/users/:id", component: User },
      ],
    });
    router.beforeEach((to) => {
      if (to.fullPath !== "/") {
        return true;
      }

      return new Promise<void>((resolve) => {
        allowInitialRoute = resolve;
      });
    });
    const app = { provide: vi.fn(), use: vi.fn(), mount: vi.fn() };

    router.install(app as never);
    history.push("/users/42");
    history.emit();
    await settleNavigationPipeline();
    expect(router.currentRoute.value.fullPath).toBe("/users/42");

    allowInitialRoute();
    await settleNavigationPipeline();

    expect(router.currentRoute.value.fullPath).toBe("/users/42");
  });

  it("keeps the latest programmatic route when an older guard settles later", async () => {
    const history = createMemoryLikeHistory("/");
    let allowSlowRoute!: () => void;
    const router = createRouter({
      history,
      routes: [
        { path: "/", component: Home },
        { path: "/slow", component: User },
        { path: "/fast", component: NotFound },
      ],
    });
    router.beforeEach((to) => {
      if (to.fullPath !== "/slow") {
        return true;
      }

      return new Promise<void>((resolve) => {
        allowSlowRoute = resolve;
      });
    });

    const slowNavigation = router.push("/slow");
    await router.push("/fast");
    expect(router.currentRoute.value.fullPath).toBe("/fast");

    allowSlowRoute();
    await slowNavigation;

    expect(history.pushedPaths).toEqual(["/fast"]);
    expect(router.currentRoute.value.fullPath).toBe("/fast");
  });

  it("does not cancel a pending navigation when a newer raw location is invalid", async () => {
    const history = createMemoryLikeHistory("/");
    let allowSlowRoute!: () => void;
    const router = createRouter({
      history,
      routes: [
        { path: "/", component: Home },
        { path: "/slow", component: User },
      ],
    });
    router.beforeEach((to) => {
      if (to.fullPath !== "/slow") {
        return true;
      }

      return new Promise<void>((resolve) => {
        allowSlowRoute = resolve;
      });
    });

    const slowNavigation = router.push("/slow");
    await expect(router.push({ name: "missing" } as never)).rejects.toThrow(
      /Deferred router location field/,
    );

    allowSlowRoute();
    await expect(slowNavigation).resolves.toMatchObject({ fullPath: "/slow" });

    expect(history.pushedPaths).toEqual(["/slow"]);
    expect(router.currentRoute.value.fullPath).toBe("/slow");
  });

  it("restores the previous route when a history guard rejects", async () => {
    const history = createMemoryLikeHistory("/");
    const router = createRouter({
      history,
      routes: [
        { path: "/", component: Home },
        { path: "/boom", component: User },
      ],
    });
    router.beforeEach((to) => {
      if (to.fullPath === "/boom") {
        throw new Error("guard exploded");
      }

      return true;
    });
    const app = { provide: vi.fn(), use: vi.fn(), mount: vi.fn() };

    router.install(app as never);
    await settleNavigationPipeline();
    history.push("/boom");
    history.emit();
    await settleNavigationPipeline();

    expect(history.replacedPaths).toEqual(["/"]);
    expect(router.currentRoute.value.fullPath).toBe("/");
  });

  it("restores the previous route when a history location is invalid", async () => {
    const history = createMemoryLikeHistory("/");
    const router = createRouter({
      history,
      routes: [
        { path: "/", component: Home },
        { path: "/users/:id", component: User },
      ],
    });
    const app = { provide: vi.fn(), use: vi.fn(), mount: vi.fn() };

    router.install(app as never);
    await settleNavigationPipeline();
    history.push("/users/%E0%A4%A");
    history.emit();
    await settleNavigationPipeline();

    expect(history.replacedPaths).toEqual(["/"]);
    expect(router.currentRoute.value.fullPath).toBe("/");
  });

  it("recovers to the root route when the initial history location is invalid", async () => {
    const history = createMemoryLikeHistory("/users/%E0%A4%A");
    const router = createRouter({
      history,
      routes: [
        { path: "/", component: Home },
        { path: "/users/:id", component: User },
      ],
    });
    const app = { provide: vi.fn(), use: vi.fn(), mount: vi.fn() };

    expect(router.currentRoute.value.fullPath).toBe("/");

    router.install(app as never);
    await settleNavigationPipeline();

    expect(history.replacedPaths).toEqual(["/"]);
    expect(router.currentRoute.value.fullPath).toBe("/");
  });

  it("replaces the previous history listener on repeated install", () => {
    const history = createMemoryLikeHistory("/");
    const router = createRouter({ history, routes: [{ path: "/", component: Home }] });
    const app = { provide: vi.fn(), use: vi.fn(), mount: vi.fn() };

    router.install(app as never);
    expect(history.listenerCount()).toBe(1);

    router.install(app as never);
    expect(history.listenerCount()).toBe(1);
  });

  it("matches wildcard routes", () => {
    const router = createRouter({
      history: createMemoryLikeHistory("/missing/path"),
      routes: [{ path: "/:pathMatch(.*)*", component: NotFound }],
    });

    expect(router.currentRoute.value.params).toEqual({ pathMatch: "missing/path" });
  });
});
