import { describe, expect, it, vi } from "vitest";

import { h } from "../../../src";
import { RouterNavigationError } from "../../../src/router/router";
import type { RouteRecord } from "../../../src/router/types";
import { createRouterServerContext } from "../../../src/server/router-context";

const Home = () => h("p", null, "home");
const Target = () => h("p", null, "target");
const routes: RouteRecord[] = [
  { path: "/", name: "home", component: Home },
  { path: "/target", name: "target", component: Target },
  { path: "/legacy", redirect: "/target" },
];

const identifyRecord = (record: RouteRecord): string => record.name ?? record.path;

describe("createRouterServerContext", () => {
  it("settles a request-scoped memory router and returns canonical snapshot injections", async () => {
    const inputProvides = new Map<string | symbol, unknown>([["theme", "dark"]]);
    const context = await createRouterServerContext({
      url: "/legacy?z=2&a=1",
      routes,
      identifyRecord,
      provides: inputProvides,
      configure(router) {
        router.beforeEach(() => true);
      },
    });

    expect(context.route.fullPath).toBe("/target");
    expect(context.snapshot.fullPath).toBe("/target");
    expect(context.snapshot.matched).toEqual(["target"]);
    expect(context.provides.get("theme")).toBe("dark");
    expect(context.provides).not.toBe(inputProvides);
    context.provides.set("request-only", true);
    expect(inputProvides.has("request-only")).toBe(false);
  });

  it("keeps concurrent request routers isolated", async () => {
    const [first, second] = await Promise.all([
      createRouterServerContext({ url: "/", routes, identifyRecord }),
      createRouterServerContext({ url: "/target", routes, identifyRecord }),
    ]);

    expect(first.route.fullPath).toBe("/");
    expect(second.route.fullPath).toBe("/target");
    expect(first.router).not.toBe(second.router);
    expect(first.provides).not.toBe(second.provides);
  });

  it("rejects cancelled initial navigation and asynchronous configuration", async () => {
    await expect(
      createRouterServerContext({
        url: "/target",
        routes,
        identifyRecord,
        configure(router) {
          router.beforeEach(() => false);
        },
      }),
    ).rejects.toMatchObject({ type: "guard-cancelled" } satisfies Partial<RouterNavigationError>);

    await expect(
      createRouterServerContext({
        url: "/",
        routes,
        identifyRecord,
        configure: (() => Promise.resolve()) as never,
      }),
    ).rejects.toThrow(TypeError);
  });

  it("does not execute browser scroll behavior for request settlement", async () => {
    const scrollTo = vi.fn();
    const previousScrollTo = globalThis.scrollTo;
    globalThis.scrollTo = scrollTo;

    try {
      await createRouterServerContext({ url: "/target", routes, identifyRecord });
      expect(scrollTo).not.toHaveBeenCalled();
    } finally {
      globalThis.scrollTo = previousScrollTo;
    }
  });
});
