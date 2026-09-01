import { describe, expect, it } from "vitest";

import { h } from "../../../src";
import {
  generateStaticSite,
  generateStaticSiteAsync,
} from "../../../src/server/generate-static-site";
import { parseRouterSnapshot } from "../../../src/router/snapshot";
import type { RouteRecord } from "../../../src/router/types";

const routes: RouteRecord[] = [
  { path: "/", component: () => h("p", null, "home") },
  { path: "/about", component: () => h("p", null, "about") },
];

const identifyRecord = (record: RouteRecord) => record.path;

describe("router-aware generateStaticSiteAsync", () => {
  it("renders a route with router state and embeds the snapshot script", async () => {
    const result = await generateStaticSiteAsync({
      routes: [
        {
          path: "/about",
          source: () => h("p", null, "static shell"),
          router: { routes, identifyRecord },
        },
      ],
    });

    expect(result.pages).toHaveLength(1);
    const page = result.pages[0];
    expect(page.body).toContain("static shell");
    expect(page.body).toContain("script");
    expect(page.body).toContain("__SOLACE_ROUTER_SNAPSHOT__");

    const payload = page.body.match(/window\.__SOLACE_ROUTER_SNAPSHOT__\s*=\s*(.+?);?<\/script>/);
    expect(payload).not.toBe(null);
    const snapshot = parseRouterSnapshot(payload![1]);
    expect(snapshot.path).toBe("/about");
  });

  it("still renders routes without a router exactly as before", async () => {
    const result = await generateStaticSiteAsync({
      routes: [{ path: "/plain", source: () => h("p", null, "plain") }],
    });

    expect(result.pages[0].body).toBe("<p>plain</p>");
  });

  it("rejects an unknown field inside the router option", async () => {
    await expect(
      generateStaticSiteAsync({
        routes: [
          {
            path: "/",
            source: () => h("p", null, "x"),
            router: { routes, identifyRecord, url: "/" } as never,
          },
        ],
      }),
    ).rejects.toThrow("Unknown SSR router option: url");
  });

  it("rejects a router option with missing identifyRecord", async () => {
    await expect(
      generateStaticSiteAsync({
        routes: [
          {
            path: "/",
            source: () => h("p", null, "x"),
            router: { routes } as never,
          },
        ],
      }),
    ).rejects.toThrow("identifyRecord");
  });

  it("keeps rejecting router on the synchronous entry", () => {
    expect(() =>
      generateStaticSite({
        routes: [
          {
            path: "/",
            source: () => h("p", null, "x"),
            router: { routes, identifyRecord },
          } as never,
        ],
      }),
    ).toThrow("Router-aware SSG route integration");
  });
});
