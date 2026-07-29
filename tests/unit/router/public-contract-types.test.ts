import { describe, expect, it } from "vitest";

import { h } from "../../../src";
import type { RouteLocationRaw, RouteRecord, RouterOptions } from "../../../src";

const Home = () => h("div", null, "home");

function acceptRouteRecord(record: RouteRecord): RouteRecord {
  return record;
}

function acceptRouterOptions(options: RouterOptions): RouterOptions {
  return options;
}

function acceptRouteLocationRaw(location: RouteLocationRaw): RouteLocationRaw {
  return location;
}

acceptRouteRecord({ path: "/", component: Home });
acceptRouteLocationRaw("/");
acceptRouteLocationRaw({ path: "/", query: { tab: "profile" } });

// @ts-expect-error nested route records are not part of the router beta contract
acceptRouteRecord({ path: "/nested", component: Home, children: [] });

// @ts-expect-error route guards are not part of the router beta contract
acceptRouteRecord({ path: "/guarded", component: Home, beforeEnter: () => true });

// @ts-expect-error redirects are not part of the router beta contract
acceptRouteRecord({ path: "/redirect", component: Home, redirect: "/" });

// @ts-expect-error route meta is not part of the router beta contract
acceptRouteRecord({ path: "/meta", component: Home, meta: {} });

// @ts-expect-error named routes are not part of the router beta contract
acceptRouteRecord({ path: "/named", component: Home, name: "home" });

// @ts-expect-error scroll behavior is not part of the router beta contract
acceptRouterOptions({ history: {} as never, routes: [], scrollBehavior: () => undefined });

// @ts-expect-error named locations are not part of the router beta contract
acceptRouteLocationRaw({ name: "home" });

// @ts-expect-error hash locations are not part of the router beta contract
acceptRouteLocationRaw({ path: "/", hash: "#section" });

// @ts-expect-error params locations are not part of the router beta contract
acceptRouteLocationRaw({ path: "/users/1", params: { id: "1" } });

// @ts-expect-error object locations must include a string path
acceptRouteLocationRaw({ query: { tab: "profile" } });

describe("router public contract types", () => {
  it("keeps deferred route fields out of the beta types", () => {
    expect(true).toBe(true);
  });
});
