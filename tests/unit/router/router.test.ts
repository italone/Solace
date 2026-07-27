import { describe, expect, it, vi } from "vitest";

import { h } from "../../../src/index";
import * as routerModule from "../../../src/router";
import { createRouter } from "../../../src/router/router";
import type { RouterHistory } from "../../../src/router/types";

const Home = () => h("div", null, "home");
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
  it("re-exports the public router module surface", () => {
    expect(routerModule).toMatchObject({
      RouterLink: expect.any(Function),
      RouterView: expect.any(Function),
      createRouter: expect.any(Function),
      createWebHashHistory: expect.any(Function),
      createWebHistory: expect.any(Function),
      useRoute: expect.any(Function),
      useRouter: expect.any(Function),
    });
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
