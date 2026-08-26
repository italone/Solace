import { describe, expect, it } from "vitest";

import { RouterView, h, type RouteRecord } from "../../../src";
import { renderToStream } from "../../../src/server";
import { collectStream } from "./stream-test-utils";

const routes: RouteRecord[] = [
  { path: "/", name: "home", component: () => h("p", null, "home") },
  { path: "/user/:id", name: "user", component: () => h("p", null, "user") },
];
const identify = (record: RouteRecord): string => record.name ?? "record";
const RouterApp = () => h("div", null, h(RouterView));

describe("renderToStream router option", () => {
  it("streams route content and appends the snapshot script", async () => {
    const streamed = await collectStream(
      renderToStream(RouterApp, { router: { url: "/user/7", routes, identifyRecord: identify } }),
    );
    expect(streamed).toContain("user");
    expect(streamed.endsWith("</script>")).toBe(true);
    expect(streamed).toContain('<script id="__solace-router-snapshot">');
    expect(streamed).toContain("window.__SOLACE_ROUTER_SNAPSHOT__=");
    expect(streamed.indexOf("__solace-router-snapshot")).toBeGreaterThan(streamed.indexOf("user"));
  });

  it("rejects router plus provides", () => {
    expect(() =>
      renderToStream(() => h("p", null, "x"), {
        router: { url: "/", routes, identifyRecord: identify },
        provides: new Map(),
      }),
    ).toThrow("SSR router option cannot be combined with provides");
  });

  it("rejects invalid router options synchronously", () => {
    expect(() =>
      renderToStream(() => h("p", null, "x"), { router: { url: 1 } as never }),
    ).toThrow("SSR router url must be a string");
  });

  it("composes with out-of-order mode (snapshot after boundary flush)", async () => {
    const streamed = await collectStream(
      renderToStream(RouterApp, {
        router: { url: "/", routes, identifyRecord: identify },
        mode: "out-of-order",
      }),
    );
    expect(streamed).toContain("home");
    expect(streamed).toContain("__solace-router-snapshot");
  });
});
