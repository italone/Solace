import { describe, expect, it } from "vitest";

import { h } from "../../../src";
import { parseRouterSnapshot } from "../../../src/router/snapshot";
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

  it("rejects a non-function configure", () => {
    expect(() =>
      assertRouterSSROption({
        url: "/",
        routes,
        identifyRecord: identify,
        configure: "nope",
      }),
    ).toThrow("SSR router configure must be a function");
  });
});

describe("resolveRouterSSR", () => {
  it("builds a request-scoped context and provides for the route", async () => {
    const resolved = await resolveRouterSSR({ url: "/user/7", routes, identifyRecord: identify });
    expect(resolved.route.params).toMatchObject({ id: "7" });
    expect(resolved.provides.size).toBeGreaterThan(0);
    expect(resolved.snapshot.fullPath).toBe("/user/7");
  });

  it("rejects when a navigation guard throws", async () => {
    await expect(
      resolveRouterSSR({
        url: "/user/7",
        routes,
        identifyRecord: identify,
        configure: (router) => {
          router.beforeEach(() => {
            throw new Error("guard failed");
          });
        },
      }),
    ).rejects.toThrow("Router guard rejected");
  });
});

describe("buildSnapshotScript", () => {
  it("emits the assignment script with a neutralized payload", async () => {
    const resolved = await resolveRouterSSR({ url: "/user/7", routes, identifyRecord: identify });
    const script = buildSnapshotScript(resolved.snapshot);
    expect(script.startsWith('<script id="__solace-router-snapshot">')).toBe(true);
    expect(script).toContain("window.__SOLACE_ROUTER_SNAPSHOT__=");
    expect(script.endsWith(";</script>")).toBe(true);
    expect(script.indexOf("</script>")).toBe(script.lastIndexOf("</script>"));
  });

  it("neutralizes closing script sequences inside the payload", async () => {
    const hostileRoutes = [
      { path: "/", name: "home", component: () => h("p", null, "home") },
      { path: "/evil", name: "x</script>y", component: () => h("p", null, "evil") },
    ];
    const resolved = await resolveRouterSSR({
      url: "/evil",
      routes: hostileRoutes,
      identifyRecord: identify,
    });
    const script = buildSnapshotScript(resolved.snapshot);
    expect(script).toContain("\\u003C/script\\u003E");
    expect(script.indexOf("</script>")).toBe(script.length - "</script>".length);
  });

  it("round-trips through parseRouterSnapshot", async () => {
    const resolved = await resolveRouterSSR({ url: "/user/7", routes, identifyRecord: identify });
    const script = buildSnapshotScript(resolved.snapshot);
    const marker = "window.__SOLACE_ROUTER_SNAPSHOT__=";
    const payload = script.slice(
      script.indexOf(marker) + marker.length,
      script.lastIndexOf(";"),
    );
    expect(parseRouterSnapshot(payload).fullPath).toBe("/user/7");
  });
});
