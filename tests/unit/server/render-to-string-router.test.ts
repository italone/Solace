import { describe, expect, it } from "vitest";

import { RouterView, h, type RouteRecord } from "../../../src";
import { renderToString, renderToStringAsync } from "../../../src/server";
import { parseRouterSnapshot } from "../../../src/router/snapshot";

const routes: RouteRecord[] = [
  { path: "/", name: "home", component: () => h("p", null, "home") },
  { path: "/about", name: "about", component: () => h("p", null, "about") },
];
const identifyRecord = (record: RouteRecord) => record.name ?? "record";

const RouterApp = () => h("div", null, h(RouterView));

describe("renderToString router option", () => {
  it("renders route-driven content for the requested url", () => {
    const result = renderToString(RouterApp, {
      router: { url: "/about", routes, identifyRecord },
    });

    expect(result.html).toContain("about");
    expect(result.html).toContain("<div>");
  });

  it("appends the snapshot script with a parseable payload", () => {
    const result = renderToString(RouterApp, {
      router: { url: "/about", routes, identifyRecord },
    });

    expect(result.html.endsWith("</script>")).toBe(true);
    expect(result.html).toContain('<script id="__solace-router-snapshot">');
    expect(result.html).toContain("window.__SOLACE_ROUTER_SNAPSHOT__=");
    expect(result.html.indexOf("__solace-router-snapshot")).toBeGreaterThan(
      result.html.indexOf("about"),
    );

    const payload = result.html.match(/window\.__SOLACE_ROUTER_SNAPSHOT__\s*=\s*(.+?);?<\/script>/);
    expect(payload).not.toBe(null);
    const snapshot = parseRouterSnapshot(payload![1]);
    expect(snapshot.path).toBe("/about");
  });

  it("produces byte-identical html to renderToStringAsync", async () => {
    const syncResult = renderToString(RouterApp, {
      router: { url: "/about", routes, identifyRecord },
    });
    const asyncResult = await renderToStringAsync(RouterApp, {
      router: { url: "/about", routes, identifyRecord },
    });

    expect(syncResult.html).toBe(asyncResult.html);
    expect(syncResult.styles).toEqual(asyncResult.styles);
  });

  it("rejects router combined with provides", () => {
    expect(() =>
      renderToString(RouterApp, {
        router: { url: "/about", routes, identifyRecord },
        provides: new Map(),
      }),
    ).toThrow("SSR router option cannot be combined with provides");
  });

  it("rejects unknown fields inside the router option", () => {
    expect(() =>
      renderToString(RouterApp, {
        router: { url: "/about", routes, identifyRecord, unexpected: true } as never,
      }),
    ).toThrow(TypeError("Unknown SSR router option: unexpected"));
  });

  it("rejects asynchronous route guards", () => {
    expect(() =>
      renderToString(RouterApp, {
        router: {
          url: "/about",
          routes,
          identifyRecord,
          configure: (router) => {
            router.beforeEach(async () => true);
          },
        },
      }),
    ).toThrow(/synchronous guards/);
  });
});
