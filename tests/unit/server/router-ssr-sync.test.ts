import { describe, expect, it } from "vitest";

import { h } from "../../../src";
import { routeKey, routerKey } from "../../../src/router/router";
import { resolveRouterSSR, resolveRouterSSRSync } from "../../../src/server/router-ssr";

const identify = (record: { name?: string }) => record.name ?? "record";

const routes = [
  { path: "/", name: "home", component: () => h("p", null, "home") },
  { path: "/about", name: "about", component: () => h("p", null, "about") },
];

describe("resolveRouterSSRSync", () => {
  it("returns the same result shape as the async resolver", () => {
    const resolved = resolveRouterSSRSync({ url: "/about", routes, identifyRecord: identify });

    expect(resolved.router).toBeDefined();
    expect(resolved.route).toBeDefined();
    expect(resolved.snapshot.fullPath).toBe("/about");
    expect(resolved.provides.get(routerKey)).toBe(resolved.router);
    expect(resolved.provides.get(routeKey)).toBe(resolved.router.currentRoute);
  });

  it("produces a byte-identical snapshot to the async resolver", async () => {
    const syncResult = resolveRouterSSRSync({ url: "/about", routes, identifyRecord: identify });
    const asyncResult = await resolveRouterSSR({ url: "/about", routes, identifyRecord: identify });
    expect(JSON.stringify(syncResult.snapshot)).toBe(JSON.stringify(asyncResult.snapshot));
  });

  it("throws TypeError for asynchronous guards", () => {
    expect(() =>
      resolveRouterSSRSync({
        url: "/about",
        routes,
        identifyRecord: identify,
        configure: (router) => {
          router.beforeEach(async () => true);
        },
      }),
    ).toThrow(TypeError);
    expect(() =>
      resolveRouterSSRSync({
        url: "/about",
        routes,
        identifyRecord: identify,
        configure: (router) => {
          router.beforeEach(async () => true);
        },
      }),
    ).toThrow(/synchronous guards/);
  });

  it("throws the existing option assertion error for missing identifyRecord", () => {
    expect(() =>
      resolveRouterSSRSync({ url: "/about", routes } as unknown as Parameters<
        typeof resolveRouterSSRSync
      >[0]),
    ).toThrow("SSR router identifyRecord must be a function");
  });
});
