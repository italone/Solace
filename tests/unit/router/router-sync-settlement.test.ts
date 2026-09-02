import { describe, expect, it, vi } from "vitest";

import { h } from "../../../src/index";
import { createRouter, RouterNavigationError } from "../../../src/router/router";
import type { RouterHistory } from "../../../src/router/types";

const Home = () => h("div", null, "home");

function createMemoryLikeHistory(initial = "/"): RouterHistory & {
  pushedPaths: string[];
  replacedPaths: string[];
} {
  let current = initial;
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
    listen() {
      return () => undefined;
    },
    back: vi.fn(),
    forward: vi.fn(),
    pushedPaths,
    replacedPaths,
  };
}

describe("synchronous router settlement", () => {
  it("settles synchronously, returns the route, and updates currentRoute", () => {
    const history = createMemoryLikeHistory("/home");
    const router = createRouter({
      history,
      routes: [{ path: "/home", component: Home }],
    });

    const route = router.isReadySync();

    expect(route.fullPath).toBe("/home");
    expect(router.currentRoute.value.fullPath).toBe("/home");
  });

  it("follows a record redirect to the landing route", () => {
    const history = createMemoryLikeHistory("/legacy");
    const router = createRouter({
      history,
      routes: [
        { path: "/", component: Home },
        { path: "/legacy", redirect: "/" },
      ],
    });

    const route = router.isReadySync();

    expect(router.currentRoute.value.fullPath).toBe("/");
    expect(route.fullPath).toBe("/");
    expect(route.redirectedFrom?.fullPath).toBe("/legacy");
    expect(history.replacedPaths).toEqual(["/"]);
  });

  it("follows a sync guard redirect chain to the landing route", () => {
    const history = createMemoryLikeHistory("/a");
    const router = createRouter({
      history,
      routes: [
        { path: "/a", component: Home, beforeEnter: () => "/b" },
        { path: "/b", component: Home, beforeEnter: () => "/c" },
        { path: "/c", component: Home },
      ],
    });

    const route = router.isReadySync();

    expect(router.currentRoute.value.fullPath).toBe("/c");
    expect(route.fullPath).toBe("/c");
  });

  it("throws RouterNavigationError when a sync guard returns false", () => {
    const history = createMemoryLikeHistory("/secret");
    const router = createRouter({
      history,
      routes: [{ path: "/secret", component: Home, beforeEnter: () => false }],
    });

    expect(() => router.isReadySync()).toThrow(RouterNavigationError);
    expect(() => router.isReadySync()).toThrow(/cancelled/);
  });

  it("throws TypeError when a guard is an async function", () => {
    const history = createMemoryLikeHistory("/async");
    const router = createRouter({
      history,
      routes: [
        {
          path: "/async",
          component: Home,
          beforeEnter: async () => undefined,
        },
      ],
    });

    expect(() => router.isReadySync()).toThrow(TypeError);
    expect(() => router.isReadySync()).toThrow(/synchronous guards/);
  });

  it("throws TypeError when a guard returns a promise", () => {
    const history = createMemoryLikeHistory("/promise");
    const router = createRouter({
      history,
      routes: [
        {
          path: "/promise",
          component: Home,
          beforeEnter: () => Promise.resolve(true),
        },
      ],
    });

    expect(() => router.isReadySync()).toThrow(TypeError);
    expect(() => router.isReadySync()).toThrow(/synchronous guards/);
  });

  it("accepts a sync beforeEach guard and rejects an async beforeEach guard", () => {
    const syncHistory = createMemoryLikeHistory("/sync");
    const syncRouter = createRouter({
      history: syncHistory,
      routes: [{ path: "/sync", component: Home }],
    });
    syncRouter.beforeEach(() => true);
    expect(syncRouter.isReadySync().fullPath).toBe("/sync");

    const asyncHistory = createMemoryLikeHistory("/async-global");
    const asyncRouter = createRouter({
      history: asyncHistory,
      routes: [{ path: "/async-global", component: Home }],
    });
    asyncRouter.beforeEach(async () => undefined);
    expect(() => asyncRouter.isReadySync()).toThrow(/synchronous guards/);
  });

  it("keeps the async isReady path working after isReadySync", async () => {
    const history = createMemoryLikeHistory("/home");
    const router = createRouter({
      history,
      routes: [{ path: "/home", component: Home }],
    });

    expect(router.isReadySync().fullPath).toBe("/home");
    await expect(router.isReady()).resolves.toMatchObject({ fullPath: "/home" });
  });

  it("still throws on a redirect loop", () => {
    const history = createMemoryLikeHistory("/loop-a");
    const router = createRouter({
      history,
      routes: [
        { path: "/loop-a", redirect: "/loop-b" },
        { path: "/loop-b", redirect: "/loop-a" },
      ],
    });

    expect(() => router.isReadySync()).toThrow(/redirect loop/i);
  });
});
